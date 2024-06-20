import { verifyJwt } from "../middleware/auth.middleware.js";
import { Router } from "express";
import {} from "../controller/attendance.controller.js"

const router = Router()
router.route("/attendance").get(verifyJwt,)
export default Router

