import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { attendance } from "../models/attendance.model.js";
import { User } from "../models/user.model.js";
import { Department } from "../models/department.model.js";

// Helper to convert array of objects to CSV string
const convertToCSV = (data, headers) => {
  const headerLine = headers.join(",");
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const val = row[header] === undefined || row[header] === null ? "" : row[header];
        // Escape quotes
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headerLine, ...rows].join("\n");
};

// GET /api/v1/reports/organization
export const getOrganizationReport = asyncHandler(async (req, res, next) => {
  const { format, month, year } = req.query;

  let orgId = req.user.organizationId;
  if (req.user.role === "super_admin" && req.query.organizationId) {
    orgId = req.query.organizationId;
  }

  if (!orgId) {
    throw new ApiError(400, "Organization ID is required.");
  }

  // Fetch departments in organization
  const departments = await Department.find({ organizationId: orgId });
  const deptIds = departments.map((d) => d._id);

  // Fetch all users in organization
  const users = await User.find({ organizationId: orgId, role: "user" }).select("_id fullname email departmentId departmentName");
  const userIds = users.map((u) => u._id);

  // Fetch attendance records
  let query = { user: { $in: userIds }, organizationId: orgId };
  let records = await attendance.find(query);

  if (month && year) {
    const targetMonth = String(parseInt(month)).padStart(2, "0");
    const targetYear = String(year);
    records = records.filter((r) => {
      if (!r.date) return false;
      const parts = r.date.split("/");
      return parts[1] === targetMonth && parts[2] === targetYear;
    });
  }

  // Aggregate stats
  const deptStatsMap = {};
  departments.forEach((dept) => {
    deptStatsMap[String(dept._id)] = {
      departmentName: dept.name,
      departmentCode: dept.code || "",
      totalUsers: 0,
      presentDays: 0,
      lateDays: 0,
      halfDays: 0,
      leaves: 0,
      absents: 0,
    };
  });

  // Count users per department
  users.forEach((u) => {
    if (u.departmentId && deptStatsMap[String(u.departmentId)]) {
      deptStatsMap[String(u.departmentId)].totalUsers++;
    }
  });

  // Count attendance status per department
  records.forEach((rec) => {
    const user = users.find((u) => u._id.equals(rec.user));
    if (user && user.departmentId && deptStatsMap[String(user.departmentId)]) {
      const stats = deptStatsMap[String(user.departmentId)];
      if (rec.status === "PRESENT") stats.presentDays++;
      else if (rec.status === "LATE") stats.lateDays++;
      else if (rec.status === "HALF_DAY") stats.halfDays++;
      else if (rec.status === "LEAVE") stats.leaves++;
      else if (rec.status === "ABSENT") stats.absents++;
    }
  });

  const reportData = Object.values(deptStatsMap).map((stat) => {
    const totalPresent = stat.presentDays + stat.lateDays + stat.halfDays;
    const totalDays = totalPresent + stat.leaves + stat.absents;
    const attendancePercentage = totalDays > 0
      ? Math.round(((stat.presentDays + stat.lateDays + (stat.halfDays * 0.5)) / totalDays) * 100)
      : 100;
    return {
      ...stat,
      attendancePercentage,
    };
  });

  if (format === "csv") {
    const headers = [
      "departmentName",
      "departmentCode",
      "totalUsers",
      "presentDays",
      "lateDays",
      "halfDays",
      "leaves",
      "absents",
      "attendancePercentage",
    ];
    const csvContent = convertToCSV(reportData, headers);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="organization_report_${month || 'all'}_${year || 'all'}.csv"`);
    return res.status(200).send(csvContent);
  }

  res.status(200).json(
    new ApiResponse(200, { report: reportData }, "Organization report generated successfully.")
  );
});

// GET /api/v1/reports/department
export const getDepartmentReport = asyncHandler(async (req, res, next) => {
  const { departmentId, format, month, year } = req.query;

  let deptId = departmentId;
  if (req.user.role === "supervisor") {
    deptId = req.user.departmentId;
  }

  if (!deptId) {
    throw new ApiError(400, "Department ID is required.");
  }

  const dept = await Department.findById(deptId);
  if (!dept) {
    throw new ApiError(404, "Department not found.");
  }

  // Fetch users in department
  const users = await User.find({ departmentId: deptId, role: "user" }).select("_id fullname enrollmentNo mobileNo email rollNo");
  const userIds = users.map((u) => u._id);

  let records = await attendance.find({ user: { $in: userIds }, departmentId: deptId });

  if (month && year) {
    const targetMonth = String(parseInt(month)).padStart(2, "0");
    const targetYear = String(year);
    records = records.filter((r) => {
      if (!r.date) return false;
      const parts = r.date.split("/");
      return parts[1] === targetMonth && parts[2] === targetYear;
    });
  }

  const userStats = users.map((user) => {
    const userRecords = records.filter((r) => r.user.equals(user._id));
    const presentCount = userRecords.filter((r) => r.status === "PRESENT").length;
    const lateCount = userRecords.filter((r) => r.status === "LATE").length;
    const halfDayCount = userRecords.filter((r) => r.status === "HALF_DAY").length;
    const leaveCount = userRecords.filter((r) => r.status === "LEAVE").length;
    const absentCount = userRecords.filter((r) => r.status === "ABSENT").length;

    const totalDays = presentCount + lateCount + halfDayCount + leaveCount + absentCount;
    const attendancePercentage = totalDays > 0
      ? Math.round(((presentCount + lateCount + (halfDayCount * 0.5)) / totalDays) * 100)
      : 0;

    return {
      fullname: user.fullname,
      enrollmentNo: user.enrollmentNo || "N/A",
      rollNo: user.rollNo || "N/A",
      email: user.email,
      presentCount,
      lateCount,
      halfDayCount,
      leaveCount,
      absentCount,
      attendancePercentage,
    };
  });

  if (format === "csv") {
    const headers = [
      "fullname",
      "enrollmentNo",
      "rollNo",
      "email",
      "presentCount",
      "lateCount",
      "halfDayCount",
      "leaveCount",
      "absentCount",
      "attendancePercentage",
    ];
    const csvContent = convertToCSV(userStats, headers);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="department_report_${dept.name.replace(/\s+/g, '_')}.csv"`);
    return res.status(200).send(csvContent);
  }

  res.status(200).json(
    new ApiResponse(200, { report: userStats, departmentName: dept.name }, "Department report generated successfully.")
  );
});

// GET /api/v1/reports/user
export const getUserReport = asyncHandler(async (req, res, next) => {
  const { userId, format, month, year } = req.query;

  let targetUserId = userId || req.user._id;

  // Fetch target user
  const user = await User.findById(targetUserId).select("_id fullname email enrollmentNo rollNo departmentName");
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  // Auth check: supervisor/admin can see, regular users can only see their own
  if (req.user.role === "user" && !req.user._id.equals(targetUserId)) {
    throw new ApiError(403, "You do not have access to this user's report.");
  }

  let records = await attendance.find({ user: targetUserId });

  if (month && year) {
    const targetMonth = String(parseInt(month)).padStart(2, "0");
    const targetYear = String(year);
    records = records.filter((r) => {
      if (!r.date) return false;
      const parts = r.date.split("/");
      return parts[1] === targetMonth && parts[2] === targetYear;
    });
  }

  const attendanceLogs = records.map((r) => ({
    date: r.date,
    checkIn: r.checkIn,
    checkOut: r.checkOut || "Not Checked Out",
    status: r.status,
    session: r.session || "N/A",
  }));

  if (format === "csv") {
    const headers = ["date", "checkIn", "checkOut", "status", "session"];
    const csvContent = convertToCSV(attendanceLogs, headers);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="user_report_${user.fullname.replace(/\s+/g, '_')}.csv"`);
    return res.status(200).send(csvContent);
  }

  res.status(200).json(
    new ApiResponse(200, { report: attendanceLogs, user }, "User report generated successfully.")
  );
});
