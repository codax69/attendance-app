import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrorHandler.js";
import jwt from "jsonwebtoken";
import {User} from "../models/user.model.js";

export const verifyJwt = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "").trim();
    if (!token) {
      throw new ApiError(401, "Unauthorized Request");
    }
    const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(404, "Invalid Token");
    }
    req.user = user;
    next()
  } catch (error) {
    next(error);
  }
});
