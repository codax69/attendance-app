import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { attendance } from "../models/attendance.model.js";

const attendanceCheck = asyncHandler(async (req, res, next) => {
  try {
    const { activeDays, monthlyAttendance, presentDays, googleSheetLink } =
      req.body;

    const attendance = await attendance.create({
      activeDays,
      monthlyAttendance,
      presentDays,
      googleSheetLink,
    });

    res
    .status(200)
    .res(new ApiResponse(200 ,{attendance},"attendance injected"))
  } catch (error) {
    next(error);
  }
});
