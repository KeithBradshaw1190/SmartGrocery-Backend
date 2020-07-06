const express = require("express");
const router = express.Router();
const ordersActions = require("../actions/orders/Orders");
const recipeActions = require("../actions/recipes/Recipes");

const axios = require("axios");
const { WebhookClient } = require("dialogflow-fulfillment");
const { Card, Suggestion, Payload } = require("dialogflow-fulfillment");

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

  function welcome(agent) {
    agent.add("Welcome to my agent! Webhook");
  }

  async function deliveryOrders(agent) {
    console.log("Parameters" + JSON.stringify(agent.parameters));
    const [listName, deliveryLocation, conv_order_time, conv_order_date] = [
      agent.parameters["listName"],
      agent.parameters["deliveryLocation"],
      agent.parameters["conv_order_time"],
      agent.parameters["conv_order_date"],
    ];

    //Carry out standard order process
    var returnedDetails = await ordersActions.facebook_orderMain(
      agent.parameters,
      "Delivery"
    );
    console.log("Returned Details" + JSON.stringify(returnedDetails));
    if (returnedDetails == "Not Available") {
      agent.add("That delivery time is not available");
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
        //Payload receipt
        facebook_payload = createFacebookReceipt(
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

  async function collectionOrders(agent) {
    const [listName, collection_area, conv_order_time, conv_order_date] = [
      agent.parameters["listName"],
      agent.parameters["collection_area"],
      agent.parameters["conv_order_time"],
      agent.parameters["conv_order_date"],
    ];

    //Carry out standard order process
    var returnedDetails = await ordersActions.facebook_orderMain(
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
    // const food_ingredients = agent.parameters["food_ingredients"];
    var recipes = await recipeActions.facebook_recipeMain(agent.parameters);
    return recipeActions.formatRecipeResponse(agent, recipes)
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

  //Intent Map
  let intentMap = new Map();
  intentMap.set("Default Welcome Intent", welcome);
  intentMap.set("Delivery Orders", deliveryOrders);
  intentMap.set("Collection Orders", collectionOrders);
  intentMap.set("Find Recipe-Given Ingredients or Name", recipeGivenInput);

  agent.handleRequest(intentMap);
});

module.exports = router;
