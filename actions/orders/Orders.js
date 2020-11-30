const firebase = require("../../firebase/firebaseInit");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const userActions = require("../../actions/users/Users");
const { SignIn, BasicCard,Button, Image, SimpleResponse, } = require("actions-on-google");
const { json } = require("body-parser");

module.exports = {
  orderMain: async function (parameters, order_type, platform_type,platform_id) {
    var scheduled_date = parameters.conv_order_date.split("T")[0];
    var scheduled_time = parameters.conv_order_time
      .replace("Z", "")
      .split("T")[1]
      .split("+")[0];
    var list_name = parameters.listName;

    var messengerID = "3178982578828059";
    var orderAvailiable = this.timeAvailability(order_type, scheduled_time);

    if (platform_type == "google") {
      console.log("platform type"+ platform_type)
      //Set order type & check time availability
      if (orderAvailiable) {
        //Return User details
        const userDetails = await userActions.findFirebaseUser(platform_id,platform_type);
        //Return shopping list details
        var uid = userDetails.uid;
        const shopppinglistDetails = await this.getShoppinglist(
          list_name,
          uid
        );
        var returnedDetails;

        if (order_type == "Delivery") {
          returnedDetails = this.formatOrderMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters,
            platform_type
          );
        } else if (order_type == "Collection") {
          returnedDetails = this.formatCollectionMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters
          );
        }

        console.log(
          "Returned Deatails in facebook_ordermain" + returnedDetails
        );
        return returnedDetails;
      } else {
        return "Not available";
      }
    } else {
      //Facebook Platform
      //Set order type & check time availability
      if (orderAvailiable) {
        //Return User details
        const userDetails = await this.getUser(messengerID);
        //Return shopping list details
        var uid = userDetails.uid;

        const shopppinglistDetails = await this.getShoppinglist(
          list_name,
          uid
        );
        var returnedDetails;

        if (order_type == "Delivery") {
          returnedDetails = this.formatOrderMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters
          );
        } else if (order_type == "Collection") {
          returnedDetails = this.formatCollectionMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters
          );
        }

        console.log(
          "Returned Deatails in facebook_ordermain" + returnedDetails
        );
        return returnedDetails;
      } else {
        return "Not available";
      }
    }
  },
  timeAvailability: function (order_type, time) {
    const delivery_open = "09:00:00";
    const delivery_closed = "20:00:00";
    const collection_open = "09:00:00";
    const collection_closed = "21:00:00";

    console.log(
      "RECEIVED TIME IN TIME AVAILABILITY " + time + " for " + order_type
    );
    if (order_type == "Delivery") {
      if (time >= delivery_open && time <= delivery_closed) {
        return true;
      } else {
        return false;
      }
    } else if (order_type == "Collection") {
      if (time >= collection_open && time <= collection_closed) {
        return true;
      } else {
        return false;
      }
    }
  },

  getShoppinglist: async function (list_name, uid) {
    let listRef = firebase.db.collection("shopping_lists");
    console.log("Getting shopping list" + list_name + uid);

    try {
      const snapshot = await listRef
        .where("uid", "==", uid)
        .where("listName", "==", list_name)
        .get();
      var shoppingList;
      snapshot.forEach((doc) => {
        console.log("Got Shopping list");
        shoppingList = doc.data();
      });
      return shoppingList;
    } catch (err) {
      console.log("shoppingList error" + err);
    }
  },

  getUser: async function (messengerID) {
    let userRef = firebase.db.collection("users");
    console.log("Getting user" + messengerID);

    try {
      const snapshot = await userRef
        .where("messengerID", "==", messengerID)
        .get();
      var user;
      snapshot.forEach((doc) => {
        user = doc.data();
      });
      return user;
    } catch (err) {
      console.log("User error" + err);
      return Promise.reject("No such document");
    }
  },

  chargeCard: async function (baseListPrice, stripe_customer_id) {
    //Set Payment amounts(paymentAmount-the total to charge to a customer)
    var paymentAmount = Number(baseListPrice);
    var deliveryAmount = 0;
    var sgCharge;
    console.log("Payment before" + paymentAmount);
    var transferAmount = paymentAmount + deliveryAmount;
    //add smartgrocery charge (1.5%) and flat rate of €1 if over €100
    if (paymentAmount > 100) {
      sgCharge = (paymentAmount / 100) * 1.5 + 1;
    } else {
      sgCharge = 1;
    }
    paymentAmount = sgCharge + deliveryAmount + paymentAmount;
    paymentAmount = Number(paymentAmount.toFixed(2)) * 100;

    //End of set payment amounts

    var paymentMethodId;
    var allPaymentIDs = await this.getPaymentId(stripe_customer_id);
    console.log("THE RES all payment ids" + JSON.stringify(allPaymentIDs));
    paymentMethodId = allPaymentIDs.data[0].id;
    console.log("payment method in statement " + paymentMethodId);

    var paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: "eur",
      customer: stripe_customer_id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
    });
    return paymentIntent;
  },
  getPaymentId: async function (stripe_customer_id) {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripe_customer_id,
      type: "card",
    });
    return paymentMethods;
  },
  formatOrderElements: function (items) {
    formatted = [];
    items.forEach((item) => {
      var object = {
        title: item.name,
        subtitle: item.department,
        quantity: item.quantity,
        price: item.price,
        currency: "EUR",
        image_url: item.img,
      };
      formatted.push(object);
    });
    return formatted;
  },
  createGoogleDeliveryResponse:function(paymentIntent, returnedDetails){
    var baseListPrice = returnedDetails.listPrice;
    var userName = returnedDetails.userName;
    var listQuantity = returnedDetails.listQuantity;
    var listName = returnedDetails.listName;
    var formattedListName= listName.charAt(0).toUpperCase() + listName.slice(1);
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

console.log(JSON.stringify(deliveryAddress))
var card=new BasicCard({
      text: `__Order Summary__  \n
      🛒 ${listQuantity} Items  \n
      💳 Payment Method: ${payment_method}  \n
      🚚 Delivery Address: ${deliveryAddress}  \n`, // Note the two spaces before '\n' required for
                                   // a line break to be rendered in the card.
      subtitle: 'Total Price (incl delivery): €'+totalAmount,
      title: 'Delivery Scheduled: '+formattedListName,
      buttons:[ new Button({
        title: 'Receipt',
        url: receiptUrl,
      }),new Button({
        title: 'Delivery Info',
        url: 'https://assistant.google.com/',
      })],
      image: new Image({
        url: 'https://www.netclipart.com/pp/m/308-3089576_gropronto-grocery-delivery.png',
        alt: 'Success',
      }),
      display: 'CROPPED',
    });
    return card

  },
  createGoogleCollectionResponse:function(paymentIntent, returnedDetails){
    var baseListPrice = returnedDetails.listPrice;
    var userName = returnedDetails.userName;
    var listQuantity = returnedDetails.listQuantity;
    var listName = returnedDetails.listName;
    var formattedListName= listName.charAt(0).toUpperCase() + listName.slice(1);
    var orderElements = returnedDetails.orderElements;
    var collectionAddress = returnedDetails.collectionAddress;
    var totalAmount = paymentIntent.amount / 100;
    var receiptUrl = paymentIntent.charges.data[0].receipt_url;
    var timestamp = paymentIntent.created;
    var payment_method_details =
      paymentIntent.charges.data[0].payment_method_details;
    var payment_method =
      payment_method_details.card.brand +
      " " +
      payment_method_details.card.last4;

console.log(JSON.stringify(collectionAddress))
var card=new BasicCard({
      text: `__Order Summary__  \n
      🛒 ${listQuantity} Items  \n
      💳 Payment Method: ${payment_method}  \n
      🚚 Collection Address: ${collectionAddress}  \n`, // Note the two spaces before '\n' required for
                                   // a line break to be rendered in the card.
      subtitle: 'Total Price: €'+totalAmount,
      title: 'Collection Scheduled: '+formattedListName,
      buttons:[ new Button({
        title: 'Receipt',
        url: receiptUrl,
      }),new Button({
        title: 'Collection Info',
        url: 'https://assistant.google.com/',
      })],
      image: new Image({
        url: 'https://www.netclipart.com/pp/m/308-3089576_gropronto-grocery-delivery.png',
        alt: 'Success',
      }),
      display: 'CROPPED',
    });
    return card

  },
  formatOrderMainResponse: function (
    userDetails,
    shoppingListDetails,
    parameters,platform_type
  ) {
    console.log("format order mainresp: " + JSON.stringify(userDetails));
    console.log("shoppingListDetails: " + JSON.stringify(shoppingListDetails));

    var list_name = parameters.listName;
    var delivery_location = parameters.deliveryLocation;

    var deliveryAddress;
    if(platform_type=="google"){
      deliveryAddress= userDetails[delivery_location].formatted;
    }else{
      deliveryAddress= userDetails[delivery_location].receiptFormat;
    }
    
    var stripeCustomer_id = userDetails.stripe_customer_id;
    var userName = userDetails.name;

    var items = shoppingListDetails.items;
    var user_id = shoppingListDetails.uid;
    var listPrice = shoppingListDetails.list_price;
    var listQuantity = shoppingListDetails.list_quantity;
    var orderElements = this.formatOrderElements(items);
    var returnedDetails = {
      deliveryAddress: deliveryAddress,
      stripeCustomer_id: stripeCustomer_id,
      user_id: user_id,
      userName: userName,
      listPrice: listPrice,
      listQuantity: listQuantity,
      listName: list_name,
      orderElements: orderElements,
    };
    return returnedDetails;
  },
  formatCollectionMainResponse: function (
    userDetails,
    shoppingListDetails,
    parameters
  ) {
    //Method Differs from Order as it searches for nearest stores
    var list_name = parameters.listName;
    var collection_area = parameters.collection_area;

    var collectionAddress = userDetails[collection_area].receiptFormat;
    var stripeCustomer_id = userDetails.stripe_customer_id;
    var userName = userDetails.name;

    var items = shoppingListDetails.items;
    var user_id = shoppingListDetails.uid;
    var listPrice = shoppingListDetails.list_price;
    var listQuantity = shoppingListDetails.list_quantity;
    var orderElements = this.formatOrderElements(items);
    var returnedDetails = {
      collectionAddress: collectionAddress,
      stripeCustomer_id: stripeCustomer_id,
      user_id: user_id,
      userName: userName,
      listPrice: listPrice,
      listQuantity: listQuantity,
      listName: list_name,
      orderElements: orderElements,
    };
    return returnedDetails;
  },
};
