import mongoose, { Schema } from "mongoose";

const departmentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Ensure name is unique within the same organization
departmentSchema.index({ name: 1, organizationId: 1 }, { unique: true });
// Ensure code is unique within the same organization (if code is provided)
departmentSchema.index({ code: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { code: { $exists: true, $type: "string" } } });

export const Department = mongoose.model("Department", departmentSchema);
