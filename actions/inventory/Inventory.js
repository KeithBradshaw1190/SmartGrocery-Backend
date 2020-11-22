const firebase = require("../../firebase/firebaseInit");
const { updateInventory } = require("../controllers/inventoryController");
const { SignIn, BasicCard,Button, Image, SimpleResponse, } = require("actions-on-google");
const { json } = require("body-parser");

module.exports = {
  inventoryMain: async function (parameters, order_type, platform_type,platform_id) {


    var messengerID = "3178982578828059";
    var orderAvailiable = this.timeAvailability(order_type, scheduled_time);

    if (platform_type == "google") {
      console.log("platform type"+ platform_type)
      //Set order type & check time availability
      if (orderAvailiable) {
        //Return User details
        const userDetails = await userActions.findFirebaseUser(platform_id,platform_type);
        //Return shopping list details
        var uid = userDetails.uid;
        const shopppinglistDetails = await this.getShoppinglist(
          list_name,
          uid
        );
        var returnedDetails;

        if (order_type == "Delivery") {
          returnedDetails = this.formatOrderMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters,
            platform_type
          );
        } else if (order_type == "Collection") {
          returnedDetails = this.formatCollectionMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters
          );
        }

        console.log(
          "Returned Deatails in facebook_ordermain" + returnedDetails
        );
        return returnedDetails;
      } else {
        return "Not available";
      }
    } else {
      //Facebook Platform
      //Set order type & check time availability
      if (orderAvailiable) {
        //Return User details
        const userDetails = await this.getUser(messengerID);
        //Return shopping list details
        var uid = userDetails.uid;

        const shopppinglistDetails = await this.getShoppinglist(
          list_name,
          uid
        );
        var returnedDetails;

        if (order_type == "Delivery") {
          returnedDetails = this.formatOrderMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters
          );
        } else if (order_type == "Collection") {
          returnedDetails = this.formatCollectionMainResponse(
            userDetails,
            shopppinglistDetails,
            parameters
          );
        }

        console.log(
          "Returned Deatails in facebook_ordermain" + returnedDetails
        );
        return returnedDetails;
      } else {
        return "Not available";
      }
    }
  },






 

};
