import { ApiError } from "../utils/ApiErrorHandler.js";

/**
 * Middleware to authorize users based on roles.
 * @param {...string} allowedRoles - Roles allowed to access the route (e.g., 'super_admin', 'admin', 'supervisor', 'user')
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Unauthorized Request - No User Context Found");
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ApiError(
          403,
          `Access Denied: You do not have permission to perform this action. Required roles: [${allowedRoles.join(
            ", "
          )}]. Current role: [${req.user.role}]`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
