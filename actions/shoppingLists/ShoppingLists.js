const firebase = require("../../firebase/firebaseInit");

module.exports = {
  async findShoppingListItemsByName(parameters) {
    const list_name = parameters["listname"];

    const messengerID = "3178982578828059";
    console.log("List NaME" + list_name);
    var listData;
    const listDoc = firebase.db.collection("shopping_lists");

    try {
      const snapshot = await listDoc
        .where("messengerID", "==", messengerID)
        .where("listName", "==", list_name)
        .get();
      if (snapshot.empty) {
        console.log("No matching documents.");
      } else {
        snapshot.forEach((doc) => {
          listData = doc.data();
        });
      }
      console.log("Items in list:" + listData);
      return listData;
    } catch (err) {
      console.log("err in findShoppingListItemsByName: " + err);
    }
  },


    async findShoppingListByFreq(parameters) {
    const purchase_frequency = parameters["purchase_frequency"];

    const messengerID = "3178982578828059";
    console.log("purchase_frequency" + purchase_frequency);
    var listName,items_arr;
    var string=""
    const listDoc = firebase.db.collection("shopping_lists");

    try {
      const snapshot = await listDoc
        .where("messengerID", "==", messengerID)
        .get();
      if (snapshot.empty) {
        console.log("No matching documents.");
      } else {
        snapshot.forEach((doc) => {
            listName = doc.data().listName;
            items_arr = doc.data().items;
            //  string = string + `📝${listName}\n`;
            items_arr.forEach(itemsDesc => {
                console.log("Item frequency is" + itemsDesc.frequency + " item name is " + itemsDesc.name + " list name " + listName);
                if (itemsDesc.frequency == purchase_frequency) {
                    console.log("Matched frequency");
                    string = string + `\u2022 ${itemsDesc.name} 𝗤𝘂𝗮𝗻𝘁𝗶𝘁𝘆: ${itemsDesc.quantity} (📝 ${listName}).\n\n`;
                    console.log(string);

                }
            });
        });
      }
      if (string == "") {
        string = "Looks you dont have any items purchased by this frequency.";
    }
    console.log(string);
    return string;
    } catch (err) {
      console.log("err in findShoppingListItemsByName: " + err);
    }
  },
  async formatFacebookShoppingListResponse(listData) {
    console.log("results:" + listData);
    var string = "";
    var elements = [];
    string =
      string +
      `📝 ${listData.listName} \nList Quantity: ${listData.list_quantity}\nTotal Cost:€${listData.list_price}\n\nList Contents:\n`;
    var items_arr = listData.items;
    items_arr.forEach((itemsDesc) => {
      string =
        string + `\n\u2022${itemsDesc.name} 𝗤𝘂𝗮𝗻𝘁𝗶𝘁𝘆: ${itemsDesc.quantity}.\n`;
    });
    return string;
  },
  async formatFacebookItemsByFreqResponse(listData,parameters) {
      var frequency_param = parameters["purchase_frequency"]
    console.log("results:" + listData);
    var string = "";
    var elements = [];
    string =
      string +
      `📝 ${listData.listName} \nList Quantity: ${listData.list_quantity}\nTotal Cost:€${listData.list_price}\n\nList Contents:\n`;
    var items_arr = listData.items;
    items_arr.forEach((itemsDesc) => {

        if (itemsDesc.frequency == frequency_param) {
            console.log("Matched frequency");
            string = string + `\u2022 ${itemsDesc.name} 𝗤𝘂𝗮𝗻𝘁𝗶𝘁𝘆: ${itemsDesc.quantity} (📝 ${listName}).\n\n`;
            console.log(string);

        }
    
    });
    return string;
  },
};
