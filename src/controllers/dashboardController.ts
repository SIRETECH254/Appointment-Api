import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Appointment from "../models/Appointment";
import Payment from "../models/Payment";
import User from "../models/User";
import Service from "../models/Service";
import Role from "../models/Role";

/**
 * Interface for period date ranges
 */
interface PeriodRange {
  start: Date;
  end: Date;
}

/**
 * Calculate current and previous period date ranges based on period type
 * @param period - Period type: 'today', 'week', 'month', or 'year'
 * @returns Object containing current and previous period date ranges
 */
const calculatePeriodRanges = (period: string): { current: PeriodRange; previous: PeriodRange } => {
  // Get current date and time
  const now = new Date();
  
  // Set end of current period to end of today
  let currentEnd: Date = new Date(now);
  currentEnd.setHours(23, 59, 59, 999);
  
  let currentStart: Date;

  // Calculate start of current period based on period type
  switch (period) {
    case "today":
      // Today: start of today to end of today
      currentStart = new Date(now);
      currentStart.setHours(0, 0, 0, 0);
      break;
    
    case "week":
      // Week: Monday of current week to Sunday
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      // Calculate days to subtract to get to Monday (or previous Monday if today is Sunday)
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      currentStart = new Date(now);
      currentStart.setDate(diff);
      currentStart.setHours(0, 0, 0, 0);
      break;
    
    case "month":
      // Month: first day of current month
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart.setHours(0, 0, 0, 0);
      break;
    
    case "year":
      // Year: January 1st of current year
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentStart.setHours(0, 0, 0, 0);
      break;
    
    default:
      // Default to month if invalid period
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart.setHours(0, 0, 0, 0);
  }

  // Calculate duration of current period
  const currentDuration = currentEnd.getTime() - currentStart.getTime();
  
  // Previous period ends just before current period starts
  const previousEnd = new Date(currentStart.getTime() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  
  // Previous period starts duration milliseconds before its end
  const previousStart = new Date(previousEnd.getTime() - currentDuration);
  previousStart.setHours(0, 0, 0, 0);

  return {
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: previousEnd }
  };
};

/**
 * Get appointment statistics for current and previous periods
 * @param current - Current period date range
 * @param previous - Previous period date range
 * @returns Appointment statistics with current, previous, and change percentages
 */
const getAppointmentStatistics = async (
  current: PeriodRange,
  previous: PeriodRange
): Promise<any> => {
  // Fetch appointments for current period
  const currentAppointments = await Appointment.find({
    createdAt: { $gte: current.start, $lte: current.end }
  });

  // Initialize counters for current period
  const currentTotal = currentAppointments.length;
  const currentByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0
  };

  // Calculate revenue from completed appointments
  let currentRevenue = 0;
  currentAppointments.forEach((apt) => {
    // Count appointments by status
    currentByStatus[apt.status as keyof typeof currentByStatus]++;
    
    // Only count revenue from completed appointments
    if (apt.status === "COMPLETED") {
      currentRevenue += apt.bookingFeeAmount + apt.remainingAmount;
    }
  });

  // Calculate average appointment value
  const currentAvgValue = currentTotal > 0 ? currentRevenue / currentTotal : 0;

  // Fetch appointments for previous period
  const previousAppointments = await Appointment.find({
    createdAt: { $gte: previous.start, $lte: previous.end }
  });

  // Initialize counters for previous period
  const previousTotal = previousAppointments.length;
  const previousByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0
  };

  // Calculate revenue from completed appointments
  let previousRevenue = 0;
  previousAppointments.forEach((apt) => {
    // Count appointments by status
    previousByStatus[apt.status as keyof typeof previousByStatus]++;
    
    // Only count revenue from completed appointments
    if (apt.status === "COMPLETED") {
      previousRevenue += apt.bookingFeeAmount + apt.remainingAmount;
    }
  });

  // Calculate average appointment value for previous period
  const previousAvgValue = previousTotal > 0 ? previousRevenue / previousTotal : 0;

  // Calculate percentage changes
  const totalChange = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : currentTotal > 0 ? 100 : 0;
  
  const revenueChange = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : currentRevenue > 0 ? 100 : 0;

  return {
    current: {
      total: currentTotal,
      byStatus: currentByStatus,
      revenue: currentRevenue,
      avgValue: Math.round(currentAvgValue * 100) / 100
    },
    previous: {
      total: previousTotal,
      byStatus: previousByStatus,
      revenue: previousRevenue,
      avgValue: Math.round(previousAvgValue * 100) / 100
    },
    change: {
      total: Math.round(totalChange * 100) / 100,
      revenue: Math.round(revenueChange * 100) / 100
    }
  };
};

/**
 * Get payment statistics for current and previous periods
 * @param current - Current period date range
 * @param previous - Previous period date range
 * @returns Payment statistics with current, previous, and change percentages
 */
const getPaymentStatistics = async (
  current: PeriodRange,
  previous: PeriodRange
): Promise<any> => {
  // Fetch successful payments for current period
  const currentPayments = await Payment.find({
    createdAt: { $gte: current.start, $lte: current.end },
    status: "SUCCESS"
  });

  // Initialize revenue counters
  let currentTotal = 0;
  const currentByMethod = { MPESA: 0, CARD: 0, CASH: 0 };
  const currentByType = { BOOKING_FEE: 0, FULL_PAYMENT: 0 };
  let currentSuccessCount = 0;

  // Aggregate payment data
  currentPayments.forEach((payment) => {
    currentTotal += payment.amount;
    currentByMethod[payment.method as keyof typeof currentByMethod] += payment.amount;
    currentByType[payment.type as keyof typeof currentByType] += payment.amount;
    currentSuccessCount++;
  });

  // Get all payments (including failed) for success rate calculation
  const currentAllPayments = await Payment.find({
    createdAt: { $gte: current.start, $lte: current.end }
  });
  
  // Calculate success rate as percentage
  const currentSuccessRate = currentAllPayments.length > 0 
    ? (currentSuccessCount / currentAllPayments.length) * 100 
    : 0;

  // Fetch successful payments for previous period
  const previousPayments = await Payment.find({
    createdAt: { $gte: previous.start, $lte: previous.end },
    status: "SUCCESS"
  });

  // Initialize revenue counters for previous period
  let previousTotal = 0;
  const previousByMethod = { MPESA: 0, CARD: 0, CASH: 0 };
  const previousByType = { BOOKING_FEE: 0, FULL_PAYMENT: 0 };
  let previousSuccessCount = 0;

  // Aggregate payment data for previous period
  previousPayments.forEach((payment) => {
    previousTotal += payment.amount;
    previousByMethod[payment.method as keyof typeof previousByMethod] += payment.amount;
    previousByType[payment.type as keyof typeof previousByType] += payment.amount;
    previousSuccessCount++;
  });

  // Get all payments for previous period
  const previousAllPayments = await Payment.find({
    createdAt: { $gte: previous.start, $lte: previous.end }
  });
  
  // Calculate success rate for previous period
  const previousSuccessRate = previousAllPayments.length > 0 
    ? (previousSuccessCount / previousAllPayments.length) * 100 
    : 0;

  // Calculate percentage change in total revenue
  const totalChange = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : currentTotal > 0 ? 100 : 0;

  return {
    current: {
      total: currentTotal,
      byMethod: currentByMethod,
      byType: currentByType,
      successRate: Math.round(currentSuccessRate * 100) / 100,
      successCount: currentSuccessCount
    },
    previous: {
      total: previousTotal,
      byMethod: previousByMethod,
      byType: previousByType,
      successRate: Math.round(previousSuccessRate * 100) / 100,
      successCount: previousSuccessCount
    },
    change: {
      total: Math.round(totalChange * 100) / 100
    }
  };
};

/**
 * Get user statistics for current and previous periods
 * @param current - Current period date range
 * @param previous - Previous period date range
 * @returns User statistics with current, previous, and change percentages
 */
const getUserStatistics = async (
  current: PeriodRange,
  previous: PeriodRange
): Promise<any> => {
  // Fetch users created in current period
  const currentUsers = await User.find({
    createdAt: { $gte: current.start, $lte: current.end }
  }).populate("roles", "name");

  // Initialize counters
  const currentTotal = currentUsers.length;
  const currentByRole = { customer: 0, admin: 0, staff: 0 };
  let currentActive = 0;

  // Count users by role and active status
  currentUsers.forEach((user) => {
    // Count active users
    if (user.isActive) currentActive++;
    
    // Count by role
    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach((role: any) => {
        // Handle both populated and non-populated role references
        const roleName = role?.name || (typeof role === "string" ? role : "");
        if (roleName === "customer") currentByRole.customer++;
        if (roleName === "admin") currentByRole.admin++;
        if (roleName === "staff") currentByRole.staff++;
      });
    }
  });

  // Fetch users created in previous period
  const previousUsers = await User.find({
    createdAt: { $gte: previous.start, $lte: previous.end }
  }).populate("roles", "name");

  // Initialize counters for previous period
  const previousTotal = previousUsers.length;
  const previousByRole = { customer: 0, admin: 0, staff: 0 };
  let previousActive = 0;

  // Count users by role and active status for previous period
  previousUsers.forEach((user) => {
    // Count active users
    if (user.isActive) previousActive++;
    
    // Count by role
    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach((role: any) => {
        // Handle both populated and non-populated role references
        const roleName = role?.name || (typeof role === "string" ? role : "");
        if (roleName === "customer") previousByRole.customer++;
        if (roleName === "admin") previousByRole.admin++;
        if (roleName === "staff") previousByRole.staff++;
      });
    }
  });

  // Calculate percentage change in total users
  const totalChange = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : currentTotal > 0 ? 100 : 0;

  return {
    current: {
      total: currentTotal,
      byRole: currentByRole,
      active: currentActive
    },
    previous: {
      total: previousTotal,
      byRole: previousByRole,
      active: previousActive
    },
    change: {
      total: Math.round(totalChange * 100) / 100
    }
  };
};

/**
 * Get service statistics (not period-based, shows current state)
 * @returns Service statistics including total, active, and popular services
 */
const getServiceStatistics = async (): Promise<any> => {
  // Count total services
  const totalServices = await Service.countDocuments();
  
  // Count active services
  const activeServices = await Service.countDocuments({ isActive: true });

  // Get most popular services by appointment count using aggregation
  const popularServices = await Appointment.aggregate([
    // Unwind services array to get individual service IDs
    { $unwind: "$services" },
    // Group by service ID and count occurrences
    {
      $group: {
        _id: "$services",
        count: { $sum: 1 }
      }
    },
    // Sort by count descending
    { $sort: { count: -1 } },
    // Limit to top 5
    { $limit: 5 }
  ]);

  // Populate service names for popular services
  const popularServicesWithNames = await Promise.all(
    popularServices.map(async (item) => {
      const service = await Service.findById(item._id).select("name");
      return {
        serviceId: item._id.toString(),
        name: service?.name || "Unknown",
        count: item.count
      };
    })
  );

  return {
    total: totalServices,
    active: activeServices,
    popular: popularServicesWithNames
  };
};

/**
 * Get revenue trends with daily breakdown for current period
 * @param current - Current period date range
 * @returns Revenue trends with current, previous, change, and daily breakdown
 */
const getRevenueTrends = async (current: PeriodRange): Promise<any> => {
  // Fetch all successful payments in current period
  const payments = await Payment.find({
    createdAt: { $gte: current.start, $lte: current.end },
    status: "SUCCESS"
  });

  // Calculate total revenue for current period
  const currentRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

  // Calculate previous period date range for comparison
  const previousDuration = current.end.getTime() - current.start.getTime();
  const previousEnd = new Date(current.start.getTime() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - previousDuration);
  previousStart.setHours(0, 0, 0, 0);

  // Fetch successful payments for previous period
  const previousPayments = await Payment.find({
    createdAt: { $gte: previousStart, $lte: previousEnd },
    status: "SUCCESS"
  });

  // Calculate total revenue for previous period
  const previousRevenue = previousPayments.reduce((sum, payment) => sum + payment.amount, 0);

  // Calculate percentage change in revenue
  const revenueChange = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : currentRevenue > 0 ? 100 : 0;

  // Group payments by day for daily breakdown
  const dailyRevenue: { [key: string]: number } = {};
  payments.forEach((payment) => {
    // Extract date part (YYYY-MM-DD) from ISO string
    const dateParts = payment.createdAt.toISOString().split("T");
    const dateKey = dateParts[0] || "";
    if (dateKey) {
      if (!dailyRevenue[dateKey]) {
        dailyRevenue[dateKey] = 0;
      }
      dailyRevenue[dateKey] += payment.amount;
    }
  });

  // Convert daily revenue object to array and sort by date
  const daily = Object.entries(dailyRevenue)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    current: currentRevenue,
    previous: previousRevenue,
    change: Math.round(revenueChange * 100) / 100,
    daily
  };
};

/**
 * Main controller function to get comprehensive dashboard statistics
 * Aggregates data from appointments, payments, users, and services
 * Compares current period against previous period
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get period from query parameter, default to 'month'
    const { period = "month" } = req.query;
    
    // Validate period parameter
    const validPeriods = ["today", "week", "month", "year"];
    if (typeof period !== "string" || !validPeriods.includes(period)) {
      return next(errorHandler(400, "Invalid period. Must be one of: today, week, month, year"));
    }

    // Calculate current and previous period date ranges
    const { current, previous } = calculatePeriodRanges(period);

    // Fetch all statistics in parallel for better performance
    const [
      appointmentStats,
      paymentStats,
      userStats,
      serviceStats,
      revenueTrends
    ] = await Promise.all([
      getAppointmentStatistics(current, previous),
      getPaymentStatistics(current, previous),
      getUserStatistics(current, previous),
      getServiceStatistics(),
      getRevenueTrends(current)
    ]);

    // Return comprehensive dashboard statistics
    res.status(200).json({
      success: true,
      data: {
        period: {
          current: { start: current.start, end: current.end },
          previous: { start: previous.start, end: previous.end }
        },
        appointments: appointmentStats,
        payments: paymentStats,
        users: userStats,
        services: serviceStats,
        revenue: revenueTrends
      }
    });
  } catch (error: any) {
    console.error("Get dashboard stats error:", error);
    next(errorHandler(500, "Server error while fetching dashboard statistics"));
  }
};
