import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrorHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Department } from "../models/department.model.js";

// POST /api/v1/departments
export const createDepartment = asyncHandler(async (req, res, next) => {
  const { name, code, description, organizationId } = req.body;

  if (!name) {
    throw new ApiError(400, "Department name is required");
  }

  // Resolve organizationId
  let orgId = organizationId;
  if (req.user.role !== "super_admin") {
    orgId = req.user.organizationId;
  }

  if (!orgId) {
    throw new ApiError(400, "Organization ID is required for department creation.");
  }

  const existingDept = await Department.findOne({ name, organizationId: orgId });
  if (existingDept) {
    throw new ApiError(400, "Department name already exists in this organization.");
  }

  const department = await Department.create({
    name,
    code: code ? code.toUpperCase() : undefined,
    description,
    organizationId: orgId,
  });

  res.status(201).json(
    new ApiResponse(201, { department }, "Department created successfully.")
  );
});

// GET /api/v1/departments
export const getDepartments = asyncHandler(async (req, res, next) => {
  const { organizationId } = req.query;

  // Resolve filter
  let query = {};
  if (req.user.role !== "super_admin") {
    query.organizationId = req.user.organizationId;
  } else if (organizationId) {
    query.organizationId = organizationId;
  }

  const departments = await Department.find(query).sort({ name: 1 });

  res.status(200).json(
    new ApiResponse(200, { departments }, "Departments fetched successfully.")
  );
});

// PUT /api/v1/departments/:id
export const updateDepartment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, code, description } = req.body;

  const department = await Department.findById(id);
  if (!department) {
    throw new ApiError(404, "Department not found.");
  }

  // Auth check
  if (req.user.role !== "super_admin" && (!req.user.organizationId || !req.user.organizationId.equals(department.organizationId))) {
    throw new ApiError(403, "You do not have permission to edit this department.");
  }

  if (name) department.name = name;
  if (code) department.code = code.toUpperCase();
  if (description !== undefined) department.description = description;

  await department.save();

  res.status(200).json(
    new ApiResponse(200, { department }, "Department updated successfully.")
  );
});

// DELETE /api/v1/departments/:id
export const deleteDepartment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const department = await Department.findById(id);
  if (!department) {
    throw new ApiError(404, "Department not found.");
  }

  // Auth check
  if (req.user.role !== "super_admin" && (!req.user.organizationId || !req.user.organizationId.equals(department.organizationId))) {
    throw new ApiError(403, "You do not have permission to delete this department.");
  }

  await Department.findByIdAndDelete(id);

  res.status(200).json(
    new ApiResponse(200, null, "Department deleted successfully.")
  );
});
