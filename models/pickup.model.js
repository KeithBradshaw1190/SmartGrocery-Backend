const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId

const PickupSchema = new mongoose.Schema({
    pickup_id: ObjectId,
    customer_id: String,
    list_name: String,
    items_in_list: Array,
    pickup_time: {
        type: String
    },
    pickup_date: {
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

module.exports = mongoose.model("Pickup", PickupSchema);