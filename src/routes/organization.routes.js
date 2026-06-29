import { Router } from "express";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  registerOrganization,
  getOrganization,
  updateOrganization,
  getAllOrganizations,
  getPublicOrganizations,
} from "../controller/organization.controller.js";

const router = Router();

// Public registration route
router.route("/organizations/register").post(registerOrganization);
router.route("/organizations").post(registerOrganization); // Alias for consistency
router.route("/public/organizations").get(getPublicOrganizations);

// Protected routes
router.route("/organizations").get(verifyJwt, authorizeRoles("superuser"), getAllOrganizations);

router
  .route("/organizations/:id")
  .get(verifyJwt, getOrganization)
  .put(verifyJwt, updateOrganization);

export default router;
