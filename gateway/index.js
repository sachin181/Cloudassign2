const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 8080;

// Choose user service by percentage (strangler pattern)
function chooseUserService() {
  const p = Math.random() * 100;
  return p < config.userService.split.v1
    ? config.userService.v1Url
    : config.userService.v2Url;
}

// Proxy /users → v1 or v2
app.use("/users", (req, res, next) => {
  const target = chooseUserService();
  console.log(`Routing /users request to ${target}`);
  return createProxyMiddleware({
    target,
    changeOrigin: true
  })(req, res, next);
});

// Proxy /orders → order-ms
app.use(
  "/orders",
  createProxyMiddleware({
    target: config.orderService.url,
    changeOrigin: true
  })
);

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
