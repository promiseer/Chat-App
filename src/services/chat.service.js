const { Types } = require("mongoose");
const { Chat } = require("../models/")


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
                from: "message",
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



const getChat = async (chatId, isGroupChat = false) => {

    return await Chat.findOne({
        _id: Types.ObjectId.createFromHexString(chatId),
        isGroupChat

    }
    )
};

const updateChat = async (chatId, payload) => {
    console.log(payload);
    return await Chat.findByIdAndUpdate(
        chatId,
        {
            $set: payload

        },
        { new: true }
    );
};


const deleteChat = async (chatId, isGroupChat = false) => {
    return await Chat.deleteOne(
        {
            _id: Types.ObjectId.createFromHexString(chatId),
            isGroupChat
        },
    );
};

module.exports = { getChat, updateChat, deleteChat, chatCommonAggregation }