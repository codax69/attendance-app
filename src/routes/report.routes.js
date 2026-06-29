import { Router } from "express";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  getOrganizationReport,
  getDepartmentReport,
  getUserReport,
} from "../controller/report.controller.js";

const router = Router();

router.use(verifyJwt);

router.route("/reports/organization").get(authorizeRoles("superuser", "admin"), getOrganizationReport);
router.route("/reports/department").get(authorizeRoles("superuser", "admin"), getDepartmentReport);
router.route("/reports/user").get(getUserReport); // Authorization verified in controller

export default router;
