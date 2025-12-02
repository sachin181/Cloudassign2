const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    itemId: String,
    qty: Number
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    items: [itemSchema],
    userEmail: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    status: {
      type: String,
      enum: ["under process", "shipping", "delivered"],
      default: "under process"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
