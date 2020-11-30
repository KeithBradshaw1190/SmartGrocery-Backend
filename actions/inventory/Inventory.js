const firebase = require("../../firebase/firebaseInit");
const { updateInventory } = require("../controllers/inventoryController");
const userActions = require("../actions/users/Users");
const inventoryActions = require("../controllers/inventoryController");
const { BasicCard,Button, Image, SimpleResponse } = require("actions-on-google");
const { json } = require("body-parser");

module.exports = {
  inventoryMain: async function (parameters, platform_type) {

    if (platform_type == "google") {
     
      let access_token = conv.request.user.accessToken;

      var gUser = await userActions.findGoogleUserByToken(access_token);
      user = await userActions.findFirebaseUser(gUser.sub, platform_type);
    } else {
      //Facebook Platform
   
    }
  },
  updateInventory: async function(){

    return inventoryActions.updateInventory(user.uid, changes).then((result) => {
      if (result.updated_inventory == "N/a") {
        agent.add(`Couldn't find any ${product_name} in your inventory.`);

      } else {
        if (((result.items_meeting_threshold).length > 1)&&result.quantity_of_item_left == 0) {
          agent.add(`You're all out of ${product_name}, and running low on other items. I can schedule an order or remind you later if you would like? `)

        }
        else if (result.quantity_of_item_left == 0) {
          agent.add(`You're all out of ${product_name}`)

        } else {
          agent.add(`Updated your inventory! Your ${product_name} quantity is now ${result.quantity_of_item_left}`);
          // Trigger a follow up to see if they want to re order
        }
     
      }

    }).catch((err) => {
      agent.add("An error occurred updating your inventory " + err);
    })
  }






 

};
