const fb = require("../firebase/firebaseInit");
var FuzzySearch = require('fuzzy-search');
const { json } = require("body-parser");
let userInventoryDoc = fb.db.collection("user_inventory");

module.exports = {
    createInventory: async function (userID, inventoryData) {
        //this adds a default threshold to differentiate between a user not picking a threshold
        var invBeforeThresh = inventoryData.current_inventory;
        for (var i = 0; i < invBeforeThresh.length; i++) {
            if (invBeforeThresh[i].threshold) {
                return
            } else {
                invBeforeThresh[i].threshold = -1
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
                        inventory_data: resp,
                        inventory_already_exists: false

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
                inventory_data: inventoryExists,
                inventory_already_exists: true
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
            console.log('CURRENT Document data in showInventory func :', doc.data());

            return {
                success: true,
                message: "Inventory does exist for this ID",
                inventory_data: inventoryData
            }
        }
    },
    updateSingleItem: async function (userID, changes) {
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


                    console.log("searching for " + (productName) + " in inventory From DB:" + JSON.stringify(inventoryFromDB));

                    //   Search for the productname
                    const searcher = new FuzzySearch(inventoryFromDB, ['title'], {
                        caseSensitive: false,
                    });
                    var productObject = searcher.search(productName);
                    console.log("productObject:" + JSON.stringify(productObject));

                    if (productObject === undefined || productObject.length == 0) {
                        var inventoryUpdates = {
                            updated_inventory: "N/a",
                            items_meeting_threshold: "N/a",
                            quantity_of_item_left: "N/a"
                        }
                        return inventoryUpdates
                    } else {
                        var updatedInventory = inventoryFromDB;
                        var title = productObject[0].title;
                        var index = updatedInventory.findIndex(i => i.title == title)

                        console.log("ref:" + index);
                        var currentAmnt = (productObject[0].quantity)

                        if ((Number(currentAmnt) + changeAmount) < 0) {
                            //If the quantity is less than 0 reset it to 0
                            productObject[0].quantity = 0;
                            console.log("Setting Item quantity to zero as it went negative:");

                            updatedInventory[index] = productObject[0];
                        } else {
                            //Update the quantity with specified amount
                            productObject[0].quantity = (Number(currentAmnt) + changeAmount);
                            updatedInventory[index] = productObject[0];
                            console.log("Setting Item quantity to specified amount");

                        }
                        //  Compare the thresholds to decide if trigger goes off for order prompt
                        // Thresholds of -1 means no threshold set by user
                        var itemsMeetingThreshold = []
                        var counter = 0
                        for (var i = 0; i < updatedInventory.length; i++) {
                            console.log("In for loop");

                            if ((updatedInventory[i].quantity == updatedInventory[i].threshold) || (updatedInventory[i].quantity < updatedInventory[i].threshold) || updatedInventory[i].quantity == 0) {
                                itemsMeetingThreshold.push(updatedInventory[i])
                                console.log(`Pushing ${updatedInventory[i].title}: threshold is met or quantity is zero`)
                                counter++

                            } else {
                                console.log(`Skipping ${updatedInventory[i].title}: threshold not met`)
                            }
                        }
                        console.log("Counter " + counter)
                        console.log("itemsMeetingThreshold " + itemsMeetingThreshold.length)

                        // End of comparing thresholds

                        console.log("Updated Inventory From DB:" + JSON.stringify(updatedInventory));
                        transaction.update(listRef, {
                            current_inventory: updatedInventory
                        });
                        //Will need to check if it meets the threshold if so trigger a follow up asking if they want to order
                        var inventoryUpdates = {
                            updated_inventory: updatedInventory,
                            items_meeting_threshold: itemsMeetingThreshold,
                            quantity_of_item_left: productObject[0].quantity
                        }
                        return inventoryUpdates

                    }



                });
            })
            .then((updatedInventory) => {
                console.log("New Inventory is: " + JSON.stringify(updatedInventory));
                return updatedInventory

            })

    },
    updateMultipleItems: async function (userID, newData,additionalInfo) {
        //Add a default threshold
        var inventoryToAdd = newData
        console.log("inventoryToAdd")
        console.log(inventoryToAdd)
        var newInvAfterThresh = this.addDefaultThereshold(inventoryToAdd);
        console.log("CnewInvAfterThresh")
        console.log(newInvAfterThresh)
        var fetchInventory = this.showInventory(userID);
        var currentInv = (await fetchInventory).inventory_data.current_inventory;

        //We need to match the products to add to any existing items
        var inventoryToSave = this.checkAndAdd(currentInv, newInvAfterThresh);

        console.log("inventoryToSave  " + JSON.stringify(inventoryToSave))
        //Overwite inventorywith the following document
        var completeDocument = {
            uid: userID,
            order_source: additionalInfo.order_source,
            current_inventory: inventoryToSave,
            order_submitted_on: "today",
            last_order_received_on: additionalInfo.last_order_received_on,
        };

        return userInventoryDoc.doc(userID).set(completeDocument)
            .then((resp) => {
                console.log("updateMultipleItems added!");
                return {
                    success: true,
                    message: "Inventory updated successfully: ",
                    inventory_data: resp,
                    inventory_already_exists: true

                }

            }
            )
            .catch((err) => {
                console.log(err);
                return err
            });



    },
    addDefaultThereshold(inventory) {
        var invBeforeThresh = inventory;
        console.log("Add def thresh")
        console.log(JSON.stringify(invBeforeThresh))

        for (var i = 0; i < invBeforeThresh.length; i++) {
            if (invBeforeThresh[i].threshold !== null || invBeforeThresh[i].threshold !== undefined) {
                console.log("Skipping as we got a thresh set")
                console.log(invBeforeThresh[i].threshold)
            } else {
                invBeforeThresh[i].threshold = -1
            }
        }
        return invBeforeThresh
    },
    checkAndAdd(currentInventory, newInventory) {
        

  // Merge the arrays, and set up an output array.
  const merged = [...currentInventory, ...newInventory];
  const out = [];

  // Loop over the merged array
  for (let obj of merged) {

    // Destructure the object in the current iteration to get
    // its id and quantity values
    const { title, quantity } = obj;

    // Find the object in out that has the same id
    const found = out.find(obj => obj.title === title);

    // If an object *is* found add this object's quantity to it...
    if (found) {
        console.log("Found"+found)
        console.log("Adding this quantity to the above "+quantity)

      found.quantity += Number(quantity);

    // ...otherwise push a copy of the object to out
    } else {
      out.push({ ...obj });
    }
  }
  
  return out;


}
}