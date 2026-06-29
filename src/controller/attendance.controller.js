import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { attendance } from "../models/attendance.model.js";
import { User } from "../models/user.model.js";
import { Department } from "../models/department.model.js";
import { signQrPayload, verifyQrPayload } from "../utils/qrSigner.js";

// POST /api/v1/attendance/generate-qr — Generates a signed QR payload (Admin/SuperUser only)
export const generateQrToken = asyncHandler(async (req, res, next) => {
  const { dateCode, expiresIn, departmentId } = req.body;

  if (!dateCode) {
    throw new ApiError(400, "dateCode is required to generate a session QR code");
  }

  let durationInMs = 10 * 60 * 1000; // default 10 minutes
  if (expiresIn) {
    if (typeof expiresIn === "string" && expiresIn.endsWith("s")) {
      durationInMs = parseInt(expiresIn) * 1000;
    } else {
      durationInMs = parseFloat(expiresIn) * 60 * 1000;
    }
  }

  // Get current date string in DD/MM/YYYY
  const todayObj = new Date();
  const dd = String(todayObj.getDate()).padStart(2, "0");
  const mm = String(todayObj.getMonth() + 1).padStart(2, "0");
  const yyyy = todayObj.getFullYear();
  const dateStr = `${dd}/${mm}/${yyyy}`;

  const expiresAt = Date.now() + durationInMs;

  let orgId = req.user.organizationId;
  let deptId = req.user.departmentId;
  let deptCode = req.user.departmentCode || "";
  let deptName = req.user.departmentName || "General";

  // If user is admin/superuser and provides a custom department, load its code & name
  if ((req.user.role === "admin" || req.user.role === "superuser") && departmentId) {
    const dept = await Department.findById(departmentId);
    if (dept) {
      deptId = dept._id;
      deptCode = dept.code || "";
      deptName = dept.name;
    }
  }

  const payload = {
    organizationId: orgId,
    departmentId: deptId,
    departmentCode: deptCode,
    departmentName: deptName,
    adminName: req.user.fullname,
    dateCode: dateCode.toUpperCase(),
    date: dateStr,
    expiresAt,
  };

  // Sign payload
  const signature = signQrPayload(payload);
  payload.key = signature; // Attach signature as key

  res.status(200).json(
    new ApiResponse(200, { qrPayload: payload }, "QR Code payload generated successfully.")
  );
});

// POST /api/v1/attendance (or /attendance/checkin)
export const attendanceCheck = asyncHandler(async (req, res, next) => {
  const {
    activeDays,
    monthlyAttendance,
    presentDays,
    googleSheetLink,
    session,
    organizationId,
    departmentId,
    dateCode,
    expiresAt,
    key,
    departmentCode,
  } = req.body;

  const dateStr = presentDays || req.body.date;
  const timeStr = activeDays || req.body.checkIn;
  const statusStr = monthlyAttendance || req.body.status || "PRESENT";
  const finalDateCode = (dateCode || session || "").toUpperCase();

  if (!dateStr || !timeStr) {
    throw new ApiError(400, "Date and check-in time are required.");
  }

  // 1. If a secure signature/key is present, verify the QR code's authenticity (Phase 6 Security)
  if (key) {
    const verificationPayload = {
      organizationId,
      departmentId,
      departmentCode: departmentCode || "",
      departmentName: req.body.departmentName || "",
      adminName: req.body.adminName || "",
      dateCode: finalDateCode,
      date: dateStr,
      expiresAt: parseInt(expiresAt),
    };

    const isValid = verifyQrPayload(verificationPayload, key);
    if (!isValid) {
      throw new ApiError(400, "Access Denied: Invalid QR code signature. Mark attempt failed.");
    }

    // 2. Validate QR Expiry (Phase 6 Outdated Check)
    if (Date.now() > parseInt(expiresAt)) {
      throw new ApiError(400, "Access Denied: This QR code has expired.");
    }
  }

  // 3. Validate student's department boundaries
  const userOrgId = req.user.organizationId;
  const userDeptId = req.user.departmentId;

  if (organizationId && userOrgId && !userOrgId.equals(organizationId)) {
    throw new ApiError(403, "Access Denied: You do not belong to this organization.");
  }

  if (departmentId && userDeptId && !userDeptId.equals(departmentId)) {
    throw new ApiError(403, "Access Denied: You do not belong to this department.");
  }

  const orgToSave = userOrgId || organizationId;
  const deptToSave = userDeptId || departmentId;

  if (!orgToSave) {
    throw new ApiError(400, "Organization ID is required to mark attendance.");
  }

  // 4. One-time check-in validation per dateCode/session per day (Phase 6 constraint)
  const existingRecord = await attendance.findOne({
    user: req.user?._id,
    date: dateStr,
    $or: [
      { dateCode: finalDateCode },
      { session: finalDateCode }
    ]
  });

  if (existingRecord) {
    throw new ApiError(400, `You have already marked attendance for session/class ${finalDateCode || 'today'}.`);
  }

  const newAttendance = await attendance.create({
    user: req.user?._id,
    organizationId: orgToSave,
    departmentId: deptToSave,
    date: dateStr,
    dateCode: finalDateCode,
    checkIn: timeStr,
    status: statusStr,
    markedBy: req.user?._id,
    googleSheetLink: googleSheetLink || "",
    session: finalDateCode,
    departmentCode: req.user?.departmentCode || "",
    departmentName: req.user?.departmentName || "",
  });

  res
    .status(201)
    .json(new ApiResponse(201, { attendance: newAttendance }, "Attendance created successfully"));
});

// POST /api/v1/attendance/checkout
export const attendanceCheckout = asyncHandler(async (req, res, next) => {
  const { date, checkOut } = req.body;

  const dateStr = date || req.body.presentDays;
  const checkoutTime = checkOut || req.body.activeDays;

  if (!dateStr || !checkoutTime) {
    throw new ApiError(400, "Date and checkout time are required.");
  }

  const record = await attendance.findOne({
    user: req.user?._id,
    date: dateStr,
  });

  if (!record) {
    throw new ApiError(404, "No check-in record found for today to check-out.");
  }

  if (record.checkOut) {
    throw new ApiError(400, "You have already checked out today.");
  }

  record.checkOut = checkoutTime;
  await record.save();

  res
    .status(200)
    .json(new ApiResponse(200, { attendance: record }, "Checked out successfully"));
});

// GET /api/v1/attendance-history
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

// GET /api/v1/attendance-history/:mobileNo
export const getUserAttendanceHistory = asyncHandler(async (req, res, next) => {
  const { mobileNo } = req.params;
  if (!mobileNo) {
    throw new ApiError(400, "Mobile Number is required");
  }

  const student = await User.findOne({ mobileNo });
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  if (
    req.user.role !== "superuser" &&
    (!req.user.organizationId || !req.user.organizationId.equals(student.organizationId))
  ) {
    throw new ApiError(403, "You do not have access to view this student's history.");
  }

  if (
    req.user.role === "admin" &&
    (!req.user.departmentId || !req.user.departmentId.equals(student.departmentId))
  ) {
    throw new ApiError(403, "You can only view attendance for students in your department.");
  }

  const history = await attendance.find({ user: student._id }).sort({ createdAt: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, { history }, "Student attendance history fetched successfully"));
});
