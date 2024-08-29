const logger = require('../config/logger');
const cookie = require("cookie");
const { ChatEventEnum } = require("../config/constants")




const initializeSocketIO = (io) => {
  return io.on('connection', async (socket) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers?.cookie || "");

      let user = { _id: 1 };
      socket.user = user // mount te user object to the socket
      socket.join(user._id.toString());
      socket.emit(ChatEventEnum.CONNECTED_EVENT); // emit the connected event so that client is aware
      console.log("User connected 🗼. userId: ", user._id.toString());

      socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
        console.log("user has disconnected 🚫. userId: " + socket.user?._id);
        if (socket.user?._id) {
          socket.leave(socket.user._id);
        }
      });
    } catch (error) {
      socket.emit(
        ChatEventEnum.SOCKET_ERROR_EVENT,
        error?.message || "Something went wrong while connecting to the socket."
      );
    }

    //Handle incoming new Messages
    socket.on('messageReceived', data => {
      logger.info(`Received message from ${socket.id}`);
      console.log(data);
      // Broadcast the message to recipient's socket
      socket.to(data.recipient).emit('newMessage', data);
    });


    //join chatgroup
    socket.on("join", (options, callback) => {
      const { error, user } = addUser({ id: socket.id, ...options });
      if (error) {
        return callback(error);
      } else {
        socket.join(user.room);

        socket.emit("message", generateMessage("Admin", "Welcome!"));
        socket.broadcast.to(user.room).emit("message", generateMessage("Admin", `${user.username} has joined!`));
        io.to(user.room).emit("roomData", {
          room: user.room,
          users: getUsersInRoom(user.room)
        });

        callback();
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}


const emitSocketEvent = (roomId, event, payload) => {
  io.in(roomId).emit(event, payload);
};



module.exports = { initializeSocketIO, emitSocketEvent };
