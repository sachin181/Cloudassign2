const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const amqp = require("amqplib");
const User = require("./userModel");

const app = express();
app.use(bodyParser.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo-user:27017/userdb";
const PORT = process.env.PORT || 3001;
const RABBIT_URL = process.env.RABBIT_URL || "amqp://rabbitmq:5672";

let channel;

// init DB + RabbitMQ
async function init() {
  await mongoose.connect(MONGO_URI);
  console.log("[user-v1] Connected to Mongo");

  try {
    const conn = await amqp.connect(RABBIT_URL);
    channel = await conn.createChannel();
    await channel.assertExchange("user.sync", "topic", { durable: true });
    console.log("[user-v1] Connected to RabbitMQ");
  } catch (err) {
    console.error("[user-v1] Failed to connect to RabbitMQ (will continue without events)", err);
    // DO NOT exit the process – service will still handle HTTP requests
  }
}

init().catch((err) => {
  console.error("[user-v1] Fatal init error", err);
  // Optional: process.exit(1);  // you can leave this commented out for now
});


function publishUserUpdatedEvent(payload) {
  if (!channel) return;
  channel.publish("user.sync", "user.updated", Buffer.from(JSON.stringify(payload)), {
    persistent: true
  });
}

// NOTE: routes are rooted at "/" because gateway strips "/users"

// POST /users  →  POST /  (from gateway)
app.post("/", async (req, res) => {
  try {
    const { id, email, address } = req.body;
    if (!id || !email || !address) {
      return res.status(400).json({ error: "id, email, address required" });
    }
    const user = new User({ _id: id, email, address });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    console.error("[user-v1] POST / error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /users/:id/email  →  PUT /:id/email
app.put("/:id/email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const oldEmail = user.email;
    user.email = email;
    await user.save();

    publishUserUpdatedEvent({
      userId: user._id,
      oldEmail,
      newEmail: email,
      oldAddress: user.address,
      newAddress: user.address
    });

    res.json(user);
  } catch (err) {
    console.error("[user-v1] PUT /:id/email error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /users/:id/address  →  PUT /:id/address
app.put("/:id/address", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "address required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const oldAddress = user.address;
    user.address = address;
    await user.save();

    publishUserUpdatedEvent({
      userId: user._id,
      oldEmail: user.email,
      newEmail: user.email,
      oldAddress,
      newAddress: address
    });

    res.json(user);
  } catch (err) {
    console.error("[user-v1] PUT /:id/address error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`[user-v1] listening on port ${PORT}`);
});
