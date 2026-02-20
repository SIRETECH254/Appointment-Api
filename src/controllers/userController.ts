import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
import { deleteFromCloudinary, uploadToCloudinary } from "../config/cloudinary";

// Get authenticated user profile with roles
export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Load user with populated roles and services
    const user = await User.findById(req.user?._id)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName description permissions isActive")
      .populate("services", "name duration fullPrice sortOrder isActive");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching user profile"));
  }
};

// Update authenticated user's basic profile fields
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply profile updates
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) {
      if (!validator.isMobilePhone(phone)) {
        return next(errorHandler(400, "Please provide a valid phone number"));
      }

      const existingUser = await User.findOne({
        phone,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return next(errorHandler(400, "Phone number is already taken by another user"));
      }

      user.phone = phone;
    }

    // Handle avatar upload via multipart/form-data
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "appointment/avatars");

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          emailVerified: user.emailVerified
        }
      }
    });
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.phone) {
      return next(errorHandler(400, "Phone number is already taken by another user"));
    }
    next(errorHandler(500, "Server error while updating profile"));
  }
};

// Change password after verifying current password
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    // Require both current and new password
    if (!currentPassword || !newPassword) {
      return next(errorHandler(400, "Current password and new password are required"));
    }

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Verify current password
    const ok = bcrypt.compareSync(currentPassword, user.password);
    if (!ok) {
      return next(errorHandler(400, "Current password is incorrect"));
    }

    // Hash and store new password
    user.password = bcrypt.hashSync(newPassword, 12);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while changing password"));
  }
};

// Get user's notification preferences
export const getNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Fetch notification preferences only
    const user = await User.findById(req.user?._id).select("notificationPreferences");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { notificationPreferences: user.notificationPreferences || {} }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching notification preferences"));
  }
};

// Update user's notification preferences
export const updateNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, sms, inApp } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Merge provided preferences
    user.notificationPreferences = user.notificationPreferences || {};
    if (email !== undefined) user.notificationPreferences.email = email;
    if (sms !== undefined) user.notificationPreferences.sms = sms;
    if (inApp !== undefined) user.notificationPreferences.inApp = inApp;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      data: { notificationPreferences: user.notificationPreferences }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating notification preferences"));
  }
};

// Admin list of users with filters and pagination
export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const query: any = {};

    // Apply text search filters
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    // Resolve role name to role id
    if (role) {
      const roleDoc = await Role.findOne({ name: String(role).toLowerCase() });
      if (!roleDoc) {
        return next(errorHandler(404, "Role not found"));
      }
      query.roles = roleDoc._id;
    }

    // Status filters
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
    if (status === "verified") query.emailVerified = true;
    else if (status === "unverified") query.emailVerified = false;

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query users with pagination
    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .populate("services", "name duration fullPrice sortOrder isActive")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
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
    next(errorHandler(500, "Server error while fetching users"));
  }
};

// Admin get a single user by ID
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    // Load target user with role and service details
    const user = await User.findById(userId)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName description permissions")
      .populate("services", "name duration fullPrice sortOrder isActive");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching user"));
  }
};

// Admin update user profile fields
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, email, avatar, workingHours } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply admin edits
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    if (email) {
      // Validate and enforce unique email
      if (!validator.isEmail(email)) {
        return next(errorHandler(400, "Please provide a valid email"));
      }

      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });

      if (existingUser) {
        return next(errorHandler(400, "Email is already taken by another user"));
      }

      user.email = email.toLowerCase();
    }

    if (workingHours !== undefined) {
      if (typeof workingHours !== "object" || Array.isArray(workingHours)) {
        return next(errorHandler(400, "workingHours must be an object"));
      }
      user.workingHours = workingHours;
    }

    // Handle avatar upload via multipart/form-data
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "appointment/avatars");

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }

    await user.save();

    const roleNames = (user.roles || []).map((role: any) =>
      role?._id ? role._id.toString() : role.toString()
    );
    const staffRole = await Role.findOne({ name: "staff" }).select("_id");
    const isStaff = staffRole ? roleNames.includes(staffRole._id.toString()) : false;

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          ...(isStaff && {
            workingHours: user.workingHours,
            services: user.services
          })
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating user"));
  }
};

// Admin activate/deactivate a user
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const user = await User.findById(userId);

    // Ensure user exists
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply status change if provided
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating user status"));
  }
};

// Set a single primary role (legacy admin endpoint)
export const setUserAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Validate role against allowed list
    const validRoles = ["admin", "staff", "customer"];
    if (!validRoles.includes(role)) {
      return next(errorHandler(400, "Invalid role"));
    }

    // Resolve role document
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    // Replace roles array with a single role
    user.roles = [roleDoc._id];
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating user admin status"));
  }
};

// Get roles assigned to a user
export const getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    // Load user with role details
    const user = await User.findById(userId).populate("roles", "name displayName description permissions");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching user roles"));
  }
};

// Delete a user (admin only)
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    // Prevent deleting self
    if (req.user && String(req.user._id) === String(userId)) {
      return next(errorHandler(400, "You cannot delete your own account"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Delete user record
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while deleting user"));
  }
};

// Admin create customer with default role assignment
export const adminCreateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, roleName, address, city, country } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      return next(errorHandler(400, "firstName, lastName, email and phone are required"));
    }

    // Enforce unique email/phone
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });
    if (existing) {
      return next(
        errorHandler(400, `A user with this ${existing.email === email ? "email" : "phone"} already exists`)
      );
    }

    // Hash phone as initial password
    const passwordHash = bcrypt.hashSync(String(phone), 12);
    const roleToAssign = roleName ? String(roleName).toLowerCase() : "customer";
    // Resolve role for assignment
    const roleDoc = await Role.findOne({ name: roleToAssign });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    // Create user document
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: passwordHash,
      roles: [roleDoc._id],
      address,
      city,
      country,
      isActive: true,
      emailVerified: false
    });

    // Populate roles for response
    await user.populate("roles", "name displayName");

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          address: user.address,
          city: user.city,
          country: user.country,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while creating customer"));
  }
};

// Assign an additional role to a user
export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    // Require role name
    if (!roleName) {
      return next(errorHandler(400, "roleName is required"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Lookup role by name
    const roleDoc = await Role.findOne({ name: String(roleName).toLowerCase() });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    // Add role if not already assigned
    const roleId = roleDoc._id.toString();
    const normalizedRoles = (user.roles || []).map((role: any) => (role?._id ? role._id : role));
    const hasRole = normalizedRoles.some((role: any) => role.toString() === roleId);
    if (!hasRole) {
      user.roles = [...normalizedRoles, roleDoc._id] as any;
      await user.save();
    }

    // Populate roles for response
    await user.populate("roles", "name displayName");

    res.status(200).json({
      success: true,
      message: "Role assigned successfully",
      data: {
        user: {
          id: user._id,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while assigning role"));
  }
};

// Remove a role from a user (leave at least one)
export const removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, roleId } = req.params;
    const user = await User.findById(userId);

    // Ensure user exists
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Normalize roles and enforce at least one role
    const currentRoles = (user.roles || []).map((role: any) => (role?._id ? role._id : role));
    if (currentRoles.length <= 1) {
      return next(errorHandler(400, "User must have at least one role"));
    }

    // Remove role from user
    user.roles = currentRoles.filter((role: any) => role.toString() !== roleId) as any;
    await user.save();
    await user.populate("roles", "name displayName");

    res.status(200).json({
      success: true,
      message: "Role removed successfully",
      data: {
        user: {
          id: user._id,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while removing role"));
  }
};

// Admin list of customers by role
export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const customerRole = await Role.findOne({ name: "customer" });

    // Ensure customer role exists
    if (!customerRole) {
      return next(errorHandler(404, "Customer role not found. Please run seed script first."));
    }

    // Build query filters
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

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query customers with pagination
    const customers = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
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
    next(errorHandler(500, "Server error while fetching customers"));
  }
};

// Admin list of staff by role
export const getStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const staffRole = await Role.findOne({ name: "staff" });

    // Ensure staff role exists
    if (!staffRole) {
      return next(errorHandler(404, "Staff role not found. Please run seed script first."));
    }

    // Build query filters
    const query: any = { roles: staffRole._id };

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

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query staff with pagination
    const staff = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .populate("services", "name duration fullPrice sortOrder isActive")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        staff,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalStaff: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching staff"));
  }
};
