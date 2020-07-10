const firebase = require("../../firebase/firebaseInit");
const { google } = require("googleapis");
const { Card } = require("dialogflow-fulfillment");
const customsearch = google.customsearch("v1");
module.exports = {
  facebook_recipeMain: async function (parameters) {
    const food_ingredients = parameters["food_ingredients"];
    console.log("Foor or ingredients: " + food_ingredients);
    var recipes = await this.search_recipe(food_ingredients);
    return recipes;
  },
  search_recipe: async function (food_ingredients) {
    console.log("In Function Get recipe");

    var q = food_ingredients;
    var key = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
    var cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
    console.log("query is"+q)
    return customsearch.cse
      .list({
        auth: key,
        cx: cx,
        q,
        num: 3,
      })
      .then((result) => {
        const { queries, items, searchInformation } = result.data;
        console.log("RESULT.DATA" + JSON.stringify(items));
        if (items != undefined) {
          const data = {
            items: items.map((o) => ({
              link: o.link,
              title: o.title,
              snippet: o.snippet,
              img: (((o.pagemap || {}).cse_image || {})[0] || {}).src,
            })),
          };

          var recipesArray = data.items;
      
          return recipesArray;
        } else {
          console.log("data items is not filled" + JSON.stringify(items));
        }
      })
      .catch((error) => {
        console.log("Get recipe error in catch" + error);
      });
  },
  findIngredientsFromShoppingList(parameters) {
    //Gets 2 random items from a shopping list that fall into a food department category
    //These are returned to then find a recipe
    const list_name = parameters["listname"];
    var potentialIngredients;
    const messengerID = "2977902935566962";
        console.log("List NME"+list_name)
    var departmentArray = ["Fresh Food", "Food Cupboard"];
    var listItems;
    const listDoc = firebase.db.collection("shopping_lists");
    
    return listDoc
      .where("messengerID", "==", messengerID)
      .where("listName", "==", list_name)
      .get()
      .then((snapshot) => {
        if (snapshot.empty) {
          console.log("No matching documents.");
        } else {
          snapshot.forEach((doc) => {
            console.log("Using ingredients from" + doc.data().listName);
            listItems = doc.data().items;
          });

          //Filter list items to those within food departments

           potentialIngredients = listItems.filter(function (item) {
            return departmentArray.indexOf(item.department) >= 0;
          });
          console.log("POTENTIAL INGREDIENTS"+JSON.stringify(potentialIngredients));         
        }
        let ingredientItemsAmount = potentialIngredients.length;
        console.log("ing amount"+ingredientItemsAmount)
        const randomIng1 = potentialIngredients[Math.floor(Math.random() * ingredientItemsAmount)];
        const randomIng2 = potentialIngredients[Math.floor(Math.random() * ingredientItemsAmount)];



        var ing1 = randomIng1.simpleName;
        var ing2 = randomIng2.simpleName;
        console.log("random ingredient1 =>", ing1);
        console.log("random ingredient2 =>", ing2);



        return[ing1,ing2]
      })
      .catch((err) => {
        console.log("err in findIngredientsFromShoppingList: "+err)
      });
  },

  formatRecipeResponse(agent, recipeResults) {
    console.log("results:" + recipeResults);
    var cards = [];
    recipeResults.forEach((recipe) => {
      var card = new Card(recipe.title);
      card.setImage(recipe.img);
      card.setText(recipe.snippet);
      card.setButton({
        text: "View The Recipe",
        url: recipe.link,
      });
      cards.push(card);
    });
    cards.forEach((resp) => {
      agent.add(resp);
    });
  },
};
