const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId

const PickupSchemaUpdate = new mongoose.Schema({
    pickup_id: ObjectId,
    customer_id: String,
    order_source:String,
    order_info:Object,
    payment_status:String,
    items_info: Array,
    pickup_time: String,
    pickup_date: String,
    order_price: Number,
    total_price:Number,
    items_quantity:Number
    
}, {
    timestamps: true
});

module.exports = mongoose.model("Pickup", PickupSchemaUpdate);
// order_source refers to where the order originates, eg the platform(FB,Google Assistant, Website or APP)
// order_info is an object{type:either shopping list or recipe, name:either list name or recipe name}
//


