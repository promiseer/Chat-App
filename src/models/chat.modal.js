const { Schema, model } = require('mongoose');
const { Message } = require("./index")
const chatSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
        },
        isGroupChat: {
            type: Boolean,
            default: false,
        },
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: "ChatMessage",
        },
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        admin: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

chatSchema.pre('remove', async (next) => {
    //delete messages of chats
    await Message.remove({ chat: this._id }).exec();

    next();
});


const Chat = model("Chat", chatSchema);
module.exports = Chat;