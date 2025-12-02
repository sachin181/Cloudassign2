const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 8080;

// Choose user service based on split %
function chooseUserTarget() {
  const p = Math.random() * 100;
  const target =
    p < config.userService.split.v1
      ? config.userService.v1Url
      : config.userService.v2Url;
  return target;
}

// /users -> user-v1 or user-v2
app.use(
  "/users",
  createProxyMiddleware({
    target: config.userService.v1Url, // fallback, overridden by router()
    changeOrigin: false,
    pathRewrite: { "^/users": "/" }, // so user service sees "/" or "/:id/..."
    logLevel: "debug",
    router: (req) => {
      const target = chooseUserTarget();
      console.log(`Routing /users${req.url} -> ${target}${req.url}`);
      return target;
    },
    onError(err, req, res) {
      console.error("Proxy error for /users:", err.message);
      res.status(502).send("Gateway error while proxying /users");
    }
  })
);

// /orders -> order-ms
app.use(
  "/orders",
  createProxyMiddleware({
    target: config.orderService.url,
    changeOrigin: false,
    logLevel: "debug",
    pathRewrite: { "^/orders": "/" },
    onError(err, req, res) {
      console.error("Proxy error for /orders:", err.message);
      res.status(502).send("Gateway error while proxying /orders");
    }
  })
);

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
