import mongoose, { Schema } from "mongoose";

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: [true, "Organization type is required"],
      enum: ["college", "company"],
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "Organization email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Organization = mongoose.model("Organization", organizationSchema);
