
const { ChatEventEnum } = require("../config/constants.js");
const Message = require("../models/message.modal.js")
const Chat = require("../models/chat.modal.js")
const User = require("../models/user.model.js")
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { Types } = require("mongoose");
const { emitSocketEvent } = require("../services/socket.service.js");
const chatService = require("../services/chat.service.js")
const chatCommonAggregation = () => {
    return [
        {
            // lookup for the participants present
            $lookup: {
                from: "users",
                foreignField: "_id",
                localField: "participants",
                as: "participants",
                pipeline: [
                    {
                        $project: {
                            password: 0,
                            refreshToken: 0,
                            forgotPasswordToken: 0,
                            forgotPasswordExpiry: 0,
                            emailVerificationToken: 0,
                            emailVerificationExpiry: 0,
                        },
                    },
                ],
            },
        },
        {
            // lookup for the group chats
            $lookup: {
                from: "chatmessages",
                foreignField: "_id",
                localField: "lastMessage",
                as: "lastMessage",
                pipeline: [
                    {
                        // get details of the sender
                        $lookup: {
                            from: "users",
                            foreignField: "_id",
                            localField: "sender",
                            as: "sender",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        avatar: 1,
                                        email: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            sender: { $first: "$sender" },
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                lastMessage: { $first: "$lastMessage" },
            },
        },
    ];
};

const createOrGetAOneOnOneChat = async (req, res) => {
    const { recipientId } = req.params;

    // Check if it's a valid receiver
    const receiver = await User.findById(recipientId);

    if (!receiver) {
        throw new ApiError(404, "Receiver does not exist");
    }

    // check if receiver is not the user who is requesting a chat
    if (receiver._id.toString() === req.user._id.toString()) {
        throw new ApiError(400, "You cannot chat with yourself");
    }

    const chat = await Chat.aggregate([
        {
            $match: {
                isGroupChat: false, // avoid group chats. This controller is responsible for one on one chats
                // Also, filter chats with participants having receiver and logged in user only
                $and: [
                    {
                        participants: { $elemMatch: { $eq: req.user._id } },
                    },
                    {
                        participants: {
                            $elemMatch: { $eq: Types.ObjectId.createFromHexString(recipientId) },
                        },
                    },
                ],
            },
        },
        ...chatCommonAggregation(),
    ]);

    if (chat.length) {
        // if we find the chat that means user already has created a chat
        return res
            .status(httpStatus.OK)
            .json({ chat: chat[0], message: "Chat retrieved successfully" });
    }

    // if not we need to create a new one on one chat
    const newChatInstance = await Chat.create({
        name: "One on one chat",
        participants: [req.user._id, Types.ObjectId.createFromHexString(recipientId)], // add receiver and logged in user as participants
        admin: req.user._id,
    });

    // structure the chat as per the common aggregation to keep the consistency
    const createdChat = await Chat.aggregate([
        {
            $match: {
                _id: newChatInstance._id,
            },
        },
        ...chatCommonAggregation(),
    ]);

    const payload = createdChat[0]; // store the aggregation result

    if (!payload) {
        throw new ApiError(500, "Internal server error");
    }

    // logic to emit socket event about the new chat added to the participants
    payload?.participants?.forEach((participant) => {
        if (participant._id.toString() === req.user._id.toString()) return; // don't emit the event for the logged in use as he is the one who is initiating the chat

        // emit event to other participants with new chat as a payload
        emitSocketEvent(
            participant._id?.toString(),
            ChatEventEnum.NEW_CHAT_EVENT,
            payload
        );
    });

    return res
        .status(httpStatus.CREATED)
        .json({ status: httpStatus.CREATED, payload, message: "Chat retrieved successfully" });
};

const getAllChats = async (req, res) => {
    const chats = await Chat.aggregate([
        {
            $match: {
                participants: { $elemMatch: { $eq: req.user._id } }, // get all chats that have logged in user as a participant
            },
        },
        {
            $sort: {
                updatedAt: -1,
            },
        },
        ...chatCommonAggregation(),
    ]);

    return res
        .status(httpStatus.OK)
        .send(chats);
};

const createAGroupChat = async (req, res) => {
    const { name, participants } = req.body;

    // Check if user is not sending himself as a participant. This will be done manually
    if (participants.includes(req.user._id.toString())) {
        throw new ApiError(
            400,
            "Participants array should not contain the group creator"
        );
    }

    const members = [...new Set([...participants, req.user._id.toString()])]; // check for duplicates
    if (members.length < 3) {
        // check after removing the duplicate
        // We want group chat to have minimum 3 members including admin
        throw new ApiError(
            400,
            "Seems like you have passed duplicate participants."
        );
    }

    // Create a group chat with provided members
    const groupChat = await Chat.create({
        name,
        isGroupChat: true,
        participants: members,
        admin: req.user._id,
    });

    // structure the chat
    const chat = await Chat.aggregate([
        {
            $match: {
                _id: groupChat._id,
            },
        },
        ...chatCommonAggregation(),
    ]);

    const payload = chat[0];

    if (!payload) {
        throw new ApiError(500, "Internal server error");
    }

    // logic to emit socket event about the new group chat added to the participants
    payload?.participants?.forEach((participant) => {
        if (participant._id.toString() === req.user._id.toString()) return; // don't emit the event for the logged in use as he is the one who is initiating the chat
        // emit event to other participants with new chat as a payload
        emitSocketEvent(
            req,
            participant._id?.toString(),
            ChatEventEnum.NEW_CHAT_EVENT,
            payload
        );
    });

    return res
        .status(201)
        .json(new ApiResponse(201, payload, "Group chat created successfully"));
};

const getGroupChat = async (req, res) => {
    const { chatId } = req.params;
    const [groupChat] = await Chat.aggregate([
        {
            $match: {
                _id: Types.ObjectId.createFromHexString(chatId),
                isGroupChat: true,
            },
        },
        ...chatCommonAggregation(),
    ]);
    if (!groupChat) {
        throw new ApiError(404, "Group chat does not exist");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, groupChat, "Group chat fetched successfully"));
}

const renameGroupChat = async (req, res) => {
    const { chatId } = req.params;
    const { name } = req.body;

    // check for chat existence
    const groupChat = await chatService.getChat(chatId, true)
    if (!groupChat) {
        throw new ApiError(404, "Group chat does not exist");
    }

    // only admin can change the name
    if (groupChat.admin?.toString() !== req.user._id?.toString()) {
        throw new ApiError(404, "You are not an admin");
    }

    const updatedGroupChat = await chatService.updateChat(chatId, { name })

    const [chat] = await Chat.aggregate([
        {
            $match: {
                _id: updatedGroupChat._id,
            },
        },
        ...chatCommonAggregation(),
    ]);


    if (!chat) {
        throw new ApiError(500, "Internal server error");
    }

    // logic to emit socket event about the updated chat name to the participants
    chat?.participants?.forEach((participant) => {
        // emit event to all the participants with updated chat as a chat
        emitSocketEvent(
            req,
            participant._id?.toString(),
            ChatEventEnum.UPDATE_GROUP_NAME_EVENT,
            chat
        );
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, chat, "Group chat name updated successfully")
        );
};

const deleteChat = async (req, res) => {
    const { chatId } = req.params;

    // check for the group chat existence
    const [groupChat] = await Chat.aggregate([
        {
            $match: {
                _id: Types.ObjectId.createFromHexString(chatId),
                isGroupChat: true,
            },
        },
        ...chatCommonAggregation(),
    ]);


    if (!groupChat) {
        throw new ApiError(404, "Group groupChat does not exist");
    }

    // check if the user who is deleting is the group admin
    if (groupChat.admin?.toString() !== req.user._id?.toString()) {
        throw new ApiError(404, "Only admin can delete the group");
    }

    await chatService.deleteChat(chatId, true); // delete the chat

    // await deleteCascadeChatMessages(chatId); // remove all messages and attachments associated with the chat

    // logic to emit socket event about the group chat deleted to the participants
    groupChat?.participants?.forEach((participant) => {
        if (participant._id.toString() === req.user._id.toString()) return; // don't emit the event for the logged in use as he is the one who is deleting
        // emit event to other participants with left chat as a payload
        emitSocketEvent(
            req,
            participant._id?.toString(),
            ChatEventEnum.LEAVE_CHAT_EVENT,
            groupChat
        );
    });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Group chat deleted successfully"));
};

module.exports = {

    createAGroupChat,
    createOrGetAOneOnOneChat,
    getAllChats,
    getGroupChat,
    renameGroupChat,
    deleteChat

};