import { Organization } from "../models/organization.model.js";
import { Department } from "../models/department.model.js";
import { User } from "../models/user.model.js";
import { attendance } from "../models/attendance.model.js";
import { Class } from "../models/class.model.js";

export const runDatabaseMigration = async () => {
  try {
    // 1. Ensure a default organization exists
    let defaultOrg = await Organization.findOne({ status: "active" });
    if (!defaultOrg) {
      defaultOrg = await Organization.create({
        name: "Default College Campus",
        type: "college",
        email: "admin@defaultcampus.edu",
        phone: "0000000000",
        address: "Campus Block A",
        status: "active",
      });
    }

    // 2. Map old Classes to Departments
    const legacyClasses = await Class.find();
    for (const legacyClass of legacyClasses) {
      // Check if department exists
      let dept = await Department.findOne({
        name: legacyClass.name,
        organizationId: defaultOrg._id,
      });
      if (!dept) {
        dept = await Department.create({
          name: legacyClass.name,
          code: legacyClass.code || legacyClass.name.slice(0, 3).toUpperCase(),
          organizationId: defaultOrg._id,
          description: `Migrated from legacy class ${legacyClass.name}`,
        });
      }
    }

    // 3. Migrate Users
    const users = await User.find();
    let migratedUsersCount = 0;

    for (const user of users) {
      let isUpdated = false;

      // Map roles
      if (user.role === "student" || user.role === "employee") {
        user.role = "user";
        isUpdated = true;
      } else if (user.role === "teacher") {
        user.role = "admin";
        user.designation = "Teacher";
        isUpdated = true;
      } else if (user.role === "supervisor") {
        user.role = "admin";
        user.designation = "Supervisor";
        isUpdated = true;
      } else if (user.role === "super_admin") {
        user.role = "superuser";
        isUpdated = true;
      }

      // Assign organization
      if (!user.organizationId) {
        user.organizationId = defaultOrg._id;
        isUpdated = true;
      }

      // Assign department based on class string
      if (!user.departmentId && user.class) {
        const dept = await Department.findOne({
          organizationId: defaultOrg._id,
          $or: [{ code: user.class }, { name: user.class }, { name: user.class.split(" (")[0] }],
        });
        if (dept) {
          user.departmentId = dept._id;
          user.departmentCode = dept.code;
          user.departmentName = dept.name;
          isUpdated = true;
        }
      }

      // Sync name field
      if (user.fullname && !user.name) {
        user.name = user.fullname;
        isUpdated = true;
      }

      // Ensure isActive is true
      if (user.isActive === undefined) {
        user.isActive = true;
        isUpdated = true;
      }

      if (isUpdated) {
        await user.save({ validateBeforeSave: false });
        migratedUsersCount++;
      }
    }

    // 4. Migrate Attendance logs
    const logs = await attendance.find();
    let migratedLogsCount = 0;

    for (const log of logs) {
      let isUpdated = false;

      // Resolve user details
      const user = await User.findById(log.user);
      if (user) {
        if (!log.organizationId) {
          log.organizationId = user.organizationId || defaultOrg._id;
          isUpdated = true;
        }
        if (!log.departmentId && user.departmentId) {
          log.departmentId = user.departmentId;
          isUpdated = true;
        }
      } else {
        // Fallback organization
        if (!log.organizationId) {
          log.organizationId = defaultOrg._id;
          isUpdated = true;
        }
      }

      // Sync SaaS/Legacy fields
      if (log.presentDays && !log.date) {
        log.date = log.presentDays;
        isUpdated = true;
      }
      if (log.activeDays && !log.checkIn) {
        log.checkIn = log.activeDays;
        isUpdated = true;
      }
      if (log.monthlyAttendance && !log.status) {
        log.status = log.monthlyAttendance;
        isUpdated = true;
      }

      if (isUpdated) {
        await log.save({ validateBeforeSave: false });
        migratedLogsCount++;
      }
    }

  } catch (err) {
    console.error("❌ Database migration failed:", err.message);
  }
};
