import { Router } from "express";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  getDashboardStats,
  getAllStudents,
  getStudentAttendance,
  getClassAttendanceReport,
  updateStudentAttendance,
  createClass,
  deleteClass,
} from "../controller/admin.controller.js";

const router = Router();

// All admin routes require authentication + superuser/admin role
router.use(verifyJwt, authorizeRoles("superuser", "admin"));

router.route("/admin/dashboard").get(getDashboardStats);
router.route("/admin/students").get(getAllStudents);
router.route("/admin/students/:userId/attendance").get(getStudentAttendance);
router.route("/admin/report").get(getClassAttendanceReport);
router.route("/admin/attendance/update").post(updateStudentAttendance);
router.route("/admin/class").post(createClass);
router.route("/admin/class/:id").delete(deleteClass);

export default router;
