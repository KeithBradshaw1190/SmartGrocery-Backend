const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const CustomersSchema = new mongoose.Schema({
  customer_id: ObjectId,
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Customer", CustomersSchema);