import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import crypto from "crypto";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
import { generateTokens, generateOTP } from "../utils/authHelpers";
import {
  sendOTPNotification,
  sendPasswordResetNotification,
  sendWelcomeNotification
} from "../services/internal/notificationService";

// Register new user with OTP and default role assignment
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role
    }: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
      role?: string;
    } = req.body;

    // Basic required field validation
    if (!firstName || !lastName || !email || !phone || !password) {
      return next(errorHandler(400, "All fields are required"));
    }

    // Validate email and phone formats
    if (!validator.isEmail(email)) {
      return next(errorHandler(400, "Please provide a valid email"));
    }

    if (!validator.isMobilePhone(phone)) {
      return next(errorHandler(400, "Please provide a valid phone number"));
    }

    // Check for existing user by email or phone
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });

    if (existingUser) {
      return next(errorHandler(400, "User already exists with this email or phone"));
    }

    // Hash password and generate OTP
    const hashedPassword = bcrypt.hashSync(password, 12);
    const otp = generateOTP();
    const otpExpiry = new Date(
      Date.now() + parseInt(process.env.OTP_EXP_MINUTES || "10", 10) * 60 * 1000
    );

    let assignedRoles: any[] = [];
    // Resolve role assignment (default customer)
    if (role) {
      const specifiedRole = await Role.findOne({ name: role.toLowerCase() });
      if (specifiedRole) {
        assignedRoles = [specifiedRole._id];
      } else {
        return next(errorHandler(400, `Role "${role}" not found`));
      }
    } else {
      const customerRole = await Role.findOne({ name: "customer" });
      if (!customerRole) {
        return next(
          errorHandler(500, "Default customer role not found. Please run seed script first.")
        );
      }
      assignedRoles = [customerRole._id];
    }

    // Persist user with OTP details
    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      roles: assignedRoles,
      otpCode: otp,
      otpExpiry,
      emailVerified: false
    });

    await user.save();

    // Send OTP via email and SMS
    await sendOTPNotification(email, phone, otp, `${firstName} ${lastName}`);
    
    await user.populate("roles", "name displayName");

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your email with the OTP sent.",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        roles: user.roles,
        emailVerified: user.emailVerified
      }
    });
  } catch (error: any) {
    console.error("Register error:", error);
    next(errorHandler(500, "Server error during registration"));
  }
};

// Verify OTP and activate user account
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, otp }: { email?: string; phone?: string; otp: string } = req.body;

    // Ensure OTP and identifier provided
    if (!otp) {
      return next(errorHandler(400, "OTP is required"));
    }

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    // Find user by email or phone (include OTP fields)
    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+otpCode +otpExpiry");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Verify OTP expiry and value
    if (user.otpExpiry && user.otpExpiry < new Date()) {
      return next(errorHandler(400, "OTP has expired. Please request a new one"));
    }

    if (user.otpCode !== otp.trim()) {
      return next(errorHandler(400, "Incorrect OTP code"));
    }

    // Mark user verified and clear OTP
    user.emailVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Send welcome notification and issue tokens
    await sendWelcomeNotification(user.email, user.phone, `${user.firstName} ${user.lastName}`);
    await user.populate("roles", "name displayName");

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          emailVerified: user.emailVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    next(errorHandler(500, "Server error during OTP verification"));
  }
};

// Resend OTP for pending verification
export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone } = req.body;

    // Require at least one identifier
    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    // Find unverified user
    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.emailVerified) {
      return next(errorHandler(400, "Account is already verified"));
    }

    // Generate fresh OTP and expiry
    const otp = generateOTP();
    const otpExpiry = new Date(
      Date.now() + parseInt(process.env.OTP_EXP_MINUTES || "10", 10) * 60 * 1000
    );

    user.otpCode = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    await sendOTPNotification(user.email, user.phone, otp, `${user.firstName} ${user.lastName}`);

    res.status(200).json({
      success: true,
      message: "OTP has been resent to your email and phone",
      data: {
        userId: user._id,
        email: user.email,
        phone: user.phone,
        otpExpiry
      }
    });
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    next(errorHandler(500, "Server error during OTP resend"));
  }
};

// Authenticate user and issue access/refresh tokens
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, password }: { email?: string; phone?: string; password: string } = req.body;

    // Require login credentials
    if (!password) {
      return next(errorHandler(400, "Password is required"));
    }

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    // Find user by email or phone
    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return next(errorHandler(401, email ? "Email does not exist" : "Phone number does not exist"));
    }

    // Validate password and account status
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return next(errorHandler(401, "Password is incorrect"));
    }

    if (!user.emailVerified) {
      return next(errorHandler(403, "Please verify your email before logging in"));
    }

    if (!user.isActive) {
      return next(errorHandler(403, "Account is deactivated. Please contact support."));
    }

    // Update last login and issue tokens
    user.lastLoginAt = new Date();
    await user.save();

    await user.populate("roles", "name displayName");
    const { accessToken, refreshToken } = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          emailVerified: user.emailVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error("Login error:", error);
    next(errorHandler(500, "Server error during login"));
  }
};

// Return logout response (client clears tokens)
export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    next(errorHandler(500, "Server error during logout"));
  }
};

// Create password reset token and send instructions
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    // Require email for reset
    if (!email) {
      return next(errorHandler(400, "Email is required"));
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return next(errorHandler(404, "No user found with this email"));
    }

    // Generate reset token and expiry
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetExpiry;
    await user.save();

    await sendPasswordResetNotification(
      user.email,
      user.phone,
      resetToken,
      `${user.firstName} ${user.lastName}`
    );

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent to your email and phone"
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    next(errorHandler(500, "Server error during password reset request"));
  }
};

// Reset password using a valid reset token
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Validate reset request
    if (!token || !newPassword) {
      return next(errorHandler(400, "Token and new password are required"));
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    }).select("+password");

    if (!user) {
      return next(errorHandler(400, "Invalid or expired reset token"));
    }

    // Hash and update password, clear reset fields
    user.password = bcrypt.hashSync(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    next(errorHandler(500, "Server error during password reset"));
  }
};

// Exchange refresh token for new token pair
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    // Require refresh token
    if (!refreshToken) {
      return next(errorHandler(400, "Refresh token is required"));
    }

    // Verify refresh token and user status
    const decoded = jwt.verify(
      refreshToken,
      (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string
    ) as any;

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(errorHandler(403, "User not found or inactive"));
    }

    // Issue new access/refresh tokens
    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: tokens
    });
  } catch (error: any) {
    console.error("Refresh token error:", error);
    next(errorHandler(403, "Invalid refresh token"));
  }
};

// Get current authenticated user profile
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Load current user profile with populated roles
    const userId = req.user?._id;
    const user = await User.findById(userId)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName description permissions");

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
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: any) {
    console.error("Get me error:", error);
    next(errorHandler(500, "Server error while fetching user profile"));
  }
};
