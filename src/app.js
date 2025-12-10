const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const investmentsRoutes = require("./routes/investment.routes");
// const socialRoutes = require("./routes/social.routes");
// const voxfeedRoutes = require("./routes/voxfeed.routes");
// const jobsRoutes = require("./routes/jobs.routes");
const adminRoutes = require("./routes/admin.routes");
const withdrawalRoutes = require("./routes/withdrawal.routes");
// const liveButtonRoutes = require("./routes/liveButton.routes");
// const transferRoutes = require("./routes/transfer.routes");
const voxskitRoutes = require("./routes/voxskit.routes");
// const luckyJetRoutes = require("./routes/luckyJet.routes");
// const raffleRoutes = require("./routes/raffle.routes");
const minesRoutes = require("./routes/mines.routes");
const coinflipRoutes = require("./routes/coinflip.routes");
const gamesRoutes = require("./routes/gaming.routes");
const paymentRoutes = require("./routes/payments.routes");
const sponsoredPostRoutes = require("./routes/sponsored.posts.routes");
const kashAdsRoutes = require("./routes/kashAdsRoutes");

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5175",
      "http://localhost:5176",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://kashprime.netlify.app","https://kashprime.com",
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL2,
      process.env.FRONTEND_URL3,
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 200,
//   message: "Too many requests from this IP, please try again later.",
// });
// app.use("/api/", limiter);

// Body parsing middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}
// Static files
app.use("/uploads", express.static("uploads"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "LUMIVOX API is running",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/investments", investmentsRoutes);
// app.use("/api/social", socialRoutes);
// app.use("/api/voxfeed", voxfeedRoutes);
// app.use("/api/jobs", jobsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/withdrawal", withdrawalRoutes);
// app.use("/api/live-button", liveButtonRoutes);
// app.use("/api/transfer", transferRoutes);
app.use("/api/voxskit", voxskitRoutes);
// app.use("/api/raffle", raffleRoutes);
// app.use("/api/lucky-jet", luckyJetRoutes);
app.use("/api/mines", minesRoutes);
app.use("/api/coinflip", coinflipRoutes);
app.use("/api/games", gamesRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sponsored-posts', sponsoredPostRoutes);
app.use('/api/kash-ads', kashAdsRoutes);

// 404 handler - Express v5 compatible
app.use((req, res, next) => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = app;
