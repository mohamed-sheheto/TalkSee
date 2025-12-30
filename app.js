const express = require("express");
const path = require("path");
const morgan = require("morgan");
const passport = require("passport");
const cors = require("cors");
const authRouter = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const cookieParser = require("cookie-parser");

const app = express();

if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

app.use(passport.initialize());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/rooms", roomRoutes);

app.use((req, res, next) => {
  const err = new Error(`cannot find ${req.originalUrl} on this server`);
  err.statusCode = 404;

  next(err);
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    status: "error",
    message: err.message || "Something went wrong",
  });
});

module.exports = app;
