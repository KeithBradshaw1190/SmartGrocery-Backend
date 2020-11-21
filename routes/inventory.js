// Inventory Service
// Keeps track of Grocery inventory(at home) for a particular user
const inventoryController = require("../controllers/inventoryController")
const express = require("express");
const router = express.Router();

//Get customers iventory by user id
router.get("/api/inventory/:id", (req, res) => {
    var customerID = req.params.id;
    return inventoryController.showInventory(customerID).then((result)=>{
       return res.json(result)
    }).catch((err)=>{
        res.json({
            success:false,
            message:"The following error occured: "+err
        })
    })
});

//Create initial inventory for a given user ID
router.post("/api/inventory/:id", (req, res) => {
    var customerID = req.params.id;
    var inventoryData = req.body;
    return inventoryController.createInventory(customerID,inventoryData).then((result)=>{
       return res.json(result)
    }).catch((err)=>{
        res.json({
            success:false,
            message:"The following error occured: "+err
        })
    })
});

//Modify inventory for a given user ID
router.put("/api/inventory/:id", (req, res) => {
    var customerID = req.params.id;
    var changes = req.body;
    return inventoryController.updateInventory(customerID,changes).then((result)=>{
       return res.json(result)
    }).catch((err)=>{
        res.json({
            success:false,
            message:"The following error occured: "+err
        })
    })
});
module.exports = router;