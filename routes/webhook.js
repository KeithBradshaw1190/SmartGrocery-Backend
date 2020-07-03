const express = require("express");
const router = express.Router();
const ordersActions = require("../actions/orders/Orders");
const axios = require("axios");
const {
  WebhookClient
} = require("dialogflow-fulfillment");
const {
  Card,
  Suggestion,
  Payload
} = require("dialogflow-fulfillment");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

//
router.post("/api/webhook", express.json(), (req, res) => {
  const agent = new WebhookClient({
    request: req,
    response: res
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
      agent.parameters["conv_order_date"]
    ];
    //Handling dynamic prompts for parameters
    let missingSlots = [];
    if (!listName) {
      missingSlots.push("listName");
    }
    if (!deliveryLocation) {
      missingSlots.push("deliveryLocation");
    }
    if (!conv_order_time) {
      missingSlots.push("conv_order_time");
    }
    if (!conv_order_date) {
      missingSlots.push("conv_order_date");
    }
    if (missingSlots.length > 0) {
      missingSlots.forEach(param => {
        if (param == "listName") {
          //Can fulfill with a getAll user list names and add suggestions
          agent.add("What saved shopping list would you like ordered?");
        }
        if (param == "deliveryLocation") {
          //Can fulfill with a getAll user list names and add suggestions
          // agent.add("What address would you like this delivered to?")
          // console.log(param + "no delivery location")
          // let payload = new Payload(agent.FACEBOOK, {
          //   text: "introText",
          //   quick_replies: [{
          //     content_type: "text",
          //     title: "Red",
          //     payload: "<POSTBACK_PAYLOAD>",
          //     image_url: "http://example.com/img/red.png"
          //   }, {
          //     content_type: "text",
          //     title: "Green",
          //     payload: "<POSTBACK_PAYLOAD>",
          //     image_url: "http://example.com/img/green.png"
          //   }]
          // });
          // agent.add(payload)

          agent.add(
            "This message is from Dialogflow's Cloud Functions for Firebase editor!"
          );
          agent.add(
            new Card({
              title: "Title: this is a card title",
              imageUrl: "https://developers.google.com/actions/assistant.png",
              text: "This is the body text of a card.  You can even use line\n  breaks and emoji! 💁",
              buttonText: "This is a button",
              buttonUrl: "https://assistant.google.com/"
            })
          );

          const fbp = {
            facebook: {
              attachment: {
                type: "template",
                payload: {
                  messaging_type: "RESPONSE",
                  message: {
                    text: "Pick a color:",
                    quick_replies: [{
                      content_type: "text",
                      title: "Red",
                      payload: "<POSTBACK_PAYLOAD>",
                      image_url: "http://example.com/img/red.png"
                    }, {
                      content_type: "text",
                      title: "Green",
                      payload: "p",
                      image_url: "http://example.com/img/green.png"
                    }]
                  }
                }
              }
            }
          }
          return agent.add(new Payload("actions-on-google", fbp, {
            sendAsMessage: true,
            rawPayload: false
          }));
        }
        if (param == "conv_order_time") {
          //Can fulfill with a getAll user list names and add suggestions
          agent.add("What time do you want this delivered at?");
        }
        if (param == "conv_order_date") {
          //Can fulfill with a getAll user list names and add suggestions
          agent.add("When should this order be delivered?");
        }
      });
    } else {
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
        id: recipientID 
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
              total_cost: totalAmount
            },
            elements: orderElements
          }
        }
      }
    };
    return facebook_payload;
  }

  //Intent Map
  let intentMap = new Map();
  intentMap.set("Default Welcome Intent", welcome);
  intentMap.set("Delivery Orders", deliveryOrders);

  agent.handleRequest(intentMap);
});

module.exports = router;