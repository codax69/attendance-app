import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { attendance } from "../models/attendance.model.js";
import { User } from "../models/user.model.js";
import { Department } from "../models/department.model.js";

// GET /admin/dashboard — Tenant-aware stats
export const getDashboardStats = asyncHandler(async (req, res, next) => {
  try {
    const userQuery = { role: "user" };

    // Tenant scoping
    if (req.user.role === "admin") {
      userQuery.organizationId = req.user.organizationId;
      if (req.user.departmentId) {
        userQuery.departmentId = req.user.departmentId;
      }
    } else if (req.user.role !== "superuser") {
      throw new ApiError(403, "Access Denied: Admin or SuperUser privileges required.");
    }

    const totalStudents = await User.countDocuments(userQuery);

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    const studentsInScope = await User.find(userQuery).select("_id");
    const studentIdsInScope = studentsInScope.map(s => s._id);

    const todayRecords = await attendance.find({
      presentDays: todayStr,
      user: { $in: studentIdsInScope }
    });

    const todayPresentCount = todayRecords.filter(r => r.monthlyAttendance === "PRESENT").length;
    const todayLateCount = todayRecords.filter(r => r.monthlyAttendance === "LATE").length;
    const todayHalfDayCount = todayRecords.filter(r => r.monthlyAttendance === "HALF_DAY").length;
    const todayLeaveCount = todayRecords.filter(r => r.monthlyAttendance === "LEAVE").length;
    const todayPresentTotal = todayPresentCount + todayLateCount + todayHalfDayCount;
    const todayAbsentTotal = Math.max(0, totalStudents - todayPresentTotal - todayLeaveCount);

    const departmentBreakdown = await User.aggregate([
      { $match: userQuery },
      {
        $group: {
          _id: "$departmentName",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Query departments associated with the user's organization
    let orgQuery = {};
    if (req.user.role !== "superuser") {
      orgQuery.organizationId = req.user.organizationId;
    }
    const departments = await Department.find(orgQuery).sort({ name: 1 });

    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        const studentDeptQuery = {
          role: "user",
          organizationId: dept.organizationId,
          departmentId: dept._id
        };

        if (req.user.role === "admin" && req.user.departmentId && !req.user.departmentId.equals(dept._id)) {
          return null; // admins with departments only see their own department stats
        }

        const studentsInDept = await User.find(studentDeptQuery).select("_id");
        const studentIds = studentsInDept.map(s => s._id);

        const deptTodayRecords = todayRecords.filter(r => studentIds.some(id => id.equals(r.user)));

        const present = deptTodayRecords.filter(r => r.monthlyAttendance === "PRESENT").length;
        const late = deptTodayRecords.filter(r => r.monthlyAttendance === "LATE").length;
        const halfDay = deptTodayRecords.filter(r => r.monthlyAttendance === "HALF_DAY").length;
        const leave = deptTodayRecords.filter(r => r.monthlyAttendance === "LEAVE").length;

        const totalDeptStudents = studentIds.length;
        const presentToday = present + late + halfDay;
        const absentToday = Math.max(0, totalDeptStudents - presentToday - leave);

        const rate = (totalDeptStudents - leave) > 0
          ? Math.round(((present + late + (halfDay * 0.5)) / (totalDeptStudents - leave)) * 100)
          : 100;

        return {
          id: dept._id,
          name: dept.name,
          code: dept.code || dept.name.slice(0, 3).toUpperCase(),
          fullName: `${dept.name} (${dept.code || dept.name.slice(0, 3).toUpperCase()})`,
          totalStudents: totalDeptStudents,
          presentToday,
          absentToday,
          leaveToday: leave,
          halfDayToday: halfDay,
          rate
        };
      })
    );

    const totalRecords = await attendance.countDocuments({ user: { $in: studentIdsInScope } });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          totalStudents,
          todayPresent: todayPresentTotal,
          todayAbsent: todayAbsentTotal,
          todayLeave: todayLeaveCount,
          todayHalfDay: todayHalfDayCount,
          totalRecords,
          classBreakdown: departmentBreakdown.map((d) => ({
            class: d._id || "Unassigned",
            count: d.count,
          })),
          classStats: departmentStats.filter(Boolean),
          todayDate: todayStr,
        },
        "Dashboard stats fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
});

// GET /admin/students — List users
export const getAllStudents = asyncHandler(async (req, res, next) => {
  try {
    const { class: classFilter, search, department: departmentFilter } = req.query;
    const filter = { role: "user" };

    // Tenant constraints
    if (req.user.role === "admin") {
      filter.organizationId = req.user.organizationId;
      if (req.user.departmentId) {
        filter.departmentId = req.user.departmentId;
      }
    } else if (req.user.role !== "superuser") {
      throw new ApiError(403, "Access Denied");
    }

    if (departmentFilter && departmentFilter !== "ALL") {
      filter.departmentId = departmentFilter;
    }

    if (search) {
      filter.$or = [
        { fullname: { $regex: search, $options: "i" } },
        { enrollmentNo: { $regex: search, $options: "i" } },
        { mobileNo: { $regex: search, $options: "i" } },
        { rollNo: { $regex: search, $options: "i" } },
      ];
    }

    const students = await User.find(filter)
      .select("-password -refreshToken -accessToken")
      .sort({ departmentName: 1, rollNo: 1, fullname: 1 });

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    const studentIds = students.map((s) => s._id);
    const allRecords = await attendance.find({ user: { $in: studentIds } });
    const recordsByUser = allRecords.reduce((acc, r) => {
      const uid = String(r.user);
      if (!acc[uid]) acc[uid] = [];
      acc[uid].push(r);
      return acc;
    }, {});

    const studentsWithStats = students.map((student) => {
      const records = recordsByUser[String(student._id)] || [];
      const totalRecords = records.length;
      const presentCount = records.filter((r) => r.monthlyAttendance === "PRESENT").length;
      const lateCount = records.filter((r) => r.monthlyAttendance === "LATE").length;
      const halfDayCount = records.filter((r) => r.monthlyAttendance === "HALF_DAY").length;
      const leaveCount = records.filter((r) => r.monthlyAttendance === "LEAVE").length;
      const absentCount = records.filter((r) => r.monthlyAttendance === "ABSENT").length;

      const todayRecord = records.find((r) => r.presentDays === todayStr);
      const todayStatus = todayRecord ? todayRecord.monthlyAttendance : "UNMARKED";

      const totalEvaluated = presentCount + lateCount + halfDayCount + absentCount;
      const attendancePercentage = totalEvaluated > 0
        ? Math.round(((presentCount + lateCount + (halfDayCount * 0.5)) / totalEvaluated) * 100)
        : 0;

      return {
        _id: student._id,
        fullname: student.fullname,
        name: student.name || student.fullname,
        enrollmentNo: student.enrollmentNo,
        mobileNo: student.mobileNo,
        email: student.email,
        age: student.age,
        class: student.class || student.departmentName,
        rollNo: student.rollNo,
        isLoggedIn: student.isLoggedIn,
        createdAt: student.createdAt,
        totalRecords,
        presentCount,
        lateCount,
        halfDayCount,
        leaveCount,
        absentCount,
        todayStatus,
        attendancePercentage,
      };
    });

    res.status(200).json(
      new ApiResponse(
        200,
        { students: studentsWithStats, total: studentsWithStats.length },
        "Students fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
});

// GET /admin/students/:userId/attendance — specific user history
export const getStudentAttendance = asyncHandler(async (req, res, next) => {
  try {
    const { userId } = req.params;

    const studentQuery = { _id: userId, role: "user" };
    if (req.user.role === "admin") {
      studentQuery.organizationId = req.user.organizationId;
      if (req.user.departmentId) {
        studentQuery.departmentId = req.user.departmentId;
      }
    } else if (req.user.role !== "superuser") {
      throw new ApiError(403, "Access Denied");
    }

    const student = await User.findOne(studentQuery).select(
      "-password -refreshToken -accessToken"
    );
    if (!student) {
      throw new ApiError(404, "Student not found or unauthorized access");
    }

    const records = await attendance
      .find({ user: userId })
      .sort({ createdAt: -1 });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          student,
          history: records,
        },
        "Student attendance fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
});

// GET /admin/report — Department/Class report
export const getClassAttendanceReport = asyncHandler(async (req, res, next) => {
  try {
    const { month, year, department: departmentFilter } = req.query;

    const studentFilter = { role: "user" };
    if (req.user.role === "admin") {
      studentFilter.organizationId = req.user.organizationId;
      if (req.user.departmentId) {
        studentFilter.departmentId = req.user.departmentId;
      }
    } else if (req.user.role !== "superuser") {
      throw new ApiError(403, "Access Denied");
    }

    if (departmentFilter && departmentFilter !== "ALL") {
      studentFilter.departmentId = departmentFilter;
    }

    const students = await User.find(studentFilter).select(
      "_id fullname enrollmentNo rollNo class departmentName"
    );
    const studentIds = students.map((s) => s._id);

    let records = await attendance.find({ user: { $in: studentIds } });

    if (month && year) {
      const targetMonth = String(parseInt(month)).padStart(2, "0");
      const targetYear = String(year);
      records = records.filter((r) => {
        if (!r.presentDays) return false;
        const parts = r.presentDays.split("/");
        if (parts.length !== 3) return false;
        return parts[1] === targetMonth && parts[2] === targetYear;
      });
    }

    const dateMap = {};
    records.forEach((r) => {
      const date = r.presentDays;
      if (!date) return;
      if (!dateMap[date]) {
        dateMap[date] = { date, present: 0, late: 0, halfDay: 0, leave: 0, absent: 0, studentSet: new Set() };
      }
      dateMap[date].studentSet.add(String(r.user));
      if (r.monthlyAttendance === "PRESENT") {
        dateMap[date].present++;
      } else if (r.monthlyAttendance === "LATE") {
        dateMap[date].late++;
      } else if (r.monthlyAttendance === "HALF_DAY") {
        dateMap[date].halfDay++;
      } else if (r.monthlyAttendance === "LEAVE") {
        dateMap[date].leave++;
      } else if (r.monthlyAttendance === "ABSENT") {
        dateMap[date].absent++;
      }
    });

    Object.values(dateMap).forEach((d) => {
      d.total = d.studentSet ? d.studentSet.size : 0;
      d.absent = d.total - d.present - d.late - d.halfDay - d.leave;
      if (d.absent < 0) d.absent = 0;
      delete d.studentSet;
    });

    const report = Object.values(dateMap).sort((a, b) => {
      const partsA = a.date.split("/");
      const partsB = b.date.split("/");
      const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
      const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
      return dateB - dateA;
    });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          classFilter: departmentFilter || "ALL",
          totalStudents: students.length,
          report,
        },
        "Attendance report generated successfully"
      )
    );
  } catch (error) {
    next(error);
  }
});

// POST /admin/attendance/update — Manual override
export const updateStudentAttendance = asyncHandler(async (req, res, next) => {
  try {
    const { userId, date, status, time } = req.body;

    if (!userId || !date || !status) {
      throw new ApiError(400, "User ID, date and status are required");
    }

    const validStatuses = ["PRESENT", "LATE", "HALF_DAY", "LEAVE", "ABSENT"];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, "Invalid attendance status");
    }

    const studentQuery = { _id: userId, role: "user" };
    if (req.user.role === "admin") {
      studentQuery.organizationId = req.user.organizationId;
      if (req.user.departmentId) {
        studentQuery.departmentId = req.user.departmentId;
      }
    } else if (req.user.role !== "superuser") {
      throw new ApiError(403, "Access Denied");
    }

    const student = await User.findOne(studentQuery);
    if (!student) {
      throw new ApiError(404, "Student not found or unauthorized access");
    }

    let record = await attendance.findOne({ user: userId, presentDays: date });

    if (status === "ABSENT") {
      if (record) {
        await attendance.findByIdAndDelete(record._id);
      }
      return res.status(200).json(
        new ApiResponse(200, null, "Attendance record removed (marked ABSENT)")
      );
    }

    const defaultTimes = {
      PRESENT: "09:00 AM",
      LATE: "10:30 AM",
      HALF_DAY: "12:00 PM",
      LEAVE: "--"
    };

    const recordTime = time || (record ? record.activeDays : defaultTimes[status]);

    if (record) {
      record.monthlyAttendance = status;
      record.activeDays = recordTime;
      await record.save();
    } else {
      record = await attendance.create({
        user: userId,
        organizationId: student.organizationId,
        departmentId: student.departmentId,
        presentDays: date,
        activeDays: recordTime,
        monthlyAttendance: status,
        googleSheetLink: "Marked manually",
        session: "manual",
        departmentCode: student.departmentCode || "",
        departmentName: student.departmentName || "",
      });
    }

    res.status(200).json(
      new ApiResponse(200, { attendance: record }, "Attendance updated successfully")
    );
  } catch (error) {
    next(error);
  }
});

// Legacy CRUD for Classes (map to Department)
export const createClass = asyncHandler(async (req, res, next) => {
  const { name, code } = req.body;
  if (!name || !code) {
    throw new ApiError(400, "Class name and code are required");
  }

  let orgId = req.user.organizationId;
  if (!orgId) {
    const defaultOrg = await Organization.findOne({ status: "active" });
    if (defaultOrg) orgId = defaultOrg._id;
  }

  if (!orgId) {
    throw new ApiError(400, "Organization not configured");
  }

  const existingDept = await Department.findOne({ name, organizationId: orgId });
  if (existingDept) {
    throw new ApiError(400, "Class/Department already exists");
  }

  const department = await Department.create({
    name,
    code: code.toUpperCase(),
    organizationId: orgId,
  });

  res.status(201).json(
    new ApiResponse(201, { class: department }, "Class (Department) created successfully")
  );
});

export const deleteClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const dept = await Department.findById(id);
  if (!dept) {
    throw new ApiError(404, "Class not found");
  }

  await Department.findByIdAndDelete(id);
  res.status(200).json(
    new ApiResponse(200, null, "Class (Department) deleted successfully")
  );
});
