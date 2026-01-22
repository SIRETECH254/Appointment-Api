import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { errorHandler } from "./errorHandler";
import type { IUserResponse } from "../types/index";

declare global {
  namespace Express {
    interface Request {
      user?: IUserResponse;
    }
  }
}

// Verify JWT and attach user to request
export const authenticateToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract bearer token
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next(errorHandler(401, "Access token required"));
    }

    // Verify JWT and load user
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await User.findById(decoded.userId).populate("roles", "name displayName");

    if (!user) {
      return next(errorHandler(401, "User not found"));
    }

    if (!user.isActive) {
      return next(errorHandler(401, "User account is deactivated"));
    }

    // Normalize role names for easy checks
    const roleNames = user.roles && Array.isArray(user.roles)
      ? user.roles.map((role: any) => role.name || role)
      : [];

    req.user = {
      ...user.toObject(),
      roleNames
    } as IUserResponse;

    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      return next(errorHandler(401, "Invalid token"));
    }
    if (error.name === "TokenExpiredError") {
      return next(errorHandler(401, "Token expired"));
    }
    return next(errorHandler(500, "Authentication error"));
  }
};

// Ensure user has one of the allowed roles
export const authorizeRoles = (allowedRoles: string[] = []) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Require authenticated user
      if (!req.user) {
        return next(errorHandler(401, "Authentication required"));
      }

      // Check if user has any allowed role
      const userRoleNames = req.user.roleNames || [];
      const hasAllowedRole = allowedRoles.some((role) => userRoleNames.includes(role));

      if (!hasAllowedRole) {
        return next(errorHandler(403, "Insufficient permissions"));
      }

      next();
    } catch (error: any) {
      return next(errorHandler(500, "Authorization error"));
    }
  };
};

// Require admin role for protected actions
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    // Require authenticated user
    if (!req.user) {
      return next(errorHandler(401, "Authentication required"));
    }

    // Require admin role
    const userRoleNames = req.user.roleNames || [];
    if (!userRoleNames.includes("admin")) {
      return next(errorHandler(403, "Admin access required"));
    }

    next();
  } catch (error: any) {
    return next(errorHandler(500, "Authorization error"));
  }
};

// Allow owner of resource or admin to proceed
export const requireOwnershipOrAdmin = (resourceUserIdField: string = "userId") => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Require authenticated user
      if (!req.user) {
        return next(errorHandler(401, "Authentication required"));
      }

      // Allow admins without ownership checks
      const userRoleNames = req.user.roleNames || [];
      if (userRoleNames.includes("admin")) {
        return next();
      }

      // Compare resource owner id with current user
      const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
      if (!resourceUserId) {
        return next(errorHandler(400, "Resource user ID not found"));
      }

      if (req.user._id.toString() !== resourceUserId.toString()) {
        return next(errorHandler(403, "Access denied"));
      }

      next();
    } catch (error: any) {
      return next(errorHandler(500, "Authorization error"));
    }
  };
};

// Block access unless email is verified
export const requireEmailVerification = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    // Require authenticated user
    if (!req.user) {
      return next(errorHandler(401, "Authentication required"));
    }

    // Require verified email
    if (!req.user.emailVerified) {
      return next(errorHandler(403, "Email verification required"));
    }

    next();
  } catch (error: any) {
    return next(errorHandler(500, "Verification error"));
  }
};

// Attach user if token exists, otherwise continue
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract token if provided
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

    // Verify token and attach user if valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await User.findById(decoded.userId).populate("roles", "name displayName");

    if (user && user.isActive) {
      const roleNames = user.roles && Array.isArray(user.roles)
        ? user.roles.map((role: any) => role.name || role)
        : [];
      req.user = {
        ...user.toObject(),
        roleNames
      } as IUserResponse;
    }

    next();
  } catch (_error: any) {
    next();
  }
};
