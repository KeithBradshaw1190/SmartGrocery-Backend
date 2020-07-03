// //Handles the upload endpoint for receipts
// //responds with a max of 5 options per each item on receipt
const express = require("express");
const router = express.Router();
const receiptFunctions = require("../receiptFunctions/receiptFunctions");
const fs = require('fs');
const multer = require('multer');


var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, __dirname+'/tmp/my-uploads')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix)
    }
  })
var upload = multer({ storage: storage })

router.post('/upload',upload.single('file'), async(req, res) => {
    // Stored file into upload directory
        //console.log(req)
        // Reading uploaded file from upload directory
        fs.readFile(__dirname+`/tmp/my-uploads/${req.file.filename}`, (err, data) => {

            // Displaying error if anything goes wrong 
            if(err) return console.error("this is error", err);

            receiptFunctions.tesseractWorker(data).then((info)=>{
                 receiptFunctions.searchForItemsTesco(info).then((products)=>{
                   // console.log("prods"+products)
                    res.json(products)

                 });
   
            
        
            });
                           
        })
   
})


module.exports = router;