const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { messageService, chatService } = require('../services');
const { emitSocketEvent } = require("../services/socket.service.js");
const { ChatEventEnum } = require("../config/constants.js");
const { getLocalPath, getStaticFilePath } = require('../utils/helpers.js');
const sendMessage = catchAsync(async (req, res) => {
    const { chatId } = req.params;
    const { recipient, messageType, content } = req.body;
    const sender = req.user._id;
    const attachments = [];

    if (req.files && req.files.attachments?.length > 0) {
        req.files.attachments?.map((attachment) => {
            attachments.push({
                url: getStaticFilePath(req, attachment.filename),
                localPath: getLocalPath(attachment.filename),
            });
        });
    }
    const newMessage = await messageService.saveMessage({
        sender,
        recipient,
        messageType,
        content,
        attachments,
        chat: chatId
    })
    emitSocketEvent(recipient, ChatEventEnum.MESSAGE_RECEIVED_EVENT, newMessage);

    return res.status(201).json({ message: 'Message sent successfully' });

});

const retrieveMessage = catchAsync(async (req, res) => {
    const { chatId } = req.params;

    const selectedChat = await chatService.getChat(chatId);

    if (!selectedChat) {
        throw new ApiError(404, "Chat does not exist");
    }

    if (!selectedChat.participants?.includes(req.user?._id)) {
        throw new ApiError(400, "User is not a part of this chat");
    }

    const messages = await messageService.retrieveMessage(chatId)
    res.send(messages);

});
const deleteMessages = catchAsync(async (req, res) => {
    const { messageId } = req.params;

    if (!messageId) {
        throw new ApiError(400, "parameter not found");
    }

    const messages = await messageService.deleteMessages(messageId)
    res.send(messages);

});

module.exports = { sendMessage, retrieveMessage, deleteMessages }