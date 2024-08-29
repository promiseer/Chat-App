const { Schema, model } = require('mongoose');

const messageSchema = Schema(
    {
        sender: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        recipient: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'video', 'file'],
            default: 'text'
        },
        content: {
            type: String,
            required: true
        },
        attachments: {
            type: [
                {
                    url: String,            // URL to media (image, video, file)
                    localPath: String,
                },
            ],
            default: []
        },
        chat: {
            type: Schema.Types.ObjectId,
            ref: "Chat",
        },
    },
    {
        timestamps: true,
    }

);



const User = model('Message', messageSchema);

module.exports = User;
