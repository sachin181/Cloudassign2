const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    _id: { type: String },
    email: { type: String, required: true, index: true },
    address: { type: String, required: true },
    phone: { type: String } // extra field for v2
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserV2", userSchema);
