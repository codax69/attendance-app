import mongoose, { Schema } from "mongoose";

const attendanceSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // SaaS fields
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
    },
    date: {
      type: String, // format "DD/MM/YYYY"
      required: true,
    },
    dateCode: {
      type: String, // e.g. "ITMATH01", "ITCN02", "HRTRAIN01"
      default: "",
      index: true,
    },
    checkIn: {
      type: String, // format "HH:MM:SS"
      required: true,
    },
    checkOut: {
      type: String,
      default: "",
    },
    status: {
      type: String, // PRESENT, ABSENT, LATE, HALF_DAY, LEAVE
      required: true,
      default: "PRESENT",
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Legacy fields (for backward compatibility)
    googleSheetLink: {
      type: String,
      default: "",
    },
    presentDays: {
      type: String,
    },
    monthlyAttendance: {
      type: String,
    },
    activeDays: {
      type: String,
    },
    session: {
      type: String,
      default: "",
    },
    departmentCode: {
      type: String,
      default: "",
    },
    departmentName: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Pre-save hook to keep SaaS and legacy fields in sync
attendanceSchema.pre("save", function (next) {
  if (this.date && !this.presentDays) {
    this.presentDays = this.date;
  } else if (this.presentDays && !this.date) {
    this.date = this.presentDays;
  }

  if (this.checkIn && !this.activeDays) {
    this.activeDays = this.checkIn;
  } else if (this.activeDays && !this.checkIn) {
    this.checkIn = this.activeDays;
  }

  if (this.status && !this.monthlyAttendance) {
    this.monthlyAttendance = this.status;
  } else if (this.monthlyAttendance && !this.status) {
    this.status = this.monthlyAttendance;
  }

  next();
});

export const attendance = mongoose.model("Attendance", attendanceSchema);
export const Attendance = attendance; // Support both naming styles
