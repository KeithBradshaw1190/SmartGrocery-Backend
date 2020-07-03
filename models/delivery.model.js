const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId

const DeliverySchema = new mongoose.Schema({
    delivery_id: ObjectId,
    customer_id: String,
    list_name: String,
    items_in_list: Array,
    delivery_time: {
        type: String
    },
    delivery_date: {
        type: String
    },
    order_price: {
        type: String
    },
    list_quantity: {
        type: Number
    },
    messengerID: String
}, {
    timestamps: true
});

module.exports = mongoose.model("Delivery", DeliverySchema);