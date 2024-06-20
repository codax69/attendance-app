import mongoose, { Schema } from "mongoose";

const attendanceSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    googleSheetLink: {
      type: String,
    },
    presentDays: {
      type: String,
    },
    monthlyAttendance:{
        type:String
    },
    activeDays:{
        type:String
    }
  },
  { timestamps: true }
);

export const attendance = mongoose.model("Attendance", attendanceSchema);
