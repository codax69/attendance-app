import { Router } from "express";
import {
  userWelcome,
  UserRegister,
  changePassword,
  getCurrentUser,
  logOutUser,
  loginUser,
  refreshAccessToken,
  updateAccountDetails,
  searchUser,
  getAllClasses,
  inviteUser,
  getUsers,
} from "../controller/user.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/welcome").get(userWelcome);
router.route("/register").post(UserRegister);
router.route("/login").post(loginUser);
router.route("/classes").get(getAllClasses);

// Secure routes
router.route("/logout").get(verifyJwt, logOutUser);
router.route("/refresh-token").post(refreshAccessToken);

router.route("/get-current-user").get(verifyJwt, getCurrentUser);

router.route("/change-password").patch(verifyJwt, changePassword);
router.route("/update-account-details").patch(verifyJwt, updateAccountDetails);
router.route("/p/:mobileNo").get(verifyJwt, searchUser);

// SaaS endpoints
router
  .route("/users")
  .post(verifyJwt, inviteUser)
  .get(verifyJwt, getUsers);

export default router;