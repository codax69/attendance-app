import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { attendance } from "../models/attendance.model.js";
import { User } from "../models/user.model.js";

export const attendanceCheck = asyncHandler(async (req, res, next) => {
  const { activeDays, monthlyAttendance, presentDays, googleSheetLink, session } =
    req.body;

  // Prevent duplicate check-ins
  const existingRecord = await attendance.findOne({
    user: req.user?._id,
    presentDays,
    session: session || ""
  });
  if (existingRecord) {
    throw new ApiError(400, "You have already marked attendance for this session today.");
  }

  const newAttendance = await attendance.create({
    user: req.user?._id,
    activeDays,
    monthlyAttendance,
    presentDays,
    googleSheetLink,
    session: session || "",
    departmentCode: req.user?.departmentCode || "",
    departmentName: req.user?.departmentName || "",
  });

  res
    .status(201)
    .json(new ApiResponse(201, { attendance: newAttendance }, "Attendance created"));
});

export const getAttendanceHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized Request");
  }

  const history = await attendance.find({ user: userId }).sort({ createdAt: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, { history }, "Attendance history fetched successfully"));
});

export const getUserAttendanceHistory = asyncHandler(async (req, res, next) => {
  const { mobileNo } = req.params;
  if (!mobileNo) {
    throw new ApiError(400, "Mobile Number is required");
  }
  const student = await User.findOne({ mobileNo });
  if (!student) {
    throw new ApiError(404, "Student not found");
  }
  const history = await attendance.find({ user: student._id }).sort({ createdAt: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, { history }, "Student attendance history fetched successfully"));
});
