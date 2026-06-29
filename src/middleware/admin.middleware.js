import { ApiError } from "../utils/ApiErrorHandler.js";

export const verifyAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized Request");
    }
    if (req.user.role !== "superuser" && req.user.role !== "admin") {
      throw new ApiError(403, "Access Denied: SuperUser/Admin privileges required");
    }
    next();
  } catch (error) {
    next(error);
  }
};
