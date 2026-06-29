import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Class } from "../models/class.model.js";
import { Department } from "../models/department.model.js";
import { Organization } from "../models/organization.model.js";
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

// POST /api/v1/user/register
const UserRegister = asyncHandler(async (req, res, next) => {
  try {
    const {
      fullname,
      enrollmentNo,
      email,
      mobileNo,
      password,
      age,
      class: userClass,
      rollNo,
      role,
      department,
      organizationId,
      departmentId,
      designation,
      studentId,
      employeeId,
    } = req.body;

    if (
      !fullname ||
      !email ||
      !mobileNo ||
      !password
    ) {
      throw new ApiError(400, "Fullname, email, mobileNo, and password are required");
    }

    const existUser = await User.findOne({
      $or: [{ enrollmentNo: enrollmentNo || "NON_EXISTENT_VAL" }, { mobileNo }, { email }],
    });
    if (existUser) {
      throw new ApiError(
        402,
        "User already exists with Email, Enrollment Number or Mobile Number. Please check..!"
      );
    }

    // Resolve tenant variables
    let orgId = organizationId;
    let deptId = departmentId;

    if (!orgId) {
      const defaultOrg = await Organization.findOne({ status: "active" });
      if (defaultOrg) {
        orgId = defaultOrg._id;
      } else {
        throw new ApiError(400, "No active organizations found. Please register an organization first.");
      }
    }

    if (department) {
      const resolvedDept = await Department.findOne({
        organizationId: orgId,
        $or: [{ code: department.toUpperCase() }, { name: department }],
      });
      if (!resolvedDept) {
        throw new ApiError(404, `Invalid Department code '${department}' for the selected organization.`);
      }
      deptId = resolvedDept._id;
    } else if (!deptId) {
      throw new ApiError(400, "Department code or ID is required.");
    }

    const resolvedDeptDoc = await Department.findById(deptId);
    const deptCode = resolvedDeptDoc ? resolvedDeptDoc.code : "";
    const deptName = resolvedDeptDoc ? resolvedDeptDoc.name : "";

    const resolvedRole = role === "admin" ? "admin" : "user";
    const resolvedDesignation = (resolvedRole === "admin" && designation) ? designation.trim() : "";
    const resolvedEmployeeId = employeeId ? employeeId.trim() : "";
    const resolvedStudentId = studentId ? studentId.trim() : "";

    const user = await User.create({
      fullname,
      name: fullname,
      enrollmentNo,
      email,
      mobileNo,
      password,
      age,
      class: userClass,
      rollNo,
      role: resolvedRole,
      designation: resolvedDesignation,
      organizationId: orgId,
      departmentId: deptId,
      departmentCode: deptCode,
      departmentName: deptName,
      employeeId: resolvedEmployeeId,
      studentId: resolvedStudentId,
      isActive: true,
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

// POST /api/v1/user/login
const loginUser = asyncHandler(async (req, res, next) => {
  const { enrollmentNo, mobileNo, email, password } = req.body;

  if (!enrollmentNo && !mobileNo && !email) {
    throw new ApiError(401, "Enrollment, Mobile Number, or Email Required..!");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const query = [];
  if (enrollmentNo) query.push({ enrollmentNo });
  if (mobileNo) query.push({ mobileNo });
  if (email) query.push({ email });

  const user = await User.findOne({ $or: query });

  if (!user) {
    throw new ApiError(402, "User Does Not Exist....");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is disabled. Please contact your administrator.");
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

// GET /api/v1/user/logout
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

// POST /api/v1/user/refresh-token
const refreshAccessToken = asyncHandler(async (req, res, next) => {
  try {
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;
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

// GET /api/v1/user/get-current-user
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

// PATCH /api/v1/user/change-password
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

// PATCH /api/v1/user/update-account-details
const updateAccountDetails = asyncHandler(async (req, res, next) => {
  const { fullname, enrollmentNo, email, mobileNo, class: userClass, rollNo, department, departmentId } = req.body;

  if (
    [fullname, enrollmentNo, email, mobileNo, userClass, rollNo, department].some(
      (field) => field !== undefined && (typeof field !== "string" || field.trim() === "")
    )
  ) {
    throw new ApiError(400, "Fields cannot be empty values.");
  }

  const updateFields = {
    email,
    fullname,
    name: fullname,
    mobileNo,
    enrollmentNo,
    class: userClass,
    rollNo,
  };

  // Department changes are locked — only SuperUser can modify department via invite/admin endpoints
  // Admin and User cannot change their own department

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: updateFields,
    },
    {
      new: true,
      runValidators: true,
    }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Update Details Successfully..!"));
});

// GET /api/v1/user/p/:mobileNo
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

// GET /api/v1/user/classes (Legacy helper, fallback to Department list)
const getAllClasses = asyncHandler(async (req, res, next) => {
  try {
    // Return Departments mapped to Class format for legacy compatibility
    let orgId = req.user?.organizationId;
    if (!orgId) {
      const defaultOrg = await Organization.findOne({ status: "active" });
      if (defaultOrg) orgId = defaultOrg._id;
    }

    const departments = await Department.find(orgId ? { organizationId: orgId } : {}).sort({ name: 1 });
    
    // Map Department to Class response format
    const classes = departments.map((d) => ({
      _id: d._id,
      name: d.name,
      code: d.code || d.name.slice(0, 3).toUpperCase(),
    }));

    // If no departments exist, check the legacy Class model
    if (classes.length === 0) {
      const legacyClasses = await Class.find().sort({ name: 1 });
      return res.status(200).json(
        new ApiResponse(200, { classes: legacyClasses }, "Legacy classes fetched successfully")
      );
    }

    res.status(200).json(
      new ApiResponse(200, { classes }, "Departments fetched successfully (mapped as classes)")
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/users (Invite user endpoint - Admin/Super Admin only)
const inviteUser = asyncHandler(async (req, res, next) => {
  const { fullname, email, mobileNo, password, role, departmentId, studentId, employeeId, designation } = req.body;

  if (!fullname || !email || !mobileNo || !password || !role) {
    throw new ApiError(400, "Fullname, email, mobileNo, password, and role are required.");
  }

  // Authorize: Only superuser can invite/create users
  if (req.user.role !== "superuser") {
    throw new ApiError(403, "Access Denied: Only SuperUser can invite users.");
  }

  // Validate role — cannot create another superuser via invite
  if (!['admin', 'user'].includes(role)) {
    throw new ApiError(400, "Invalid role. Allowed roles: admin, user.");
  }

  // Resolve org
  let orgId = req.user.organizationId;
  if (req.body.organizationId) {
    orgId = req.body.organizationId;
  }

  if (!orgId) {
    throw new ApiError(400, "Organization ID is required.");
  }

  // Check unique user
  const existUser = await User.findOne({
    $or: [{ email }, { mobileNo }],
  });
  if (existUser) {
    throw new ApiError(400, "User with this email or mobile number already exists.");
  }

  let deptCode = "";
  let deptName = "";
  if (departmentId) {
    const dept = await Department.findById(departmentId);
    if (dept) {
      deptCode = dept.code || "";
      deptName = dept.name;
    }
  }

  const newUser = await User.create({
    fullname,
    name: fullname,
    email,
    mobileNo,
    password,
    role,
    designation: (role === 'admin' && designation) ? designation.trim() : "",
    organizationId: orgId,
    departmentId,
    departmentCode: deptCode,
    departmentName: deptName,
    studentId,
    employeeId,
    isActive: true,
  });

  const responseUser = await User.findById(newUser._id).select("-password -refreshToken");

  res.status(201).json(
    new ApiResponse(201, { user: responseUser }, "User created and invited successfully.")
  );
});

// GET /api/v1/users (Get users under tenant/department boundaries)
const getUsers = asyncHandler(async (req, res, next) => {
  const { role, departmentId, search } = req.query;
  const filter = {};

  // Apply RBAC filters
  if (req.user.role === "admin") {
    filter.organizationId = req.user.organizationId;
  } else if (req.user.role !== "superuser") {
    throw new ApiError(403, "You do not have access to view this user list.");
  }

  if (role) {
    filter.role = role;
  }
  if (departmentId) {
    filter.departmentId = departmentId;
  }
  if (search) {
    filter.$or = [
      { fullname: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { mobileNo: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filter).select("-password -refreshToken").sort({ fullname: 1 });

  res.status(200).json(
    new ApiResponse(200, { users }, "Users list fetched successfully.")
  );
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
  inviteUser,
  getUsers,
};
