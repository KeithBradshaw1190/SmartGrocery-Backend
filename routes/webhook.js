const express = require("express");
const router = express.Router();
//Import Action Function
const ordersActions = require("../actions/orders/Orders");
const recipeActions = require("../actions/recipes/Recipes");
const listActions = require("../actions/shoppingLists/ShoppingLists");
const userActions = require("../actions/users/Users");
const inventoryActions = require("../controllers/inventoryController");


const axios = require("axios");
const { WebhookClient } = require("dialogflow-fulfillment");
const { Card, Suggestion, Payload } = require("dialogflow-fulfillment");
const {
  SignIn,
  BasicCard,
  Button,
  BrowseCarouselItem,
  BrowseCarousel,
  Image,
  SimpleResponse,
  UpdatePermission,
  Suggestions
} = require("actions-on-google");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

//This is the main file to handle all Dialogflow interactions
router.post("/api/webhook", express.json(), (req, res) => {
  const agent = new WebhookClient({
    request: req,
    response: res,
  });

  console.log("Dialogflow Request headers: " + JSON.stringify(req.headers));
  console.log("Dialogflow Request body: " + JSON.stringify(req.body));

  let platform_type = req.body.originalDetectIntentRequest.source;
  console.log("Platform type" + platform_type);
  const conv = agent.conv();

  function welcome(agent) {
    agent.add("Welcome to SmartGrocery! Webhook");
  }

  function ga_welcome(agent) {
    console.log("ga welcome");

    conv.ask(new SignIn());
    agent.add(conv);
  }
  function sign_in(agent) {
    console.log("signIn" + JSON.stringify(conv.request));

    let access_token = conv.request.user.accessToken;
    console.log("access token " + access_token);
    let verification_status = conv.request.user.userVerificationStatus;
    if (access_token && verification_status) {
      agent.add("Great, you're all set to use Smart Grocery!");
    } else {
      agent.add(
        "Unfortunately Smart Grocery access will be limited if you dont sign in to your account"
      );
    }
  }

  async function deliveryOrders(agent) {
    console.log("Parameters" + JSON.stringify(agent.parameters));
    const [listName, deliveryLocation, conv_order_time, conv_order_date] = [
      agent.parameters["listName"],
      agent.parameters["deliveryLocation"],
      agent.parameters["conv_order_time"],
      agent.parameters["conv_order_date"],
    ];

    //find relevant id based on integration type
    var platform_id;
    if (platform_type == "google") {
      let access_token = conv.request.user.accessToken;
      platform_id = await userActions.findGoogleUserByToken(access_token);
      // console.log("Googleuser:::::" + JSON.stringify(platform_id));
    } else {
      platform_id = {
        sub: "2977902935566962",
      };
    }
    //Carry out standard order process
    var returnedDetails = await ordersActions.orderMain(
      agent.parameters,
      "Delivery",
      platform_type,
      platform_id.sub
    );
    if (returnedDetails == "Not Available") {
      agent.add("That delivery time is not available");
    } else {
      console.log("Returned details:::::" + JSON.stringify(returnedDetails));

      agent.add(
        "Found your shopping list! Currently working on your order, just one moment please..."
      );
      //Variables to create payment intent & receipt payload
      var stripe_customer_id = returnedDetails.stripeCustomer_id;
      var baseListPrice = returnedDetails.listPrice;

      var paymentIntent = await ordersActions.chargeCard(
        baseListPrice,
        stripe_customer_id
      );

      if (paymentIntent.status == "succeeded") {
        saveOrderToDB(returnedDetails, platform_type, conv_order_time, conv_order_date);
        if (platform_type == "google") {
          console.log("success google");
          const conv = agent.conv();

          conv.ask(
            new SimpleResponse({
              speech: `Delivery Scheduled Successfully. `,
              text: "Delivery Scheduled Successfully.",
            })
          );
          var orderSummary = ordersActions.createGoogleDeliveryResponse(
            paymentIntent,
            returnedDetails
          );
          conv.ask(orderSummary);
          agent.add(conv);
        } else if (platform_type == "facebook") {
          //Facebook Response
          console.log("Payment status success");
          facebook_payload = createFacebookReceipt(
            paymentIntent,
            returnedDetails,
            "3178982578828059"
          );
          //Send Payload receipt via facebook
          axios
            .post(
              `https://graph.facebook.com/v2.6/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
              facebook_payload
            )
            .then(function (response) {
              console.log("sent successfully" + response);
              agent.add(
                "More order information can be found on the SmartGrocery Dashboard!"
              );
            });
        }
      } else {
        console.log(paymentIntent.status);
        agent.add("Error on Charging Card" + paymentIntent.status);
      }
    }
  }

  async function collectionOrders(agent) {
    const [listName, collection_area, conv_order_time, conv_order_date] = [
      agent.parameters["listName"],
      agent.parameters["collection_area"],
      agent.parameters["conv_order_time"],
      agent.parameters["conv_order_date"],
    ];

    //Carry out standard order process
    var returnedDetails = await ordersActions.orderMain(
      agent.parameters,
      "Collection"
    );
    console.log("Returned Details" + JSON.stringify(returnedDetails));
    if (returnedDetails == "Not Available") {
      agent.add("That collection time is not available");
    } else {
      agent.add(
        "Found your shopping list! Currently working on your order, just one moment please..."
      );
      //Variables to create payment intent & receipt payload
      var stripe_customer_id = returnedDetails.stripeCustomer_id;
      var baseListPrice = returnedDetails.listPrice;

      var paymentIntent = await ordersActions.chargeCard(
        baseListPrice,
        stripe_customer_id
      );

      if (paymentIntent.status == "succeeded") {
        console.log("Payment status success");
        // New 

        saveOrderToDB(returnedDetails, platform_type, conv_order_time, conv_order_date);
        if (platform_type == "google") {
          console.log("success google");
          const conv = agent.conv();

          conv.ask(
            new SimpleResponse({
              speech: `Collection Scheduled Successfully. `,
              text: "Collection Scheduled Successfully.",
            })
          );
          var orderSummary = ordersActions.createGoogleCollectionResponse(
            paymentIntent,
            returnedDetails
          );
          conv.ask(orderSummary);
          agent.add(conv);
        } else if (platform_type == "facebook") {
          //Facebook Response
          console.log("Payment status success");
          facebook_payload = createFacebookReceipt(
            paymentIntent,
            returnedDetails,
            "3178982578828059"
          );
          //Send Payload receipt via facebook
          axios
            .post(
              `https://graph.facebook.com/v2.6/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
              facebook_payload
            )
            .then(function (response) {
              console.log("sent successfully" + response);
              agent.add(
                "More order information can be found on the SmartGrocery Dashboard!"
              );
            });
        }











        // End of New 
        //Payload receipt
        facebook_payload = createFacebookCollectionReceipt(
          paymentIntent,
          returnedDetails,
          "3178982578828059"
        );
        //Send Payload receipt
        axios
          .post(
            `https://graph.facebook.com/v2.6/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
            facebook_payload
          )
          .then(function (response) {
            console.log("sent successfully" + response);
          });
      } else {
        console.log(paymentIntent.status);
        agent.add("Error on Charging Card" + paymentIntent.status);
      }
    }
  }

  async function recipeGivenInput(agent) {
    const food_ingredients = agent.parameters["food_ingredients"];

    //Handling if a recipe type was given
    if (agent.parameters["recipe_type"]) {
      var recipe_type = agent.parameters["recipe_type"];
      agent.add(
        `Here are the ${recipe_type} Recipes I found for ${food_ingredients}`
      );
      var recipes = await recipeActions.search_recipe(
        `${recipe_type} recipe with ${food_ingredients}`
      );
      return recipeActions.formatRecipeResponse(agent, recipes, platform_type);
    } else {
      agent.add(`Here are the recipes I found for ${food_ingredients}`);
      var recipes = await recipeActions.search_recipe(
        `recipe with ${food_ingredients}`
      );
      return recipeActions.formatRecipeResponse(agent, recipes, platform_type);
    }
  }
  async function recipeFromShoppingList(agent) {
    let conv = agent.conv();

    // Agent Parameters will have list name AND OPTIONALLY a type of recipe

    //First find user UID
    var user;
    if (platform_type == "google") {
      let access_token = conv.request.user.accessToken;

      var gUser = await userActions.findGoogleUserByToken(access_token);
      user = await userActions.findFirebaseUser(gUser.sub, platform_type);
    } else if (platform_type == "facebook") {
      const messengerID = "3178982578828059";

      user = await userActions.findFirebaseUser(messengerID, platform_type);
    }
    console.log(user)
    var ingredientsFromList = await recipeActions.findIngredientsFromShoppingList(
      agent.parameters,
      user.uid
    );

    //Handling if a recipe type was given
    if (agent.parameters["recipe_type"]) {
      var recipe_type = agent.parameters["recipe_type"];
      agent.add(
        `Here are the ${recipe_type} Recipes I found with ${ingredientsFromList[0]} and ${ingredientsFromList[1]}`
      );
      var recipes = await recipeActions.search_recipe(
        `${recipe_type} recipe with ${ingredientsFromList[0]} or ${ingredientsFromList[1]}`
      );
      return recipeActions.formatRecipeResponse(agent, recipes, platform_type);
    } else {
      agent.add(
        `Here are the recipes I found with ${ingredientsFromList[0]} and ${ingredientsFromList[1]}`
      );
      var recipes = await recipeActions.search_recipe(
        `recipe with ${ingredientsFromList[0]} or ${ingredientsFromList[1]}`
      );
      return recipeActions.formatRecipeResponse(agent, recipes, platform_type);
    }
  }

  async function shoppingListByName(agent) {
    var listItems = await listActions.findShoppingListItemsByName(
      agent.parameters
    );
    console.log(listItems);
    var agentResponse = await listActions.formatFacebookShoppingListResponse(
      listItems
    );
    agent.add(agentResponse);
  }

  async function shoppingListByPurchFreq(agent) {
    var agentResponse = await listActions.findShoppingListByFreq(
      agent.parameters
    );
    agent.add(agentResponse);
  }

  function createFacebookReceipt(paymentIntent, returnedDetails, recipientID) {
    var baseListPrice = returnedDetails.listPrice;
    var userName = returnedDetails.userName;
    // var listQuantity = returnedDetails.listQuantity;
    // var listName = returnedDetails.listName;
    var orderElements = returnedDetails.orderElements;
    var deliveryAddress = returnedDetails.deliveryAddress;
    var totalAmount = paymentIntent.amount / 100;
    var receiptUrl = paymentIntent.charges.data[0].receipt_url;
    var timestamp = paymentIntent.created;
    var payment_method_details =
      paymentIntent.charges.data[0].payment_method_details;
    var payment_method =
      payment_method_details.card.brand +
      " " +
      payment_method_details.card.last4;

    console.log(
      "Payment method details" + JSON.stringify(payment_method_details)
    );
    console.log("Payment receipt" + receiptUrl);
    let facebook_payload = {
      recipient: {
        id: recipientID,
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "receipt",
            recipient_name: userName,
            merchant_name: "SmartGrocery-Stripe",
            order_number: "12345678902",
            currency: "EUR",
            payment_method: payment_method,
            order_url: receiptUrl,
            timestamp: timestamp,
            address: deliveryAddress,
            summary: {
              subtotal: baseListPrice,
              shipping_cost: 1.50,
              total_tax: 0.0,
              total_cost: totalAmount,
            },
            elements: orderElements,
          },
        },
      },
    };
    return facebook_payload;
  }

  function createFacebookCollectionReceipt(
    paymentIntent,
    returnedDetails,
    recipientID
  ) {
    var baseListPrice = returnedDetails.listPrice;
    var userName = returnedDetails.userName;
    var listQuantity = returnedDetails.listQuantity;
    var listName = returnedDetails.listName;
    var orderElements = returnedDetails.orderElements;
    var deliveryAddress = returnedDetails.deliveryAddress;
    var totalAmount = paymentIntent.amount / 100;
    var receiptUrl = paymentIntent.charges.data[0].receipt_url;
    var timestamp = paymentIntent.created;
    var payment_method_details =
      paymentIntent.charges.data[0].payment_method_details;
    var payment_method =
      payment_method_details.card.brand +
      " " +
      payment_method_details.card.last4;

    console.log(
      "Payment method details" + JSON.stringify(payment_method_details)
    );
    console.log("Collection receipt" + receiptUrl);
    let facebook_payload = {
      recipient: {
        id: recipientID,
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "receipt",
            recipient_name: userName,
            merchant_name: "SmartGrocery-Stripe",
            order_number: "12345678902",
            currency: "EUR",
            payment_method: payment_method,
            order_url: receiptUrl,
            timestamp: timestamp,
            address: deliveryAddress,
            summary: {
              subtotal: baseListPrice,
              shipping_cost: 0.0,
              total_tax: 0.0,
              total_cost: totalAmount,
            },
            elements: orderElements,
          },
        },
      },
    };
    return facebook_payload;
  }

  function saveOrderToDB(data, source, time, date) {


    // if (type=="delivery") {
    //Prevent the button from being clicked again

    var deliveryData = {
      order_source: source,
      order_price: Number(data.listPrice),
      order_info: {
        type: "Shopping List",
        name: data.listName,
      },
      items_info: data.orderElements,
      delivery_time: time,
      delivery_date: date,
      items_quantity: data.listQuantity
    };
    console.log("Delivery Data: " + JSON.stringify(deliveryData))
    try {
      axios
        .post("http://localhost:3003/api/delivery/save/" + data.user_id, deliveryData)
        .then(() => {
          // Update inventory
          var newInventory = {
            uid: data.user_id,
            order_source: deliveryData.order_source,
            current_inventory: deliveryData.items_info,
            order_submitted_on: "today",
            order_received_on: deliveryData.delivery_date,
          };
          return inventoryActions.createInventory(data.user_id, newInventory).then((result) => {

            if (result.inventory_already_exists==true){
              console.log("Inventory exists already, thats gucci")
              var productData = newInventory.current_inventory
              console.log("Product data"+JSON.stringify(productData))

              inventoryActions.updateMultipleItems(data.user_id,productData)
            }
            agent.add("Added to your inventory!");

          }).catch((err) => {
            agent.add("An error occurred updating your inventory");
          })
        });
    } catch (err) {
      console.log(err);
    }
    //Send the id and send to the API(setting paid and status of deliver)
    // } else if (type=="collection") {

    // }
  }
  async function showInventory(agent) {
    let conv = agent.conv();

    //First find user UID
    var user;
    if (platform_type == "google") {
      let access_token = conv.request.user.accessToken;

      var gUser = await userActions.findGoogleUserByToken(access_token);
      user = await userActions.findFirebaseUser(gUser.sub, platform_type);
    }
    return inventoryActions.showInventory(user.uid).then((result) => {
      if (result.success == false) {
        agent.add(`No inventory set up yet.`);

      } else {
        var inventoryItems=result.inventory_data.current_inventory;
        conv.ask(`Here's your inventory!`);
        items=[];
        inventoryItems.forEach((inv) => {
        var item = new BrowseCarouselItem({
          title:inv.title,
          url: inv.image_url,
          description:`Amount at home ${inv.quantity}`,
          image: new Image({
            url: inv.image_url,
            alt: 'inventoryItems Image',
          })
        })
        items.push(item);
      });
      conv.add(new BrowseCarousel({
        items: items,
      }));

      agent.add(conv)
      }
    })

  }
  async function updateInventory(agent) {
    console.log("PARAMS YO" + JSON.stringify(agent.parameters))
    let conv = agent.conv();
    var product_name = agent.parameters.foodingredients;

    //First find user UID
    var user;
    if (platform_type == "google") {
      let access_token = conv.request.user.accessToken;

      var gUser = await userActions.findGoogleUserByToken(access_token);
      user = await userActions.findFirebaseUser(gUser.sub, platform_type);
    }
    var changes = {
      product_name: agent.parameters.foodingredients,
      change_amount: Number(agent.parameters.number),
    };
    console.log("NAME: " + changes.product_name)
    console.log("Number: " + changes.change_amount)

    return inventoryActions.updateSingleItem(user.uid, changes).then((result) => {
      if (result.updated_inventory == "N/a") {
        agent.add(`Couldn't find any ${product_name} in your inventory.`);

      } else {
        if (((result.items_meeting_threshold).length > 1)&&result.quantity_of_item_left == 0) {
          agent.add(`You're all out of ${product_name}, and running low on other items. I can schedule an order or remind you later if you would like? `)

        }
        else if (result.quantity_of_item_left == 0) {
          agent.add(`You're all out of ${product_name}`)

        } else {
          agent.add(`Updated your inventory! Your ${product_name} quantity is now ${result.quantity_of_item_left}`);
          // Trigger a follow up to see if they want to re order
        }
     
      }

    }).catch((err) => {
      agent.add("An error occurred updating your inventory " + err);
    })

  }
  async function updateInventory_ReorderTrigger(agent) {
    // Decide order type based on response
    var orderType = agent.parameters.order_type;
    if (orderType == "Delivery") {
      agent.setFollowupEvent("DELIVERY_ORDER");

    } else if (orderType == "Pick-up") {
      agent.add(`Trigger Pick-up`);

    }

  }
  
  async function updateInventory_ReorderLater(agent) {
  
    console.log("Update Inventory - reorderLater")
    // Trigger notification to remind them later
    conv.ask(' I can send you push notifications. Would you like that?');

    agent.add(conv.ask(new UpdatePermission({
      intent: 'Update Inventory (reorder triggered)- yes',
    })));

    // agent.add(conv.ask(new Suggestions('Send notifications')));


  }


  async function test(agent){
    conv.ask(`When should I send a reminder?`);

    const Suggestion = {
      THIS_EVEN: 'This Evening',
      TOMORROW_M: 'Tomorrow Morning',
      TOMORROW_E: 'Tomorrow Evening',
      COUPLE_D: 'In a couple of days',
    };
    if (conv.screen) {
      conv.ask(new Suggestions([Suggestion.THIS_EVEN, Suggestion.COUPLE_D]));
    };
    agent.add(conv)
    if (conv.arguments.get('PERMISSION')) {
      console.log("PERMISION!")
      let userId = conv.arguments.get('UPDATES_USER_ID');
      if (!userId) {
        userId = conv.request.conversation.conversationId;
        console.log("userId!"+userId)

      }
    }else{
      console.log("no PERMISION!")
      userId = conv.request.conversation.conversationId;
      console.log("userId!"+userId)
    }
  }
  //Intent Map
  let intentMap = new Map();
  intentMap.set("Default Welcome Intent", welcome);
  intentMap.set("(GA)Welcome-Account Linking", ga_welcome);
  intentMap.set("Get Sign in-Google", sign_in);

  intentMap.set("Delivery Orders", deliveryOrders);
  intentMap.set("Collection Orders", collectionOrders);
  intentMap.set("Find Recipe-Given Ingredients or Name", recipeGivenInput);
  intentMap.set("Find Recipe-From Shopping List", recipeFromShoppingList);
  intentMap.set("Show Items in Shopping List-by list name", shoppingListByName);
  intentMap.set(
    "Show Items in Shopping List-by purch freq",
    shoppingListByPurchFreq
  );
  intentMap.set("Update Inventory", updateInventory);

  intentMap.set("Update Inventory (reorder triggered)- yes", updateInventory_ReorderTrigger);
  intentMap.set("Update Inventory - reorderLater", updateInventory_ReorderLater);
  intentMap.set("notification test", test);
  intentMap.set("Show Inventory", showInventory);



  agent.handleRequest(intentMap);
});

module.exports = router;
