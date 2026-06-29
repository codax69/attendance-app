import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";

// Fetch notifications for the authenticated user
export const getNotifications = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized Request");
    }
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, { notifications }, "Notifications fetched successfully"));
  } catch (error) {
    next(error);
  }
});

// Create a new notification
export const createNotification = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized Request");
    }
    const { title, message, type } = req.body;
    if (!title || !message) {
      throw new ApiError(400, "Title and message are required");
    }
    const newNotification = await Notification.create({
      user: userId,
      title,
      message,
      type: type || "info",
    });
    res.status(201).json(new ApiResponse(201, { notification: newNotification }, "Notification created successfully"));
  } catch (error) {
    next(error);
  }
});

// Mark single notification as read
export const markNotificationAsRead = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    if (!userId) {
      throw new ApiError(401, "Unauthorized Request");
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid notification id");
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      throw new ApiError(404, "Notification not found");
    }
    res.status(200).json(new ApiResponse(200, { notification }, "Notification marked as read"));
  } catch (error) {
    next(error);
  }
});

// Mark all as read
export const markAllNotificationsAsRead = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized Request");
    }
    await Notification.updateMany({ user: userId, read: false }, { read: true });
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, { notifications }, "All notifications marked as read"));
  } catch (error) {
    next(error);
  }
});

// Delete specific notification
export const deleteNotification = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    if (!userId) {
      throw new ApiError(401, "Unauthorized Request");
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid notification id");
    }
    const result = await Notification.findOneAndDelete({ _id: id, user: userId });
    if (!result) {
      throw new ApiError(404, "Notification not found");
    }
    res.status(200).json(new ApiResponse(200, null, "Notification deleted successfully"));
  } catch (error) {
    next(error);
  }
});

// Clear all notifications for user
export const clearAllNotifications = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized Request");
    }
    await Notification.deleteMany({ user: userId });
    res.status(200).json(new ApiResponse(200, null, "All notifications cleared"));
  } catch (error) {
    next(error);
  }
});

// Broadcast notification to tenant / department boundaries (Phase 8 Upgrades)
export const broadcastNotification = asyncHandler(async (req, res, next) => {
  try {
    const { title, message, type, departmentId, targetRole } = req.body;
    if (!title || !message) {
      throw new ApiError(400, "Title and message are required");
    }

    // Auth check: only admin or superuser
    if (!["superuser", "admin"].includes(req.user?.role)) {
      throw new ApiError(403, "Access Denied: Only admins or superusers can broadcast notices");
    }

    const filter = {};

    // Apply tenant boundary filters
    if (req.user.role === "admin") {
      filter.organizationId = req.user.organizationId;
      if (req.user.departmentId) {
        filter.departmentId = req.user.departmentId;
      } else if (departmentId) {
        filter.departmentId = departmentId;
      }
    } else if (req.user.role === "superuser") {
      if (req.body.organizationId) {
        filter.organizationId = req.body.organizationId;
      } else {
        filter.organizationId = req.user.organizationId;
      }
      if (departmentId) {
        filter.departmentId = departmentId;
      }
    }

    if (targetRole) {
      filter.role = targetRole;
    }

    // Find all matching users
    const users = await User.find(filter).select("_id");
    if (users.length === 0) {
      return res.status(200).json(new ApiResponse(200, null, "No matching users found for broadcast."));
    }

    const notifications = users.map((u) => ({
      user: u._id,
      title,
      message,
      type: type || "info",
    }));

    await Notification.insertMany(notifications);

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          null,
          `Announcement broadcasted successfully to ${users.length} users.`
        )
      );
  } catch (error) {
    next(error);
  }
});
