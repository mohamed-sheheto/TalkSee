require("dotenv").config({ quiet: true, path: "./.env" });

const app = require("./app");
const mongoose = require("mongoose");
const socket = require("socket.io");
const socketHandler = require("./controllers/socketHandler");

const port = process.env.PORT || 8000;
const URI = process.env.MONGO_URI;

if (!URI) {
  console.error("Error: MONGO_URI is not defined in environment variables");
  process.exit(1);
}

let server;

mongoose
  .connect(URI)
  .then(() => {
    console.log("Database connected successfully");
    server = app.listen(port, () => {
      console.log(`App is running on port ${port}`);
    });

    const io = socket(server, {
      cors: {
        origin: "http://localhost:3000",
        credentials: true,
      },
    });

    socketHandler(io);
  })
  .catch((err) => {
    console.error("Database connection failed", err);
    process.exit(1);
  });

module.exports = server;

const gracefulShutdown = (signal) => {
  console.log(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log("HTTP server closed.");

      mongoose.connection.close(false, () => {
        console.log("MongoDB connection closed.");
        process.exit(0);
      });
    });

    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 10000);
  } else {
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  gracefulShutdown("unhandledRejection");
});
