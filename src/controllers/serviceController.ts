import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../middleware/errorHandler";
import Service from "../models/Service";
import User from "../models/User";
import Role from "../models/Role";

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value) && value >= 0;
const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value) && value > 0;

// Create a new service
export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, duration, fullPrice, sortOrder, isActive } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName || duration === undefined || fullPrice === undefined) {
      return next(errorHandler(400, "name, duration and fullPrice are required"));
    }

    if (!isPositiveNumber(duration)) {
      return next(errorHandler(400, "Duration must be a positive number"));
    }

    if (!isNonNegativeNumber(fullPrice)) {
      return next(errorHandler(400, "Full price must be zero or positive"));
    }

    if (sortOrder !== undefined && !isNonNegativeNumber(sortOrder)) {
      return next(errorHandler(400, "Sort order must be zero or positive"));
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return next(errorHandler(400, "isActive must be a boolean"));
    }

    const existingService = await Service.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") }
    });

    if (existingService) {
      return next(errorHandler(400, "Service with this name already exists"));
    }

    const trimmedDescription =
      typeof description === "string" ? description.trim() : "";
    const service = new Service({
      name: trimmedName,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      duration,
      fullPrice,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true
    });

    await service.save();

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: { service }
    });
  } catch (error: any) {
    console.error("Create service error:", error);
    if (error?.code === 11000 && error?.keyPattern?.name) {
      return next(errorHandler(400, "Service with this name already exists"));
    }
    next(errorHandler(500, "Server error while creating service"));
  }
};

// List services with optional filters
export const getServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status, sort } = req.query;
    const query: any = {};

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    let sortOptions: Record<string, 1 | -1> = { sortOrder: 1, name: 1 };

    if (typeof sort === "string" && sort.length > 0) {
      const [field, order] = sort.split(":");
      if (field === "sortOrder" && (order === "asc" || order === "desc")) {
        sortOptions = { sortOrder: order === "asc" ? 1 : -1, name: 1 };
      }
    }

    const services = await Service.find(query).sort(sortOptions);

    res.status(200).json({
      success: true,
      data: { services }
    });
  } catch (error: any) {
    console.error("Get services error:", error);
    next(errorHandler(500, "Server error while fetching services"));
  }
};

// Get a single service by ID
export const getService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const service = await Service.findById(serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    res.status(200).json({
      success: true,
      data: { service }
    });
  } catch (error: any) {
    console.error("Get service error:", error);
    next(errorHandler(500, "Server error while fetching service"));
  }
};

// Update service details
export const updateService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { name, description, duration, fullPrice, sortOrder, isActive } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return next(errorHandler(400, "Name must be a non-empty string"));
      }

      const trimmedName = name.trim();
      const existingService = await Service.findOne({
        _id: { $ne: serviceId },
        name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") }
      });

      if (existingService) {
        return next(errorHandler(400, "Service with this name already exists"));
      }

      service.name = trimmedName;
    }

    if (description !== undefined) {
      if (description === null) {
        service.description = null;
      } else if (typeof description === "string") {
        const trimmedDescription = description.trim();
        service.description = trimmedDescription.length > 0 ? trimmedDescription : null;
      } else {
        return next(errorHandler(400, "Description must be a string"));
      }
    }

    if (duration !== undefined) {
      if (!isPositiveNumber(duration)) {
        return next(errorHandler(400, "Duration must be a positive number"));
      }
      service.duration = duration;
    }

    if (fullPrice !== undefined) {
      if (!isNonNegativeNumber(fullPrice)) {
        return next(errorHandler(400, "Full price must be zero or positive"));
      }
      service.fullPrice = fullPrice;
    }

    if (sortOrder !== undefined) {
      if (!isNonNegativeNumber(sortOrder)) {
        return next(errorHandler(400, "Sort order must be zero or positive"));
      }
      service.sortOrder = sortOrder;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return next(errorHandler(400, "isActive must be a boolean"));
      }
      service.isActive = isActive;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: { service }
    });
  } catch (error: any) {
    console.error("Update service error:", error);
    if (error?.code === 11000 && error?.keyPattern?.name) {
      return next(errorHandler(400, "Service with this name already exists"));
    }
    next(errorHandler(500, "Server error while updating service"));
  }
};

// Delete service
export const deleteService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const service = await Service.findById(serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    await Service.findByIdAndDelete(serviceId);

    res.status(200).json({
      success: true,
      message: "Service deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete service error:", error);
    next(errorHandler(500, "Server error while deleting service"));
  }
};

// Toggle or set service active status
export const toggleServiceStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { isActive } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return next(errorHandler(400, "isActive must be a boolean"));
      }
      service.isActive = isActive;
    } else {
      service.isActive = !service.isActive;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: "Service status updated successfully",
      data: { service }
    });
  } catch (error: any) {
    console.error("Toggle service status error:", error);
    next(errorHandler(500, "Server error while updating service status"));
  }
};

// Assign multiple services to a staff user
export const assignServicesToStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { serviceIds } = req.body;

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return next(errorHandler(400, "serviceIds must be a non-empty array"));
    }

    const normalizedIds = serviceIds.map((id: string) => String(id));
    const invalidIds = normalizedIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return next(errorHandler(400, "One or more serviceIds are invalid"));
    }

    const uniqueServiceIds = Array.from(new Set(normalizedIds));

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const staffRole = await Role.findOne({ name: "staff" }).select("_id");
    if (!staffRole) {
      return next(errorHandler(404, "Staff role not found. Please run seed script first."));
    }

    const roleIds = (user.roles || []).map((role: any) =>
      role?._id ? role._id.toString() : role.toString()
    );

    if (!roleIds.includes(staffRole._id.toString())) {
      return next(errorHandler(400, "User is not a staff member"));
    }

    const services = await Service.find({ _id: { $in: uniqueServiceIds } }).select("_id");
    if (services.length !== uniqueServiceIds.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    user.services = uniqueServiceIds as any;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Services assigned to staff successfully",
      data: {
        user: {
          id: user._id,
          services: user.services
        }
      }
    });
  } catch (error: any) {
    console.error("Assign services to staff error:", error);
    next(errorHandler(500, "Server error while assigning services to staff"));
  }
};
