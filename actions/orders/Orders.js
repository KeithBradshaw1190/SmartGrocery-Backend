const firebase = require("../../firebase/firebaseInit");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = {
  facebook_orderMain: async function(parameters) {
    var scheduled_date = parameters.conv_order_date.split("T")[0];
    var scheduled_time = parameters.conv_order_time
      .replace("Z", "")
      .split("T")[1]
      .split("+")[0];
    var list_name = parameters.listName;
    var delivery_location = parameters.deliveryLocation;
    var messengerID = "2977902935566962";

    //Set order type & check time availability
    var orderAvailiable = this.timeAvailability("Delivery", scheduled_time);
    if (orderAvailiable) {
      //Return User details
      const userDetails = await this.getUser(messengerID);
      //Return shopping list details
      const shopppinglistDetails = await this.getShoppinglist(
        list_name,
        messengerID
      );

      var returnedDetails = this.formatOrderMainResponse(
        userDetails,
        shopppinglistDetails,
        parameters
      );

      console.log(returnedDetails);
      return returnedDetails;
    } else {
      return "Not available";
    }
  },
  timeAvailability: function(order_type, time) {
    const delivery_open = "09:00:00";
    const delivery_closed = "20:00:00";
    const collection_open = "09:00:00";
    const collection_closed = "21:00:00";

    console.log("RECEIVED TIME IN TIME AVAILABILITY" + time);
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

  getShoppinglist: async function(list_name, messengerID) {
    let listRef = firebase.db.collection("shopping_lists");
    console.log("Getting shopping list");

    try {
      const snapshot = await listRef
        .where("messengerID", "==", messengerID)
        .where("listName", "==", list_name)
        .get();
      var shoppingList;
      snapshot.forEach(doc => {
        console.log("Got Shopping list");
        shoppingList = doc.data();
      });
      return shoppingList;
    } catch (err) {
      console.log("shoppingList error" + err);
    }
  },

  getUser: async function(messengerID) {
    let userRef = firebase.db.collection("users");
    console.log("Getting user");

    try {
      const snapshot = await userRef
        .where("messengerID", "==", messengerID)
        .get();
      var user;
      snapshot.forEach(doc => {
        console.log(doc.data().homeAddress);
        user = doc.data();
      });
      return user;
    } catch (err) {
      console.log("User error" + err);
      return Promise.reject("No such document");
    }
  },

  chargeCard: async function(baseListPrice, stripe_customer_id) {
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
      confirm: true
    });
    return paymentIntent;
  },
  getPaymentId: async function(stripe_customer_id) {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripe_customer_id,
      type: "card"
    });
    return paymentMethods;
  },
  formatOrderElements: function(items) {
    formatted = [];
    items.forEach(item => {
      var object = {
        title: item.name,
        subtitle: item.department,
        quantity: item.quantity,
        price: item.price,
        currency: "EUR",
        image_url: item.img
      };
      formatted.push(object);
    });
    return formatted;
  },
  formatOrderMainResponse: function(
    userDetails,
    shoppingListDetails,
    parameters
  ) {
    var list_name = parameters.listName;
    var delivery_location = parameters.deliveryLocation;

    var deliveryAddress = userDetails[delivery_location].receiptFormat;
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
      orderElements: orderElements
    };
    return returnedDetails;
  }
};
