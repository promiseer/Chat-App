const express = require('express');
const auth = require('../../middlewares/auth');
const { upload } = require('../../middlewares/multer');
const { retrieveMessage, sendMessage, deleteMessages } = require('../../controllers/messages.controller');


const router = express.Router();

//Send Message
router
    .route("/:chatId")
    .get(auth(), retrieveMessage)
    .post(
        auth(),
        upload.fields([{ name: "attachments", maxCount: 5 }]),
        sendMessage
    );

//delete message
router
    .route('/:messageId')
    .delete(deleteMessages)

module.exports = router;