const PickupModel = require("../models/pickup.model");
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
    PickupModel.findById({
        _id: req.params.id
    }).then(items => console.log(res.json(items)));
});
//Get most recent pickup by customer_id
router.get("/api/pickup/customer/:id", (req, res) => {
    PickupModel.find({
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

// Add a new entry
router.post("/api/pickup/:customer_id", (req, res) => {
    console.log(res.body);
    var pickup = new PickupModel({
        customer_id: req.params.customer_id,
        list_name: req.body.list_name,
        pickup_time: req.body.pickup_time,
        pickup_date: req.body.pickup_date,
        messengerID: req.body.messengerID
    });
    // Parse and format date/time for pickup
    //time.split(t)
    //make a get request to firbase for the shopping list
    //We need to access thefirebase db
    // var firebaseUID = pickup.firebaseUID;
    // var listName = pickup.list_name
    // var list_items = [];
    //console.log(pickup);
    // let listRef = fb.db.collection("shopping_lists");

    grabUserData = async () => {
        console.log("grabbing user data");
        console.log(pickup)
        var messengerID = pickup.messengerID;
        var listName = pickup.list_name
        // var list_items = [];
        let listRef = fb.db.collection("shopping_lists");
        try {
            listRef.where("messengerID", "==", messengerID).where("listName", "==", listName).get()
                .then(snapshot => {
                    if (snapshot.empty) {
                        res.sendStatus(404);
                        console.log("No matching documents.");
                        return;
                    } else {
                        snapshot.forEach(d => {
                            console.log(d.data())
                            pickup.items_in_list = d.data().items;
                            pickup.order_price = d.data().list_price;
                            pickup.list_quantity = d.data().list_quantity
                            pickup.save().then(item => res.sendStatus(201));

                        })
                    }
                });
        } catch (error) {
            console.log("Error getting document:", error);
        };
    }
    grabUserData();
    console.log(pickup)

});

// Delete an entry
router.delete("/api/pickup/:id", (req, res) => {
    PickupModel.findOneAndDelete({
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
    PickupModel.findOneAndUpdate({
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

module.exports = router;