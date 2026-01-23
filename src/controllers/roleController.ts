import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Role from "../models/Role";
import User from "../models/User";

// List roles with optional filters
export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive, search } = req.query;
    const query: any = {};

    // Optional filters
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Search by name/display/description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const roles = await Role.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: { roles }
    });
  } catch (error: any) {
    console.error("Get all roles error:", error);
    next(errorHandler(500, "Server error while fetching roles"));
  }
};

// Get a single role by ID
export const getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId);

    // Ensure role exists
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    res.status(200).json({
      success: true,
      data: { role }
    });
  } catch (error: any) {
    console.error("Get role error:", error);
    next(errorHandler(500, "Server error while fetching role"));
  }
};

// Create a new custom role
export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, displayName, description, permissions, isActive } = req.body;

    // Validate required fields
    if (!name || !displayName) {
      return next(errorHandler(400, "Name and display name are required"));
    }

    // Ensure role name is unique
    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return next(errorHandler(400, "Role with this name already exists"));
    }

    // Create a non-system role
    const role = new Role({
      name: name.toLowerCase(),
      displayName,
      description,
      permissions: permissions || [],
      isActive: isActive !== undefined ? isActive : true,
      isSystemRole: false
    });

    await role.save();

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: { role }
    });
  } catch (error: any) {
    console.error("Create role error:", error);
    next(errorHandler(500, "Server error while creating role"));
  }
};

// Update role metadata and permissions
export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const { displayName, description, permissions, isActive } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    // Block renaming system roles
    if (role.isSystemRole && req.body.name && req.body.name !== role.name) {
      return next(errorHandler(400, "Cannot change system role name"));
    }

    if (displayName) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;

    await role.save();

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: { role }
    });
  } catch (error: any) {
    console.error("Update role error:", error);
    next(errorHandler(500, "Server error while updating role"));
  }
};

// Delete a non-system role if unused
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId);

    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return next(errorHandler(400, "Cannot delete system roles"));
    }

    // Ensure no users still reference this role
    const usersWithRole = await User.countDocuments({ roles: roleId });
    if (usersWithRole > 0) {
      return next(
        errorHandler(
          400,
          `Cannot delete role. ${usersWithRole} user(s) have this role assigned. Please reassign users first.`
        )
      );
    }

    await Role.findByIdAndDelete(roleId);

    res.status(200).json({
      success: true,
      message: "Role deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete role error:", error);
    next(errorHandler(500, "Server error while deleting role"));
  }
};

// List users assigned to a role
export const getUsersByRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const { page = 1, limit = 10, search, isActive } = req.query;

    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    // Build query with filters
    const query: any = { roles: roleId };
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Fetch users and pagination stats
    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        role: {
          id: role._id,
          name: role.name,
          displayName: role.displayName
        },
        users,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalUsers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get users by role error:", error);
    next(errorHandler(500, "Server error while fetching users by role"));
  }
};

// List users with the customer role
export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const customerRole = await Role.findOne({ name: "customer" });

    // Ensure customer role exists
    if (!customerRole) {
      return next(errorHandler(404, "Customer role not found. Please run seed script first."));
    }

    // Build customer filter
    const query: any = { roles: customerRole._id };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    if (status === "verified") {
      query.emailVerified = true;
    } else if (status === "unverified") {
      query.emailVerified = false;
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const customers = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        customers,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalCustomers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get customers error:", error);
    next(errorHandler(500, "Server error while fetching customers"));
  }
};
