const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    _id: { type: String }, // user account id
    email: { type: String, required: true },
    address: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
