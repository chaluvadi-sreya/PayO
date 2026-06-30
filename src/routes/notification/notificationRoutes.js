const express = require("express");
const router = express.Router();
const notificationController = require("../../controllers/notification/notificationController");
const auth = require("../middleware/auth");

router.get("/notifications", auth, notificationController.getAllNotifications);
router.put("/notifications/:id/read", auth, notificationController.markOneAsRead);
router.put("/notifications/read-all", auth, notificationController.markAllAsRead);
router.get("/notifications/unread-count", auth, notificationController.getUnreadCount);

module.exports = router;