import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { attendance } from "../models/attendance.model.js";
import { User } from "../models/user.model.js";
import { Class } from "../models/class.model.js";

// GET /admin/dashboard — Overall dashboard stats
export const getDashboardStats = asyncHandler(async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });

    // Get today's date string in DD/MM/YYYY format
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    // Count today's attendance records by status
    const todayRecords = await attendance.find({ presentDays: todayStr });
    const todayPresentCount = todayRecords.filter(r => r.monthlyAttendance === "PRESENT").length;
    const todayLateCount = todayRecords.filter(r => r.monthlyAttendance === "LATE").length;
    const todayHalfDayCount = todayRecords.filter(r => r.monthlyAttendance === "HALF_DAY").length;
    const todayLeaveCount = todayRecords.filter(r => r.monthlyAttendance === "LEAVE").length;
    const todayPresentTotal = todayPresentCount + todayLateCount + todayHalfDayCount;
    const todayAbsentTotal = Math.max(0, totalStudents - todayPresentTotal - todayLeaveCount);

    // Class-wise student breakdown
    const classBreakdown = await User.aggregate([
      { $match: { role: "student" } },
      {
        $group: {
          _id: "$class",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Class-wise stats breakdown
    const classes = await Class.find().sort({ name: 1 });
    const classStats = await Promise.all(
      classes.map(async (cls) => {
        const classPattern = `${cls.name} (${cls.code})`;
        const studentsInClass = await User.find({ class: classPattern, role: "student" }).select("_id");
        const studentIds = studentsInClass.map(s => s._id);

        const classTodayRecords = todayRecords.filter(r => studentIds.some(id => id.equals(r.user)));

        const present = classTodayRecords.filter(r => r.monthlyAttendance === "PRESENT").length;
        const late = classTodayRecords.filter(r => r.monthlyAttendance === "LATE").length;
        const halfDay = classTodayRecords.filter(r => r.monthlyAttendance === "HALF_DAY").length;
        const leave = classTodayRecords.filter(r => r.monthlyAttendance === "LEAVE").length;

        const totalClassStudents = studentIds.length;
        const presentToday = present + late + halfDay;
        const absentToday = Math.max(0, totalClassStudents - presentToday - leave);

        const rate = (totalClassStudents - leave) > 0
          ? Math.round(((present + late + (halfDay * 0.5)) / (totalClassStudents - leave)) * 100)
          : 100;

        return {
          id: cls._id,
          name: cls.name,
          code: cls.code,
          fullName: classPattern,
          totalStudents: totalClassStudents,
          presentToday,
          absentToday,
          leaveToday: leave,
          halfDayToday: halfDay,
          rate
        };
      })
    );

    // Total attendance records
    const totalRecords = await attendance.countDocuments();

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
          classBreakdown: classBreakdown.map((c) => ({
            class: c._id || "Unassigned",
            count: c.count,
          })),
          classStats,
          todayDate: todayStr,
        },
        "Dashboard stats fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
});

// GET /admin/students — List all students with optional class filter
export const getAllStudents = asyncHandler(async (req, res, next) => {
  try {
    const { class: classFilter, search } = req.query;
    const filter = { role: "student" };

    if (classFilter && classFilter !== "ALL") {
      // Resolve class code to name if needed
      const cls = await Class.findOne({ code: classFilter });
      if (cls) {
        filter.class = `${cls.name} (${cls.code})`;
      } else {
        filter.class = classFilter;
      }
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
      .sort({ class: 1, rollNo: 1, fullname: 1 });

    // Get today's date to find today's attendance for each student
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    // Fetch attendance records for all students in one query to avoid N+1
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
        enrollmentNo: student.enrollmentNo,
        mobileNo: student.mobileNo,
        email: student.email,
        age: student.age,
        class: student.class,
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

// GET /admin/students/:userId/attendance — Get specific student's attendance
export const getStudentAttendance = asyncHandler(async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const student = await User.findById(userId).select(
      "-password -refreshToken -accessToken"
    );
    if (!student) {
      throw new ApiError(404, "Student not found");
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

// GET /admin/report — Class-wise attendance report with date range
export const getClassAttendanceReport = asyncHandler(async (req, res, next) => {
  try {
    const { class: classFilter, month, year } = req.query;

    // Get students for the class
    const studentFilter = { role: "student" };
    if (classFilter && classFilter !== "ALL") {
      // Resolve class code to name if needed
      const cls = await Class.findOne({ code: classFilter });
      if (cls) {
        studentFilter.class = `${cls.name} (${cls.code})`;
      } else {
        studentFilter.class = classFilter;
      }
    }

    const students = await User.find(studentFilter).select(
      "_id fullname enrollmentNo rollNo class"
    );
    const studentIds = students.map((s) => s._id);

    // Get all attendance records for these students
    let records = await attendance.find({ user: { $in: studentIds } });

    // Filter by month/year if provided
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

    // Build date-wise attendance summary
    const dateMap = {};
    // Build a set of studentIds per date to derive per-date roster size
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

    // Calculate per-date total from recorded studentSet then compute absent
    Object.values(dateMap).forEach((d) => {
      d.total = d.studentSet ? d.studentSet.size : 0;
      d.absent = d.total - d.present - d.late - d.halfDay - d.leave;
      if (d.absent < 0) d.absent = 0;
      // remove helper
      delete d.studentSet;
    });

    // Sort dates descending
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
          classFilter: classFilter || "ALL",
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

// POST /admin/attendance/update — Update or create student attendance for a date
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

    const student = await User.findById(userId);
    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    // Check if record exists for this student and date
    let record = await attendance.findOne({ user: userId, presentDays: date });

    if (status === "ABSENT") {
      // If setting to ABSENT, we delete the record so it falls back to virtual absent
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
      // Update existing record
      record.monthlyAttendance = status;
      record.activeDays = recordTime;
      await record.save();
    } else {
      // Create new record
      record = await attendance.create({
        user: userId,
        presentDays: date,
        activeDays: recordTime,
        monthlyAttendance: status,
        googleSheetLink: "Marked by Teacher"
      });
    }

    res.status(200).json(
      new ApiResponse(200, { attendance: record }, "Attendance updated successfully")
    );
  } catch (error) {
    next(error);
  }
});

// POST /admin/class — Add a new class
export const createClass = asyncHandler(async (req, res, next) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      throw new ApiError(400, "Class name and code are required");
    }

    const existingClass = await Class.findOne({ $or: [{ name }, { code }] });
    if (existingClass) {
      throw new ApiError(400, "Class with this name or code already exists");
    }

    const newClass = await Class.create({ name, code });

    res.status(201).json(
      new ApiResponse(201, { class: newClass }, "Class created successfully")
    );
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/class/:id — Delete a class
export const deleteClass = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const classToDelete = await Class.findById(id);
    if (!classToDelete) {
      throw new ApiError(404, "Class not found");
    }

    await Class.findByIdAndDelete(id);

    res.status(200).json(
      new ApiResponse(200, null, "Class deleted successfully")
    );
  } catch (error) {
    next(error);
  }
});
