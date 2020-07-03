const CustomerModel = require("../models/customers.model");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
// Import Bcrypt
const bcrypt = require("bcrypt");
const saltRounds = 10;
// Import firebase DB
const fb = require("../firebase/firebaseInit");

// Import Stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


// Read all entries
// router.get("/api/customers", (req, res) => {
//   CustomerModel.find().then(items => console.log(res.json(items)));
// });

//Get a Customer by ID
router.get("/api/customer/:id", (req, res) => {
  CustomerModel.findById({
    _id: req.params.id
  }).then(items => console.log(res.json(items)));
});

//Get a Customer by Email/Password
router.post("/api/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  console.log(email);

  //Check if customer Exists
  CustomerModel.findOne({
    email: email
  }, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        console.log(foundUser);
        bcrypt.compare(password, foundUser.password, function (err, result) {
          if (result === true) {
            res.status(200).json({
              id: foundUser.id,
              success: true
            });
          } else {
            res.sendStatus(400);
          }
        });
      }
    }
  });
});

// Add a new customer + Hash password
// router.post("/api/register", (req, res) => {
//   const email = req.body.email;
//   const password = req.body.password
//   //Check if customer Exist
//   console.log("req body" + req.body)
//   CustomerModel.findOne({
//     "email": email
//   }, (err, foundUser) => {
//     if (err) {
//       res.status(500).send(err)
//     } else {
//       //console.log(foundUser);
//       //Else Create new customer
//       if (!foundUser) {
//         bcrypt.hash(password, saltRounds, (err, hash) => {
//           if (err) {
//             console.log(err);
//           } else {
//             const customer = new CustomerModel({
//               email: req.body.email,
//               password: hash,
//               address: req.body.address
//             });
//             //Successfully created
//             customer.save()
//               .then((cust) => res.status(201).json({
//                 id: cust._id
//               }))
//               .catch((msg) => {
//                 res.status(400).json({
//                   messsage: msg
//                 })
//               });
//           }
//         });
//       } else {
//         //User exists
//         res.sendStatus(409);
//       }
//     }
//   });
// });

//Add Stripe customer id to user document(When user signs into smartgrocery)
router.post("/api/stripe_register/:id", (req, res) => {
  const id = req.params.id;
  var name = req.body.name;
  var email = req.body.email
  if (email == "") {
    email = "Not Set"
  }
  console.log("post endpoint hit")
  createCustomer = async () => {
    const customer = await stripe.customers.create({
      name: name,
      email: email,
      metadata: {
        user_id: id
      }
    });
    try {
      fb.db.collection("users")
        .doc(id)
        .set({
          stripe_customer_id: customer.id
        }, {
          merge: true
        })
        .then(() => {
          console.log("set stripe id");
          res.sendStatus(201);
        })
        .catch(err => {
          console.log("Error in stripe_register" + err.message)
          res.sendStatus(404)
        });
    } catch (error) {
      console.log("Error getting document:" + error);
    };
  }
  createCustomer();
});

//Return customer secret
router.get("/api/customer_secret/:customer_id", (req, res) => {
  console.log("cust")
  var customerID = req.params.customer_id;
  console.log(customerID);
  customerSecret = async () => {
    try {
      const intent = await stripe.setupIntents.create({
        customer: customerID,
      });
      res.json({
        client_secret: intent.client_secret
      })
    } catch (error) {
      res.send(404);
      console.log(error)
    }
  }
  customerSecret();
});

//Return All customer cards
router.get("/api/customer_cards/:customer_id", (req, res) => {
  console.log("cust")
  var customerID = req.params.customer_id;
  console.log(customerID);
  customerCards = async () => {
    try {
      const cards = await stripe.paymentMethods.list({
        customer: customerID,
        type: 'card'
      })
      console.log(JSON.stringify(cards.data));

      res.json({
        cards: cards.data
      })
    } catch (error) {
      res.send(404);
      console.log(error)
    }
  }
  customerCards();
});

//Remove a card payment method
router.delete("/api/customer_card/:pm_id", (req, res) => {
  console.log("cust")
  var paymentMethodID = req.params.pm_id;
  console.log("Payment method"+paymentMethodID);
  stripe.paymentMethods.detach(
    paymentMethodID,
    function (err, paymentMethod) {
      if (err) {
        console.log(err)
        res.send(404);

      } else {
        res.json({
          paymentMethod: paymentMethod
        })
      }
    }
  );

});

// Update Address
router.put("/api/customer/:id", (req, res) => {
  CustomerModel.findOneAndUpdate({
        _id: req.params.id
      }, {
        address: req.body.address
      }

    )
    .then(() =>
      res.status(204).json({
        success: true
      })
    )
    .catch(err =>
      res.status(404).json({
        error: err.message,
        success: false
      })
    );
});

// Delete an entry
router.delete("/api/customer/:id", (req, res) => {
  CustomerModel.findOneAndDelete({
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

module.exports = router;