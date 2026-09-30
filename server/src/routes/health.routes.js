const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
    res.status(200).json({
        sucess: true,
        message: "ChatSphere API is running"
    });
});

module.exports = router