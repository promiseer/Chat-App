const httpStatus = require('http-status');
const { Message } = require('../models');
const ApiError = require('../utils/ApiError');
const { Types } = require("mongoose");
const { chatCommonAggregation } = require('./chat.service');




const saveMessage = async (messageBody) => {
    if (!messageBody) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Message is empty');
    }
    return Message.create(messageBody);
};


const retrieveMessage = async (chatId) => {
    console.log(chatId);
    const messages = await Message.aggregate([{
        $match: {
            chat: Types.ObjectId.createFromHexString(chatId),
        }
    },
    ...chatCommonAggregation(),
    {
        $sort: {
            createdAt: -1,
        },

    }]);
    return messages;
};



const deleteMessages = async (messageId) => {
    return await Message.findByIdAndDelete(messageId);
};

module.exports = { saveMessage, retrieveMessage, deleteMessages }