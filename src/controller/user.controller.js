import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Class } from "../models/class.model.js";
import jwt from "jsonwebtoken";

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
const userWelcome = asyncHandler(async (req, res, next) => {
  try {
    console.log("Request received..!");
    res
      .status(200)
      .json(
        new ApiResponse(200, { message: "Hello world" }, "Request received..!")
      );
  } catch (error) {
    next(error);
  }
});
const UserRegister = asyncHandler(async (req, res, next) => {
  try {
    const { fullname, enrollmentNo, email, mobileNo, password, age, class: userClass, rollNo, role } = req.body;
    // console.log({ fullname, enrollmentNo, email, mobileNo, password, age, class: userClass, rollNo, role });
    if (
      !fullname || !enrollmentNo || !email || !mobileNo || !password || !userClass || !rollNo ||
      [fullname, enrollmentNo, email, mobileNo, password, userClass, rollNo].some(
        (field) => typeof field !== "string" || field.trim() === ""
      )
    ) {
      throw new ApiError(400, "All fields are required");
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
      age,
      class: userClass,
      rollNo,
      role: role || "student",
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

  if (!enrollmentNo && !mobileNo) {
    throw new ApiError(401, "Enrollment or Mobile Number Required..!");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const query = [];
  if (enrollmentNo) query.push({ enrollmentNo });
  if (mobileNo) query.push({ mobileNo });

  const user = await User.findOne({ $or: query });

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

  const loggedInUser = await User.findByIdAndUpdate(
    user._id,
    { $set: { isLoggedIn: true }, $inc: { logCount: 1 } },
    { new: true }
  ).select("-password -refreshToken");

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
        $set: {
          isLoggedIn: false,
        },
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
    next(new ApiError(500, error.message));
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
    const { accessToken, refreshToken: newRefreshToken } = await generateAccessTokenAndRefreshToken(
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
  try {
    const user = await User.findById(req.user?._id).select(
      "-password -refreshToken -accessToken"
    );
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
    if (
      !currentPassword || !newPassword || !confPassword ||
      [currentPassword, newPassword, confPassword].some(
        (field) => typeof field !== "string" || field.trim() === ""
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
  const { fullname, enrollmentNo, email, mobileNo, class: userClass, rollNo } = req.body;

  if (
    [fullname, enrollmentNo, email, mobileNo, userClass, rollNo].some(
      (field) => field !== undefined && (typeof field !== "string" || field.trim() === "")
    )
  ) {
    throw new ApiError(400, "Fields cannot be empty values.");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        email: email,
        fullname: fullname,
        mobileNo: mobileNo,
        enrollmentNo: enrollmentNo,
        class: userClass,
        rollNo: rollNo,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Update Details Successfully..!"));
});

const searchUser = asyncHandler(async (req, res, next) => {
  try {
    const { mobileNo } = req.params;
    if (!mobileNo) {
      throw new ApiError(400, "Mobile Number is required");
    }
    const user = await User.findOne({ mobileNo: mobileNo }).select("-password -refreshToken -accessToken");
    if (!user) {
      throw new ApiError(404, "User not found..!");
    }
    res
      .status(200)
      .json(new ApiResponse(200, user, "User found successfully..!"));
  } catch (error) {
    next(error);
  }
});

const getAllClasses = asyncHandler(async (req, res, next) => {
  try {
    const classes = await Class.find().sort({ name: 1 });
    res.status(200).json(
      new ApiResponse(200, { classes }, "Classes fetched successfully")
    );
  } catch (error) {
    next(error);
  }
});

export {
  UserRegister,
  loginUser,
  logOutUser,
  refreshAccessToken,
  getCurrentUser,
  changePassword,
  updateAccountDetails,
  searchUser,
  userWelcome,
  getAllClasses,
};
