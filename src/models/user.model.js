import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    fullname: {
      type: String,
      required: [true, "fullname is required"],
      index: true,
    },
    // Alias or alternative for SaaS name field
    name: {
      type: String,
    },
    enrollmentNo: {
      type: String,
      trim: true,
      index: true,
      // Optional for company users, but kept for college students
    },
    mobileNo: {
      type: String,
      required: [true, "Mobile Number is required"],
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "password is required"],
    },
    refreshToken: {
      type: String,
    },
    accessToken: {
      type: String,
    },
    location: {
      type: String,
    },
    isLoggedIn: {
      type: Boolean,
      default: false,
    },
    age: {
      type: String,
    },
    // Keep class for backward compatibility/reporting
    class: {
      type: String,
    },
    rollNo: {
      type: String,
    },
    role: {
      type: String,
      enum: ["superuser", "admin", "user"],
      default: "user",
    },
    // Custom designation set by SuperUser for Admin users (e.g. "Supervisor", "Manager", "HOD")
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
    },
    // Keep departmentCode / departmentName for backward compatibility
    departmentCode: {
      type: String,
      trim: true,
      default: "",
    },
    departmentName: {
      type: String,
      trim: true,
      default: "",
    },
    employeeId: {
      type: String,
      trim: true,
    },
    studentId: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    logCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  // Sync name and fullname fields
  if (this.fullname && !this.name) {
    this.name = this.fullname;
  } else if (this.name && !this.fullname) {
    this.fullname = this.name;
  }

  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: this.role,
      organizationId: this.organizationId,
      departmentId: this.departmentId,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
