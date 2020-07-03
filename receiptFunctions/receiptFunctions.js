const { createWorker } = require("tesseract.js");
const axios = require("axios");
const { response } = require("express");
// Performs label detection on the image file
// var fileName = "./receiptImages/receipt.jpg";
const worker = createWorker({
  logger: (m) => console.log(m), // Add logger here
});
module.exports = {
  tesseractWorker: async function (image) {
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const {
      data: { text },
    } = await worker.recognize(image);

    //console.log(text.replace(/\n\s*\n/g, "\n"));
    var output = [];
    var arr = text.split(/\r\n|\r|\n/);
    arr.forEach((val) => {
      output.push(
        val.replace(/\'/g, "").replace("\n", "").split(/(\d+)/).filter(Boolean)
      );
    });

    await worker.terminate();
    var afterTerminate = this.process(output);
    console.log("After termininate" + afterTerminate);
    return afterTerminate;
  },

  process: function (output) {
    var products = [];
    output.forEach((arr) => {
      if (arr[1] != undefined) {
        arr.splice(0, 1);

        var match = arr[0].match(/^\D*$/);
        arr.splice(0, 1);

        //   var price = arr.match(/^\d{0,8}(\.\d{1,4})?$/);
        if (match != null) {
          match = match.toString().replace(/[&\/\\#,+()$~%'":*?<>{} ]/, "");
          if (match != " ") {
            products.push(match);
          }
        }

        //     var mergedArray = arr.join();
        //     mergedArray = mergedArray.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");
        //   console.log("remaining  " + mergedArray);
      }
    });
    return products;
  },
  searchForItemsTesco: async function(productArr) {
    var promises = [];
    var shopping=[]
    productArr.forEach((product) => {
      if (!(product.trim().length == 0)) {
        promises.push(
          axios.get(
            `https://dev.tescolabs.com/grocery/products/?query=${product}&offset=0&limit=5`,
            {
              headers: {
                "Ocp-Apim-Subscription-Key": process.env.TESCO_API_KEY,
              },
            }
          ).then((shopResp)=>{
      
              shopping.push({[product]:shopResp.data.uk.ghs.products.results})

          })
        );
      }
    });
    return Promise.all(promises).then(() => {
      var responseArray=[];
      shopping.forEach((shop)=>{
        console.log(shop)
      responseArray.push(shop);
      });
return responseArray
     });
  },
};
