const socket = io();

socket.on("join", (data) => {
  console.log("user joined:", data);
});
