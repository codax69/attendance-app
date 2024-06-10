import mongoose, { Mongoose, Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    fullname: {
      type: String,
      required: [true, "username is required"],
      index: true,
    },
    enrollmentNo: {
      type: String,
      required: [true, "Enrollment Number is required"],
      unique: true,
      trim: true,
      index: true,
    },

    mobileNo: {
      type: String,
      required: [true, "Mobile Number is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    password: {
      type:String,
      required:[true,"password is required"]
    },
    refreshToken:{
      type:String 
    },
    accessToken:{
      type:String
    },
    location: {
      type: String,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password,10)
  next()
});
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken =  function () {
  return  jwt.sign(
    {
      _id: this._id,
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
