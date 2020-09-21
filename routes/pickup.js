// const PickupModel = require("../models/pickup.model");
const PickupModelUpdate = require("../models/pickup.model_update");

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const fb = require("../firebase/firebaseInit");
//24 Hour Clock(7am to 9pm)
var hour = new Date().getHours();
var pickup_open = "07:00:00";
var pickup_closed = "21:00:00";

// Read all entries
// router.get("/api/pickup", (req, res) => {
//     PickupModel.find()
//         .sort({
//             date: -1
//         })
//         .then(items => console.log(res.json(items)));
// });

//Get a pickup by ID
router.get("/api/pickup/:id", (req, res) => {
    PickupModelUpdate.findById({
        _id: req.params.id
    }).then(items => console.log(res.json(items)));
});
//Get most recent pickup by customer_id
router.get("/api/pickup/customer/:id", (req, res) => {
    PickupModelUpdate.find({
        customer_id: req.params.id
    }).sort({
        "updatedAt": -1
    }).limit(1).then(items => console.log(res.json(items)));
});
//Get ALL pickups by customer_id
router.get("/api/pickup/all/customer/:id", (req, res) => {
    var arr = [];
    PickupModel.find({
        customer_id: req.params.id
    }).sort({
        "updatedAt": -1
    }).then(pickups => {
        arr = pickups
        arr.sort(function (a, b) {
            return (a.customer_id - b.customer_id);
        });

        // delete all duplicates from the array
        for (var i = 0; i < arr.length - 1; i++) {
            if ((arr[i].pickup_time == arr[i + 1].pickup_time) && (arr[i].pickup_date == arr[i + 1].pickup_date)) {
                delete arr[i];
                //console.log("deleting");
            }
        }

        // remove the "undefined entries"
        arr = arr.filter(function (el) {
            return (typeof el !== "undefined");
        });
        res.json(arr);
    });


});

// Time Period available for pickup
router.get("/api/pickup-time", (req, res) => {
    res.send({
        pickupOpen: pickup_open,
        pickupClosed: pickup_closed
    });
});


//Endpoint to handle pickup payments from Dialog flow
router.post("/api/pickup/:user_id", async (req, res, next) => {
    var userID = req.params.user_id;
    var listName = req.body.list_name;
    var pickup_time = req.body.pickup_time;
    var pickup_date = req.body.pickup_date;
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
            
                        console.log("Payment before" + paymentAmount)
                        var transferAmount = paymentAmount 
                        //add smartgrocery charge (1.5%) and flat rate of €1 if over €100 
                        if (paymentAmount > 100) {
                            sgCharge = ((paymentAmount / 100) * 1.5) + 1
                        } else {
                            sgCharge = 1
                        }
                        paymentAmount = sgCharge + paymentAmount
                        paymentAmount = Number(paymentAmount.toFixed(2)) * 100
                        console.log("Payment Total: " + paymentAmount +
                            " SmartGrocery Charge: " + sgCharge )
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
});

//Endpoint to handle saving pickup where payment is done already
router.post("/api/pickup/save/:user_id", async (req, res, next) => {
    
    var userID = req.params.user_id;
    await addPickupToDB (userID, req.body).then((pickup) => {
       var paymentAmount = (Number(pickup.pickup_price)) +  (Number(req.body.order_price).toFixed(2)*100);
       pickup.order_price = (Number(req.body.order_price).toFixed(2)*100);
       pickup.total_price =paymentAmount;
        pickup.payment_status = "Success"
        pickup.save().then(() => {
            res.json({
                message: "pickup scheduled successfully"
            }
            )
        }).catch((err)=>{
            res.json({
                message: "pickup schedule error: "+err
            }
            )
        });
    })
});

//Endpoint to handle pickup payments from UI
router.post("/api/pickup/full_process/:user_id", async (req, res, next) => {
    console.log("Yo this is the order+price " +req.body.order_price)
    var userID = req.params.user_id;
    await addpickupToDB (userID, req.body).then((pickup) => {
        var paymentAmount = 100+ (Number(req.body.order_price).toFixed(2)*100)
        pickup.order_price = (Number(req.body.order_price).toFixed(2)*100);
        pickup.total_price =paymentAmount;
        pickup.payment_status = "Not Started"
        console.log("pickup Obj "+pickup)
        console.log("pickup paymentAmount  "+paymentAmount)

       // var paymentAmount = Number(12.00) * 100

        return getStripeCustomerID(userID).then(stripeCustomerID => {
            pickup.payment_status = "Pending"

            var paymentMethodId;
            getPaymentId(stripeCustomerID).then((response) => {
                pickup.payment_status = "In Progress"
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
                        pickup.payment_status = "Success"
                        // res.sendStatus(201)
                    } else {
                        console.log('Payment did not succeed  ' + paymentIntent.status)
                        pickup.payment_status = "Failed"

                        // res.json(paymentIntent.status)
                    }
                    pickup.save().then(() => {
                        if (pickup.payment_status == "Failed") {
                            res.json({
                                message: "Payment Error",
                                information:paymentIntent
                            }
                            )
                        } else if (pickup.payment_status == "Success") {
                            res.json({
                                message: "Payment Success",
                                receipt:paymentIntent.charges.data[0].receipt_url

                            }
                            )
                        } else {
                            console.log("Something odd happened in payment: " + pickup.payment_status);
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


// Add a new entry
// router.post("/api/pickup/:customer_id", (req, res) => {
//     console.log(res.body);
//     var pickup = new PickupModelUpdate({
//         customer_id: req.params.customer_id,
//         list_name: req.body.list_name,
//         pickup_time: req.body.pickup_time,
//         pickup_date: req.body.pickup_date,
//         messengerID: req.body.messengerID
  //  });
    // Parse and format date/time for pickup
    //time.split(t)
    //make a get request to firbase for the shopping list
    //We need to access thefirebase db
    // var firebaseUID = pickup.firebaseUID;
    // var listName = pickup.list_name
    // var list_items = [];
    //console.log(pickup);
    // let listRef = fb.db.collection("shopping_lists");

    // grabUserData = async () => {
    //     console.log("grabbing user data");
    //     console.log(pickup)
    //     var messengerID = pickup.messengerID;
    //     var listName = pickup.list_name
    //     // var list_items = [];
    //     let listRef = fb.db.collection("shopping_lists");
    //     try {
    //         listRef.where("messengerID", "==", messengerID).where("listName", "==", listName).get()
    //             .then(snapshot => {
    //                 if (snapshot.empty) {
    //                     res.sendStatus(404);
    //                     console.log("No matching documents.");
    //                     return;
    //                 } else {
    //                     snapshot.forEach(d => {
    //                         console.log(d.data())
    //                         pickup.items_in_list = d.data().items;
    //                         pickup.order_price = d.data().list_price;
    //                         pickup.list_quantity = d.data().list_quantity
    //                         pickup.save().then(item => res.sendStatus(201));

    //                     })
    //                 }
    //             });
    //     } catch (error) {
    //         console.log("Error getting document:", error);
    //     };
    // }
    // grabUserData();
    // console.log(pickup)

//});

// Delete an entry
router.delete("/api/pickup/:id", (req, res) => {
    PickupModelUpdate.findOneAndDelete({
            _id: req.params.id
        })
        .then(() =>
            res.json({
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
router.put("/api/pickup/:id", (req, res) => {
    PickupModelUpdate.findOneAndUpdate({
                _id: req.params.id
            },
            req.body
        )
        .then(() =>
            res.json({
                success: true
            })
        )
        .catch(err =>
            res.status(404).json({
                success: false
            })
        );
});
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
async function addPickupToDB(userID, data) {
    var response;
    // var order_info_name = data.order_info.name;
    // var order_info_type = data.order_info.type;
    console.log("DaTA received "+JSON.stringify(data))
    var orderInfo = data.order_info;
    var orderSource = data.order_source;
    var pickupTime = data.pickup_time;
    var pickupDate = data.pickup_date;
    var itemQuantity = data.items_quantity;
    var messengerID = data.messengerID;
var orderPrice= data.order_price
    var recipeProductsObj = data.items_info
    var pickupPrice = Number(1.50)*100;


    var pickup = new pickupModelUpdate({
        customer_id: userID,
        order_source: orderSource,
        order_info: orderInfo,
        items_info: recipeProductsObj,
        pickup_time: pickupTime,
        pickup_date: pickupDate,
        items_quantity: itemQuantity,
        order_price:orderPrice,
       
    });

    return pickup;
}
module.exports = router;