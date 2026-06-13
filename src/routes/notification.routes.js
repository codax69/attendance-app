import { verifyJwt } from "../middleware/auth.middleware.js";
import { Router } from "express";
import { 
  getNotifications, 
  createNotification, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification, 
  clearAllNotifications,
  broadcastNotification
} from "../controller/notification.controller.js";

const router = Router();

router.route("/broadcast").post(verifyJwt, broadcastNotification);
router.route("/").get(verifyJwt, getNotifications).post(verifyJwt, createNotification);
router.route("/read-all").patch(verifyJwt, markAllNotificationsAsRead);
router.route("/:id/read").patch(verifyJwt, markNotificationAsRead);
router.route("/:id").delete(verifyJwt, deleteNotification);
router.route("/").delete(verifyJwt, clearAllNotifications);

export default router;
