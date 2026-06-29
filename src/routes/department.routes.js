import { Router } from "express";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
} from "../controller/department.controller.js";

const router = Router();

router.use(verifyJwt);

router
  .route("/departments")
  .post(authorizeRoles("superuser"), createDepartment)
  .get(getDepartments);

router
  .route("/departments/:id")
  .put(authorizeRoles("superuser"), updateDepartment)
  .delete(authorizeRoles("superuser"), deleteDepartment);

export default router;
