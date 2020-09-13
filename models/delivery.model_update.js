const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId

const DeliverySchemaUpdate = new mongoose.Schema({
    delivery_id: ObjectId,
    customer_id: String,
    order_source:String,
    order_info:Object,
    payment_status:String,
    items_info: Array,
    delivery_time: {
        type: String
    },
    delivery_date: {
        type: String
    },
    order_price: {
        type: Number
    },
    delivery_price: {
        type: Number
    },
    total_price:Number,
    items_quantity: {
        type: Number
    },
    messengerID: String
}, {
    timestamps: true
});

module.exports = mongoose.model("Delivery", DeliverySchemaUpdate);
// order_source refers to where the order originates, eg the platform(FB,Google Assistant, Website or APP)
// order_info is an object{type:either shopping list or recipe, name:either list name or recipe name}
//
