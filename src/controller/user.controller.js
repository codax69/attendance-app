import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { Query } from "mongoose";
import { query } from "express";

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      `Something went wrong while generating tokens: ${error.message}`
    );
  }
};

const options = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
};

const UserRegister = asyncHandler(async (req, res, next) => {
  try {
    const { fullname, enrollmentNo, email, mobileNo, password } = req.body;
    // console.log({ fullname, enrollmentNo, email, mobileNo, password })
    if (
      [fullname, enrollmentNo, email, mobileNo, password].some(
        (field) => !field || field.trim() === ""
      )
    ) {
      throw new ApiError(402, "All fields are required....!");
    }

    const existUser = await User.findOne({
      $or: [{ enrollmentNo }, { mobileNo }],
    });
    if (existUser) {
      throw new ApiError(
        402,
        "User already exists with Enrollment Number or Mobile Number. Please check..!"
      );
    }

    const user = await User.create({
      fullname,
      enrollmentNo,
      email,
      mobileNo,
      password,
    });
    if (!user) {
      throw new ApiError(
        500,
        "Something went wrong during registering the user"
      );
    }

    res
      .status(200)
      .json(new ApiResponse(200, user, "User registered successfully"));
  } catch (error) {
    next(error);
  }
});

const loginUser = asyncHandler(async (req, res, next) => {
  const { enrollmentNo, mobileNo, password } = req.body;
  console.log({ enrollmentNo, mobileNo, password });

  if (!enrollmentNo && !mobileNo) {
    throw new ApiError(401, "Enrollment or Mobile Number Required..!");
  }

  const user = await User.findOne({ $or: [{ enrollmentNo }, { mobileNo }] });

  if (!user) {
    throw new ApiError(402, "User Does Not Exist....");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Incorrect Password..!");
  }

  const tokens = await generateAccessTokenAndRefreshToken(user._id);
  if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
    throw new ApiError(500, "Failed to generate tokens.");
  }
  // console.log(tokens);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  res
    .status(200)
    .cookie("accessToken", tokens.accessToken, options)
    .cookie("refreshToken", tokens.refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          loggedInUser,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        "Log In User Successfully.."
      )
    );
});
const logOutUser = asyncHandler(async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $unset: {
          refreshToken: 1,
        },
      },
      {
        new: true,
      }
    );
    res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User Log Out Successfully"));
  } catch (error) {
    next(ApiError(error.message));
  }
});
const refreshAccessToken = asyncHandler(async (req, res, next) => {
  try {
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;
    // console.log(incomingRefreshToken);
    if (!incomingRefreshToken) {
      throw new ApiError(404, "unauthorized request...");
    }
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(401, "Invalid RefreshToken...");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refreshToken is expired or used");
    }
    const { accessToken, newRefreshToken } = generateAccessTokenAndRefreshToken(
      user._id
    );

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "AccessToken Refreshed successfully..!"
        )
      );
  } catch (error) {
    next(error);
  }
});

const getCurrentUser = asyncHandler(async (req, res, next) => {
  console.log(req.user._id)
  try {
    const user = await User.findOne(req.user._id).select(
      "-password -refreshToken -accessToken"
    );
    console.log(user);
    res
      .status(200)
      .json(new ApiResponse(200, { user }, "Get User Successfully.....!"));
  } catch (error) {
    next(error);
  }
});

const changePassword = asyncHandler(async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confPassword } = req.body;
    // console.log({ currentPassword, newPassword, confPassword });
    if (
      [currentPassword, newPassword, confPassword].some(
        (field) => field.trim() === ""
      )
    ) {
      throw new ApiError(402, "All fields are required....");
    }
    if (newPassword !== confPassword) {
      throw new ApiError(402, "New Password and Confirm Password not same..!");
    }
    const user = req.user;
    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);
    if (!isPasswordCorrect) {
      throw new ApiError(400, "Password Incorrect");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Change Password successfully..!"));
  } catch (error) {
    next(error);
  }
});
const updateAccountDetails = asyncHandler(async (req, res, next) => {
  const { fullname, enrollmentNo, email, mobileNo } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        email: email,
        fullname: fullname,
        mobileNo: mobileNo,
        enrollmentNo: enrollmentNo,
      },
    },
    {
      new: true,
    }
  );
  return res
  .status(200)
  .json(new ApiResponse(200,{user},"Update Details Successfully..!"))
});

 const searchUser = asyncHandler(async(req,res,next)=>{
  try {
    const {mobileNo} = req.params
    if(!mobileNo){
     throw new ApiError("User Not Found.....")
    }
    const user = await User.findOne({mobileNo:mobileNo})
    if(!user){
        throw new ApiError(404,"user not Found..!")
    }
    res.status(200)
    .json(new ApiResponse(200,user,"User find successfully..!"))
  } catch (error) {
    next(error)
  }
 })
export {
  UserRegister,
  loginUser,
  logOutUser,
  refreshAccessToken,
  getCurrentUser,
  changePassword,
  updateAccountDetails,
  searchUser
};
