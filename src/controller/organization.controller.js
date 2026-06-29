import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Organization } from "../models/organization.model.js";
import { User } from "../models/user.model.js";

// POST /api/v1/organizations
export const registerOrganization = asyncHandler(async (req, res, next) => {
  const {
    name,
    type,
    email,
    phone,
    address,
    adminName,
    adminEmail,
    adminMobileNo,
    adminPassword,
  } = req.body;

  if (
    !name ||
    !type ||
    !email ||
    !adminName ||
    !adminEmail ||
    !adminMobileNo ||
    !adminPassword
  ) {
    throw new ApiError(400, "Organization and Admin details are required");
  }

  // Validate type
  if (!["college", "company"].includes(type.toLowerCase())) {
    throw new ApiError(400, "Organization type must be 'college' or 'company'");
  }

  // Check if Admin user already exists
  const existingUser = await User.findOne({
    $or: [{ email: adminEmail }, { mobileNo: adminMobileNo }],
  });

  if (existingUser) {
    throw new ApiError(
      400,
      "An account with this email or mobile number already exists."
    );
  }

  // Create Organization
  const organization = await Organization.create({
    name,
    type: type.toLowerCase(),
    email,
    phone,
    address,
    status: "active",
  });

  if (!organization) {
    throw new ApiError(500, "Failed to register organization.");
  }

  // Create Admin User
  const adminUser = await User.create({
    fullname: adminName,
    name: adminName,
    email: adminEmail,
    mobileNo: adminMobileNo,
    password: adminPassword,
    role: "superuser",
    organizationId: organization._id,
    isActive: true,
  });

  if (!adminUser) {
    // Rollback organization creation
    await Organization.findByIdAndDelete(organization._id);
    throw new ApiError(500, "Failed to create organization admin account.");
  }

  // Update createdBy on Organization
  organization.createdBy = adminUser._id;
  await organization.save();

  // Remove password from response user
  const responseAdmin = await User.findById(adminUser._id).select("-password -refreshToken");

  res.status(201).json(
    new ApiResponse(
      201,
      { organization, admin: responseAdmin },
      "Organization and Admin account registered successfully."
    )
  );
});

// GET /api/v1/organizations/:id
export const getOrganization = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.status(200).json(
    new ApiResponse(200, { organization }, "Organization details fetched successfully.")
  );
});

// PUT /api/v1/organizations/:id
export const updateOrganization = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, email, phone, address, status } = req.body;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  // Authorize check: only super_admin, or admin of this specific organization
  if (req.user.role !== "super_admin" && (!req.user.organizationId || !req.user.organizationId.equals(organization._id))) {
    throw new ApiError(403, "You do not have permission to modify this organization.");
  }

  if (name) organization.name = name;
  if (email) organization.email = email;
  if (phone) organization.phone = phone;
  if (address) organization.address = address;
  if (status && req.user.role === "super_admin") organization.status = status; // Only super_admin can change status

  await organization.save();

  res.status(200).json(
    new ApiResponse(200, { organization }, "Organization updated successfully.")
  );
});

// GET /api/v1/organizations (List all organizations - Super Admin only)
export const getAllOrganizations = asyncHandler(async (req, res, next) => {
  const organizations = await Organization.find();
  res.status(200).json(
    new ApiResponse(200, { organizations }, "Organizations list fetched successfully.")
  );
});

// GET /api/v1/public/organizations (Public list of active organizations - name and id only)
export const getPublicOrganizations = asyncHandler(async (req, res, next) => {
  const organizations = await Organization.find({ status: "active" }).select("_id name");
  res.status(200).json(
    new ApiResponse(200, { organizations }, "Public organizations list fetched successfully.")
  );
});
