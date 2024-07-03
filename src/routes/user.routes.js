import { Router } from "express";
import { UserRegister, changePassword, getCurrentUser, logOutUser, loginUser, refreshAccessToken, updateAccountDetails,searchUser } from "../controller/user.controller.js";
import {verifyJwt} from "../middleware/auth.middleware.js"

const router = Router()

router.route("/register").post(UserRegister)
router.route("/login").post(loginUser)

//secure routes
router.route("/logout").post(verifyJwt,logOutUser)
router.route("/refresh-token").post(verifyJwt,refreshAccessToken)

router.route("/get-current-user").get(verifyJwt,getCurrentUser)

router.route("/change-password").patch(verifyJwt,changePassword)
router.route("/update-account-details").patch(verifyJwt,updateAccountDetails)
router.route("/p/:mobileNo").get(verifyJwt,searchUser)
export default router