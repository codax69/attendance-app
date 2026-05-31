import { verifyJwt } from "../middleware/auth.middleware.js";
import { verifyAdmin } from "../middleware/admin.middleware.js";
import { Router } from "express";
import { 
  attendanceCheck, 
  getAttendanceHistory, 
  getUserAttendanceHistory 
} from "../controller/attendance.controller.js";

const router = Router();
router.route("/attendance").post(verifyJwt, attendanceCheck);
router.route("/attendance-history").get(verifyJwt, getAttendanceHistory);
router.route("/attendance-history/:mobileNo").get(verifyJwt, verifyAdmin, getUserAttendanceHistory);

export default router;

