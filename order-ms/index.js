const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const amqp = require("amqplib");
const Order = require("./orderModel");

const app = express();
app.use(bodyParser.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo-order:27017/orderdb";
const PORT = process.env.PORT || 3003;
const RABBIT_URL = process.env.RABBIT_URL || "amqp://rabbitmq:5672";

async function init() {
  await mongoose.connect(MONGO_URI);
  console.log("[order-ms] Connected to Mongo");

  const conn = await amqp.connect(RABBIT_URL);
  const channel = await conn.createChannel();
  await channel.assertExchange("user.sync", "topic", { durable: true });

  const q = await channel.assertQueue("order.user.sync", { durable: true });
  await channel.bindQueue(q.queue, "user.sync", "user.updated");

  channel.consume(
    q.queue,
    async (msg) => {
      try {
        const event = JSON.parse(msg.content.toString());
        console.log("[order-ms] Received sync event:", event);

        await Order.updateMany(
          { userEmail: event.oldEmail },
          {
            $set: {
              userEmail: event.newEmail,
              deliveryAddress: event.newAddress
            }
          }
        );

        channel.ack(msg);
      } catch (err) {
        console.error("[order-ms] Error handling event", err);
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  console.log("[order-ms] Consuming user.sync events");
}
init().catch((err) => {
  console.error("Init error in order-ms", err);
  process.exit(1);
});

// GET /orders?status=shipping
app.get("/orders", async (req, res) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    const orders = await Order.find(query);
    res.json(orders);
  } catch (err) {
    console.error("GET /orders error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /orders
app.post("/orders", async (req, res) => {
  try {
    const { items, userEmail, deliveryAddress } = req.body;
    if (!items || !userEmail || !deliveryAddress) {
      return res
        .status(400)
        .json({ error: "items, userEmail, deliveryAddress required" });
    }
    const order = new Order({ items, userEmail, deliveryAddress });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    console.error("POST /orders error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /orders/:id/status
app.put("/orders/:id/status", async (req, res) => {
  try {	
    const { status } = req.body;
    const allowed = ["under process", "shipping", "delivered"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    console.error("PUT /orders/:id/status error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`[order-ms] listening on port ${PORT}`);
});
