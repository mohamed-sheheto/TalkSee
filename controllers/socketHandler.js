module.exports = (io) => {
  io.on("connection", (socket) => {
    socket.emit("join", socket.id);

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};
