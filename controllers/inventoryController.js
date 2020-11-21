const fb = require("../firebase/firebaseInit");
var FuzzySearch = require('fuzzy-search');
let userInventoryDoc = fb.db.collection("user_inventory");

module.exports = {
    createInventory: async function (userID, inventoryData) {

        var inventoryExists = await this.showInventory(userID);
        if (inventoryExists.success == false) {
            console.log("Creating Inventory for user")
            var newInventory = {
                uid: userID,
                order_source: inventoryData.order_source,
                current_inventory: inventoryData.current_inventory,
                order_submitted_on: inventoryData.order_submitted_on,
                order_received_on: inventoryData.order_received_on,
            };

            return userInventoryDoc.doc(userID).set(newInventory)
                .then((resp) => {
                    console.log("newInventory added!");
                    return {
                        success: true,
                        message: "Inventory created successfully: ",
                        docID: resp
                    }

                }
                )
                .catch((err) => {
                    console.log(err);
                    return err
                });
        } else {
            console.log("Inventory for user already exists")

            return {
                success: false,
                message: "Inventory already exists for this ID",
            }
        }


    },
    showInventory: async function (userID) {
        let listRef = userInventoryDoc.doc(userID);
        const doc = await listRef.get();

        if (!doc.exists) {
            console.log('No such document!');
            return {
                success: false,
                message: "No inventory exists for this ID"
            }
        } else {
            var inventoryData = doc.data();
            console.log('Document data:', doc.data());

            return {
                success: true,
                message: "Inventory does exist for this ID",
                inventory_data: inventoryData
            }
        }
    },
    updateInventory: async function (userID, changes) {
        var productName = changes.product_name;
        var changeAmount = changes.change_amount;

        //list ref to this specific users inventory document
        let listRef = userInventoryDoc.doc(userID);
        // const decrement = firebase.firestore.FieldValue.increment(-1);
        // const increment = firebase.firestore.FieldValue.increment(1);



        // db.runTransaction(function(transaction) {
        //     return transaction.get(listRef).then(function(doc) {
        //         if (!doc.exists) {
        //             throw "Document does not exist!";
        //         }

        //         var newPopulation = doc.data().population + 1;
        //         if (newPopulation <= 1000000) {
        //             transaction.update(listRef, { population: newPopulation });
        //             return newPopulation;
        //         } else {
        //             return Promise.reject("Sorry! Population is too big.");
        //         }
        //     });
        // }).then(function(newPopulation) {
        //     console.log("Population increased to ", newPopulation);
        // }).catch(function(err) {
        //     // This will be an "population is too big" error.
        //     console.error(err);
        // });


        return fb.db
            .runTransaction((transaction) => {
                return transaction.get(listRef).then((doc) => {
                    if (!doc.exists) {
                        throw "Document does not exist!";
                    }
                    var inventoryFromDB = doc.data().current_inventory;
                    console.log("searching for "+(productName+changeAmount)+" in inventory From DB:" + JSON.stringify(inventoryFromDB));

                    //   Search for the productname
                    const searcher = new FuzzySearch(inventoryFromDB, ['item.name'], {
                        caseSensitive: false,
                      });
                      var productObject = searcher.search(productName);

                  console.log("productObject:" + JSON.stringify(productObject));
                 var index= productObject[0].refIndex;
                 console.log("ref:" + index);
                var currentAmnt=(productObject[0].item.quantity)
                 var updatedInventory=inventoryFromDB;
                 if((Number(currentAmnt)+changeAmount)<0){
                    
                 }else{
                    productObject[0].item.quantity=(Number(currentAmnt)+changeAmount);
                    console.log("amnt:" +  (Number(currentAmnt)+changeAmount))
                    
 
                    console.log("productObject:" + JSON.stringify(productObject));
 
                    updatedInventory[index]=productObject[0];
                     //  Compare the thresholds to decide if trigger
                     // for (var i = 1; i < arr.length; i++) {
                     //     if (arr[i].a !== arr[0].a || arr[i].b !== arr[0].b) {
                     //         return false;
                     //     }
                     // }
                     // return true;
                     // End of compaaring thresholds
                     
                     console.log("Updated Inventory From DB:" + JSON.stringify(updatedInventory));
 
                     transaction.update(listRef, {
                         current_inventory: updatedInventory
                     });
                     //Will need to check if it meets the threshold if so trigger a follow up asking if they want to order
                     return updatedInventory
                 }
                  
                });
            })
            .then((updatedInventory) => {
                console.log("New Inventory is: " + JSON.stringify(updatedInventory));

            })

    }

}
