// const DeliveryModel = require("../models/delivery.model");
const DeliveryModelUpdate = require("../models/delivery.model_update");

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const fb = require("../firebase/firebaseInit");
const e = require("express");
// Import Stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//24 Hour Clock(7am to 9pm)
var hour = new Date().getHours();
var delivery_open = "07:00:00";
var delivery_closed = "21:00:00";

// Read all entries
// router.get("/api/delivery", (req, res) => {
//     DeliveryModel.find()
//         .sort({
//             date: -1
//         })
//         .then(items => console.log(res.status(200).json(items)));
// });

//Get a delivery by deliveryID
router.get("/api/delivery/:id", (req, res) => {
    DeliveryModel.findById({
        _id: req.params.id
    }).then(items => console.log(res.json(items)));
});
//Get most recent delivery by customerid
router.get("/api/delivery/customer/:id", (req, res) => {
    DeliveryModel.find({
        customer_id: req.params.id
    }).sort({
        "updatedAt": -1
    }).limit(1).then(items => console.log(res.json(items)));
});

//Get ALL deveries by customerid
router.get("/api/delivery/all/customer/:id", (req, res) => {
    var arr = [];
    DeliveryModel.find({
        customer_id: req.params.id
    }).sort({
        "updatedAt": -1
    }).then(deliveries => {
        arr = deliveries
        arr.sort(function (a, b) {
            return (a.customer_id - b.customer_id);
        });

        // delete all duplicates from the array
        for (var i = 0; i < arr.length - 1; i++) {
            if ((arr[i].delivery_time == arr[i + 1].delivery_time) && (arr[i].delivery_date == arr[i + 1].delivery_date)) {
                delete arr[i];
                // console.log("deleting");
            }
        }

        // remove the "undefined entries"
        arr = arr.filter(function (el) {
            return (typeof el !== "undefined");
        });
        res.json(arr);
    });


});

// Time Period available for delivery
router.get("/api/delivery-time", (req, res) => {
    res.send({
        deliveryOpen: delivery_open,
        deliveryClosed: delivery_closed
    });
});

//Endpoint to handle delivery payments from UI
router.post("/api/delivery/full_process/:user_id", async (req, res, next) => {
    console.log("Yo this is the order+price " +req.body.order_price)
    var userID = req.params.user_id;
    await addDeliveryToDB (userID, req.body).then((delivery) => {
        var paymentAmount = (Number(delivery.delivery_price)) +  (Number(req.body.order_price).toFixed(2)*100)
        delivery.order_price = (Number(req.body.order_price).toFixed(2)*100);
        delivery.total_price =paymentAmount;
        delivery.payment_status = "Not Started"
        console.log("Delivery Obj "+delivery)
        console.log("Delivery paymentAmount  "+paymentAmount)

       // var paymentAmount = Number(12.00) * 100

        return getStripeCustomerID(userID).then(stripeCustomerID => {
            delivery.payment_status = "Pending"

            var paymentMethodId;
            getPaymentId(stripeCustomerID).then((response) => {
                delivery.payment_status = "In Progress"
                console.log("THE RES" + JSON.stringify(response));
                paymentMethodId = response.data[0].id;
                console.log("payment method in statement " + paymentMethodId)
                //Creeate the recipe order in DB
                stripe.paymentIntents.create({
                    amount: paymentAmount,
                    currency: 'eur',
                    customer: stripeCustomerID,
                    payment_method: paymentMethodId,
                    off_session: true,
                    confirm: true,
                }).then((paymentIntent) => {
                    console.log("PaymentIntent: " + JSON.stringify(paymentIntent))
                    // Pass the failed PaymentIntent to your client from your server
                    if (paymentIntent.status === 'succeeded') {
                        console.log('Payment succeeded')
                        delivery.payment_status = "Success"
                        // res.sendStatus(201)
                    } else {
                        console.log('Payment did not succeed  ' + paymentIntent.status)
                        delivery.payment_status = "Failed"

                        // res.json(paymentIntent.status)
                    }
                    delivery.save().then(() => {
                        if (delivery.payment_status == "Failed") {
                            res.json({
                                message: "Payment Error",
                                information:paymentIntent
                            }
                            )
                        } else if (delivery.payment_status == "Success") {
                            res.json({
                                message: "Payment Success",
                                receipt:paymentIntent.charges.data[0].receipt_url

                            }
                            )
                        } else {
                            console.log("Something odd happened in payment: " + delivery.payment_status);
                        }
                    }).catch((err) => {
                        res.json({
                            message: "Error Occured: " + err
                        }
                        )
                    })
                }).catch((err) => {
                    console.log('Error in  paymentIntents ' + err);

                    // res.sendStatus(400).json(err);
                });
            }).catch((err) => {
                console.log("Err when calling getPaymentId: " + err)
            });

        }).catch((err) => {
            console.log("Err when calling getStripeCustomerID: " + err)
        });
    })
});



//Endpoint to handle saving delivery where payment is done already
router.post("/api/delivery/save/:user_id", async (req, res, next) => {
    
    var userID = req.params.user_id;
    await addDeliveryToDB (userID, req.body).then((delivery) => {
       var paymentAmount = (Number(delivery.delivery_price)) +  (Number(req.body.order_price).toFixed(2)*100);
       delivery.order_price = (Number(req.body.order_price).toFixed(2)*100);
       delivery.total_price =paymentAmount;
        delivery.payment_status = "Success"
        delivery.save().then(() => {
            res.json({
                message: "Delivery scheduled successfully"
            }
            )
        }).catch((err)=>{
            res.json({
                message: "Delivery schedule error: "+err
            }
            )
        });
    })
});

//Endpoint to handle delivery payments from Dialog flow
router.post("/api/delivery/:user_id", async (req, res, next) => {
    var userID = req.params.user_id;
    var listName = req.body.list_name;
    var delivery_time = req.body.delivery_time;
    var delivery_date = req.body.delivery_date;
    var messengerID = req.body.messengerID;
    let listRef = fb.db.collection("shopping_lists");
    var listObject;
    var stripe_customer_id;
    try {
        listRef.where("messengerID", "==", messengerID).where("listName", "==", listName).get()
            .then(snapshot => {
                if (snapshot.empty) {
                    res.sendStatus(404);
                    console.log("No matching documents.");
                    return;
                } else {
                    snapshot.forEach(d => {
                        listObject = {
                            listID: d.id,
                            list_price: d.data().list_price,
                            list_quantity: d.data().list_quantity
                        }

                    })
                }
                console.log("LIST OBJECT in function" + JSON.stringify(listObject))
                let listRef = fb.db.collection("users").doc(userID);
                listRef.get()
                    .then(doc => {
                        if (!doc.exists) {
                            console.log('No such document!');
                            return
                        } else {
                            stripe_customer_id = doc.data().stripe_customer_id

                        }
                        console.log('in function Stripe customer_id: ' + stripe_customer_id);
                        //Set Payment amounts(paymentAmount-the total to charge to a customer)
                        var paymentAmount = Number(listObject.list_price)
                        var deliveryAmount = 0;
                        var sgCharge;
                        console.log("Payment before" + paymentAmount)
                        var transferAmount = paymentAmount + deliveryAmount
                        //add smartgrocery charge (1.5%) and flat rate of €1 if over €100 
                        if (paymentAmount > 100) {
                            sgCharge = ((paymentAmount / 100) * 1.5) + 1
                        } else {
                            sgCharge = 1
                        }
                        paymentAmount = sgCharge + deliveryAmount + paymentAmount
                        paymentAmount = Number(paymentAmount.toFixed(2)) * 100
                        console.log("Payment Total: " + paymentAmount +
                            " SmartGrocery Charge: " + sgCharge + " delivery amount: " + deliveryAmount)
                        //End of set payment amounts
                        var paymentMethodId;
                        getPaymentId(stripe_customer_id).then((response) => {
                            console.log("THE RES" + JSON.stringify(response));
                            paymentMethodId = response.data[0].id;
                            console.log("payment method in statement " + paymentMethodId)

                            stripe.paymentIntents.create({
                                amount: paymentAmount,
                                currency: 'eur',
                                customer: stripe_customer_id,
                                payment_method: paymentMethodId,
                                off_session: true,
                                confirm: true,
                            }).then((paymentIntent) => {
                                //console.log("PaymentIntent" + JSON.stringify(paymentIntent))
                                // Pass the failed PaymentIntent to your client from your server
                                if (paymentIntent.status === 'succeeded') {
                                    console.log('succeeded')
                                    res.sendStatus(201)
                                } else {
                                    console.log('else ' + paymentIntent.status)
                                    res.json(paymentIntent.status)
                                }

                            }).catch((err) => {
                                console.log('Error' + err);

                                // res.sendStatus(400).json(err);
                            });



                        });


                        // **Transfer**
                        // const paymentIntent = await stripe.paymentIntents.create({
                        //     payment_method_types: ['card'],
                        //     amount: paymentAmount,
                        //     currency: 'eur',
                        //     transfer_data: {
                        //         amount: transferAmount,
                        //         destination: '{{CONNECTED_STRIPE_ACCOUNT_ID}}',
                        //     },
                        // });
                    })
                    .catch(err => {
                        console.log('Error getting document', err);
                        return;
                    });

            });
    } catch (error) {
        console.log("Error getting document:" + error);
    };
    // try {
    //     await grabUserData(userID).then((userd) => {
    //         console.log("TRY" + userd);
    //         res.json({
    //             userd: userd
    //         });
    //     });


    // } catch (error) {
    //     return next(error)
    // }

    // return grabListData(messengerID, listName).then((value) => {

    // })
    // var listDetails = grabListData(messengerID, listName);
    // var stripe_customer_id = grabUserData(userID);
    // grabListData("address", function (listDetails) {
    //     alert(location); // this is where you get the return value
    // });

    // res.json({
    //     listDetails: listDetails,
    //     stripe_customer_id: stripe_customer_id
    // });


    // //We can then save these details to the delivery document
    // db.collection("deliveries")
    //     .add({
    //         user_id: userID,
    //         list_id: listID,
    //         listName: listName.toLowerCase(),
    //         messenger_id: messengerID,
    //         deliveryTime: delivery_time,
    //         deliveryDate: delivery_date,
    //         listPrice: listDetails.listPrice,
    //         listQuantity: listDetails.listQuantity,
    //         totalPrice: totalPrice
    //     })
    //     .then(docRef => {
    //         //Maybe return docref.id to display all details to a user?

    //     })
    //     .catch(err => {
    //         //this.$router.push({ name: "groceryLists", params: { id: id } });

    //     });
    //
});
// Add a new entry
// router.post("/api/delivery/:customer_id", (req, res) => {
//     console.log(req.body);
//     var delivery = new DeliveryModel({
//         customer_id: req.params.customer_id,
//         list_name: req.body.list_name,
//         delivery_time: req.body.delivery_time,
//         delivery_date: req.body.delivery_date,
//         messengerID: req.body.messengerID
//     });

//     grabUserData = async () => {
//         console.log("grabbing user data");
//         console.log("MessengerID" + delivery.messengerID)
//         var messengerID = delivery.messengerID;
//         var listName = delivery.list_name
//         // var list_items = [];
//         let listRef = fb.db.collection("shopping_lists");
//         try {
//             listRef.where("messengerID", "==", messengerID).where("listName", "==", listName).get()
//                 .then(snapshot => {
//                     if (snapshot.empty) {
//                         res.sendStatus(404);
//                         console.log("No matching documents.");
//                         return;
//                     } else {
//                         snapshot.forEach(d => {
//                             console.log(d.data())
//                             delivery.items_in_list = d.data().items;
//                             delivery.order_price = d.data().list_price;
//                             delivery.list_quantity = d.data().list_quantity
//                             delivery.save()
//                                 .then(() => res.send(201))
//                                 .catch(() => res.send(404));

//                         })
//                     }
//                 });
//         } catch (error) {
//             console.log("Error getting document:" + error);
//         };
//     }
//     grabUserData();
//     console.log(delivery)
// console.log(gr)
// delivery.items_in_list = grabUserData
// delivery.save().then(item => res.json(item));

// let query = listRef
//     .where("uid", "==", firebaseUID)
//     .where("listName", "==", listName)
//     .get()
//     .then(snapshot => {
//         if (snapshot.empty) {
//             console.log("No matching documents.");
//             return;
//         }

//         snapshot.forEach(doc => {

//             console.log(doc.id, "=>", doc.data().items);
//             // this.delivery.items_in_list.push(doc.data().items);
//             return list_items;
//         });
//     })
//     .catch(err => {
//         console.log("Error getting documents", err);
//     });
// if (query.doc.exists) return query.data().items;
//console.log(list_items);
// delivery.items_in_list.push(list_items[0]);

// if (
//     delivery.delivery_time >= delivery_open &&
//     delivery.delivery_time <= delivery_closed
// ) {
//     delivery.save().then(item => res.json(item));
// } else {
//     res.json({
//         timesAvailable: "7AM-9PM"
//     });
// }
//});

// Delete an entry
router.delete("/api/delivery/:id", (req, res) => {
    DeliveryModel.findOneAndDelete({
        _id: req.params.id
    })
        .then(() =>
            res.status(200).json({
                success: true
            })
        )
        .catch(err =>
            res.status(404).json({
                success: false
            })
        );
});

// Update an entry
router.put("/api/delivery/:id", (req, res) => {
    DeliveryModel.findOneAndUpdate({
        _id: req.params.id
    },
        req.body
    )
        .then(() =>
            res.status(204).json({
                success: true
            })
        )
        .catch(err =>
            res.status(404).json({
                success: false
            })
        );
});

function getPaymentId(stripe_customer_id) {
    const paymentMethods = stripe.paymentMethods.list({
        customer: stripe_customer_id,
        type: 'card'
    });
    return paymentMethods
};
function getProductsFromDB(orderInfo, userID) {
    var listRef;
    var listObject;

    listRef = fb.db.collection("shopping_lists");
    listRef.where("userID", "==", userID).where("listName", "==", orderInfo.name).get()
        .then(snapshot => {
            if (snapshot.empty) {
                res.sendStatus(404);
                console.log("No matching documents.");
                return;
            } else {
                snapshot.forEach(d => {
                    listObject = {
                        listID: d.id,
                        list_price: d.data().list_price,
                        list_quantity: d.data().list_quantity
                    }

                })
            }
        }).catch((err) => {
            res.sendStatus(404);
            console.log("DB Err " + err);
        })


}

function getStripeCustomerID(userID) {
    var stripe_customer_id;
    let listRef = fb.db.collection("users").doc(userID);
    return listRef.get()
        .then((doc) => {
            if (!doc.exists) {
                console.log('No such document!');

            } else {
                stripe_customer_id = doc.data().stripe_customer_id

            }
            console.log(" customer id " + stripe_customer_id)
            return stripe_customer_id;
        }

        ).catch((err) => {
            console.log("error in getStripeCustomerID " + err);
            res.json({
                messenge: "Error getting Stripe Customer ID " + err
            })
        })

}
async function addDeliveryToDB(userID, data) {
    var response;
    // var order_info_name = data.order_info.name;
    // var order_info_type = data.order_info.type;
    console.log("DaTA received "+JSON.stringify(data))
    var orderInfo = data.order_info;
    var orderSource = data.order_source;
    var deliveryTime = data.delivery_time;
    var deliveryDate = data.delivery_date;
    var itemQuantity = data.items_quantity;
    var messengerID = data.messengerID;

    var recipeProductsObj = data.items_info
    var deliveryPrice = Number(1.50)*100;


    var delivery = new DeliveryModelUpdate({
        customer_id: userID,
        order_source: orderSource,
        order_info: orderInfo,
        items_info: recipeProductsObj,
        delivery_time: deliveryTime,
        delivery_date: deliveryDate,
        delivery_price: deliveryPrice,
        items_quantity: itemQuantity,
        messengerID: messengerID
    });

    return delivery;
}
module.exports = router;