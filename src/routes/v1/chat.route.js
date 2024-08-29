const express = require('express');
const auth = require('../../middlewares/auth');
const { getAllChats, createAGroupChat, createOrGetAOneOnOneChat, getGroupChat, renameGroupChat, deleteChat } = require('../../controllers/chat.controller');


const router = express.Router();


//get all chats
router
    .route("/").get(auth(), getAllChats);

//chat
router
    .route("/c/:recipientId")
    .post(auth(), createOrGetAOneOnOneChat)
    .delete(auth(), deleteChat)



// group chat
router
    .route("/group")
    .post(auth(), createAGroupChat);

router
    .route("/group/:chatId")
    .get(auth(), getGroupChat)
    .patch(auth(), renameGroupChat)
    .delete(auth(), deleteChat)

module.exports = router;