import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";

export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName description permissions");

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

export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
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
    next(errorHandler(500, "Server error while updating profile"));
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return next(errorHandler(400, "Current password and new password are required"));
    }

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const ok = bcrypt.compareSync(currentPassword, user.password);
    if (!ok) {
      return next(errorHandler(400, "Current password is incorrect"));
    }

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

export const getNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (role) {
      const roleDoc = await Role.findOne({ name: String(role).toLowerCase() });
      if (!roleDoc) {
        return next(errorHandler(404, "Role not found"));
      }
      query.roles = roleDoc._id;
    }

    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
    if (status === "verified") query.emailVerified = true;
    else if (status === "unverified") query.emailVerified = false;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

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

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName description permissions");

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

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, email, avatar } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    if (email) {
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

    if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }

    await user.save();

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
          isActive: user.isActive
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating user"));
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

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

export const setUserAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const validRoles = ["admin", "staff", "customer"];
    if (!validRoles.includes(role)) {
      return next(errorHandler(400, "Invalid role"));
    }

    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

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

export const getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
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

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    if (req.user && String(req.user._id) === String(userId)) {
      return next(errorHandler(400, "You cannot delete your own account"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while deleting user"));
  }
};

export const adminCreateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, roleName, company, address, city, country } = req.body;

    if (!firstName || !lastName || !email || !phone) {
      return next(errorHandler(400, "firstName, lastName, email and phone are required"));
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });
    if (existing) {
      return next(
        errorHandler(400, `A user with this ${existing.email === email ? "email" : "phone"} already exists`)
      );
    }

    const passwordHash = bcrypt.hashSync(String(phone), 12);
    const roleToAssign = roleName ? String(roleName).toLowerCase() : "customer";
    const roleDoc = await Role.findOne({ name: roleToAssign });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: passwordHash,
      roles: [roleDoc._id],
      company,
      address,
      city,
      country,
      isActive: true,
      emailVerified: false
    });

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
          company: user.company,
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

export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    if (!roleName) {
      return next(errorHandler(400, "roleName is required"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const roleDoc = await Role.findOne({ name: String(roleName).toLowerCase() });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    const roleId = roleDoc._id.toString();
    const normalizedRoles = (user.roles || []).map((role: any) => (role?._id ? role._id : role));
    const hasRole = normalizedRoles.some((role: any) => role.toString() === roleId);
    if (!hasRole) {
      user.roles = [...normalizedRoles, roleDoc._id] as any;
      await user.save();
    }

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

export const removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, roleId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const currentRoles = (user.roles || []).map((role: any) => (role?._id ? role._id : role));
    if (currentRoles.length <= 1) {
      return next(errorHandler(400, "User must have at least one role"));
    }

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

export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const customerRole = await Role.findOne({ name: "customer" });

    if (!customerRole) {
      return next(errorHandler(404, "Customer role not found. Please run seed script first."));
    }

    const query: any = { roles: customerRole._id };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } }
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
    next(errorHandler(500, "Server error while fetching customers"));
  }
};
