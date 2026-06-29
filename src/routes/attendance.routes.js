import { verifyJwt } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { Router } from "express";
import {
  attendanceCheck,
  attendanceCheckout,
  getAttendanceHistory,
  getUserAttendanceHistory,
  generateQrToken,
} from "../controller/attendance.controller.js";

const router = Router();

// Secure routes
router.use(verifyJwt);

router.route("/attendance").post(attendanceCheck);
router.route("/attendance/checkin").post(attendanceCheck); // Alias
router.route("/attendance/checkout").post(attendanceCheckout);

// Generate secure QR payload
router.route("/attendance/generate-qr").post(
  authorizeRoles("superuser", "admin"),
  generateQrToken
);

router.route("/attendance-history").get(getAttendanceHistory);
router.route("/attendance-history/:mobileNo").get(getUserAttendanceHistory);

export default router;
