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

export const authenticateToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next(errorHandler(401, "Access token required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await User.findById(decoded.userId).populate("roles", "name displayName");

    if (!user) {
      return next(errorHandler(401, "User not found"));
    }

    if (!user.isActive) {
      return next(errorHandler(401, "User account is deactivated"));
    }

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

export const authorizeRoles = (allowedRoles: string[] = []) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(errorHandler(401, "Authentication required"));
      }

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

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      return next(errorHandler(401, "Authentication required"));
    }

    const userRoleNames = req.user.roleNames || [];
    if (!userRoleNames.includes("admin")) {
      return next(errorHandler(403, "Admin access required"));
    }

    next();
  } catch (error: any) {
    return next(errorHandler(500, "Authorization error"));
  }
};

export const requireOwnershipOrAdmin = (resourceUserIdField: string = "userId") => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(errorHandler(401, "Authentication required"));
      }

      const userRoleNames = req.user.roleNames || [];
      if (userRoleNames.includes("admin")) {
        return next();
      }

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

export const requireEmailVerification = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      return next(errorHandler(401, "Authentication required"));
    }

    if (!req.user.emailVerified) {
      return next(errorHandler(403, "Email verification required"));
    }

    next();
  } catch (error: any) {
    return next(errorHandler(500, "Verification error"));
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

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
