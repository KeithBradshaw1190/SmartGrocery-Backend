const fb = require("../firebase/firebaseInit");
var FuzzySearch = require('fuzzy-search');
let userInventoryDoc = fb.db.collection("user_inventory");

module.exports = {
    createInventory: async function (userID, inventoryData) {
        var invBeforeThresh=inventoryData.current_inventory;
        for (var i = 0; i < invBeforeThresh.length; i++) {
           if (invBeforeThresh[i].threshold){
               return
           }else{
            invBeforeThresh[i].threshold=-1
           }
        }
        var inventoryExists = await this.showInventory(userID);
        if (inventoryExists.success == false) {
            console.log("Creating Inventory for user")
            var newInventory = {
                uid: userID,
                order_source: inventoryData.order_source,
                current_inventory: invBeforeThresh,
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



        return fb.db
            .runTransaction((transaction) => {
                return transaction.get(listRef).then((doc) => {
                    if (!doc.exists) {
                        throw "Document does not exist!";
                    }
                    var inventoryFromDB = doc.data().current_inventory;
                    console.log("searching for " + (productName ) + " in inventory From DB:" + JSON.stringify(inventoryFromDB));

                    //   Search for the productname
                    const searcher = new FuzzySearch(inventoryFromDB, ['title'], {
                        caseSensitive: false,
                    });
                    var productObject = searcher.search(productName);

                    console.log("productObject:" + JSON.stringify(productObject));
                    var index = productObject[0].refIndex;
                    console.log("ref:" + index);
                    var currentAmnt = (productObject[0].quantity)
                    var updatedInventory = inventoryFromDB;
                    if ((Number(currentAmnt) + changeAmount) < 0) {
                        //If the quantity is less than 0 reset it to 0
                        productObject[0].item.quantity = 0;
                        console.log("Setting Item quantity to zero as it went negative:");

                        updatedInventory[index] = productObject[0];
                    } else {
                        //Update the quantity with specified amount
                        productObject[0].quantity = (Number(currentAmnt) + changeAmount);
                        updatedInventory[index] = productObject[0];
                        console.log("Setting Item quantity to specified amount");

                    }

                        //  Compare the thresholds to decide if trigger goes off for order prompt
                        // Thresholds of -1 means not set by user
                        var itemsMeetingThreshold=[]
                        var counter=0
                        for (var i = 0; i < updatedInventory.length; i++) {
                            console.log("In for loop");

                            if ((updatedInventory[i].quantity == updatedInventory[i].threshold)||(updatedInventory[i].quantity < updatedInventory[i].threshold)) {
                                itemsMeetingThreshold.push(updatedInventory[i])
                                console.log(`Pushing ${updatedInventory[i].title}: threshold is met`)
                                counter++
                            }else{
                                console.log(`Skipping ${updatedInventory[i].title}: threshold not met`)
                            }
                        }
                        console.log("Counter "+counter)
                        // End of comparing thresholds

                        console.log("Updated Inventory From DB:" + JSON.stringify(updatedInventory));

                        transaction.update(listRef, {
                            current_inventory: updatedInventory
                        });
                        //Will need to check if it meets the threshold if so trigger a follow up asking if they want to order
                        return updatedInventory
                    

                });
            })
            .then((updatedInventory) => {
                console.log("New Inventory is: " + JSON.stringify(updatedInventory));
                return updatedInventory

            })

    }

}
