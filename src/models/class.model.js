import mongoose, { Schema } from "mongoose";

const classSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Class code is required"],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Class = mongoose.model("Class", classSchema);
