const Notification = require("../models/Notification");

exports.sendNotification = async ({
  userId,
  title,
  message,
  type = "SYSTEM"
}) => {
  try {
    await Notification.create({
      userId,
      title,
      message,
      type
    });
  } catch (err) {
    console.log("Notification error:", err.message);
  }
};