import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Appointment from '../models/Appointment';
import Payment from '../models/Payment';
import User from '../models/User';
import Service from '../models/Service';
import Role from '../models/Role';

export const getAdminDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Appointments statistics
        const totalAppointments = await Appointment.countDocuments();
        const appointmentsByStatus = {
            pending: await Appointment.countDocuments({ status: 'PENDING' }),
            confirmed: await Appointment.countDocuments({ status: 'CONFIRMED' }),
            completed: await Appointment.countDocuments({ status: 'COMPLETED' }),
            cancelled: await Appointment.countDocuments({ status: 'CANCELLED' }),
            no_show: await Appointment.countDocuments({ status: 'NO_SHOW' })
        };

        // Payments statistics
        const totalPayments = await Payment.countDocuments();
        const paymentsByStatus = {
            pending: await Payment.countDocuments({ status: 'PENDING' }),
            success: await Payment.countDocuments({ status: 'SUCCESS' }),
            failed: await Payment.countDocuments({ status: 'FAILED' })
        };
        const paymentsByMethod = {
            mpesa: await Payment.countDocuments({ method: 'MPESA' }),
            card: await Payment.countDocuments({ method: 'CARD' }),
            cash: await Payment.countDocuments({ method: 'CASH' })
        };

        // Calculate total revenue from successful payments
        const successfulPayments = await Payment.find({ status: 'SUCCESS' });
        const totalRevenue = successfulPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // Users statistics
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const verifiedUsers = await User.countDocuments({ emailVerified: true });

        // Users by role
        const customerRole = await Role.findOne({ name: 'customer' });
        const staffRole = await Role.findOne({ name: 'staff' });
        const adminRole = await Role.findOne({ name: 'admin' });

        const totalCustomers = customerRole ? await User.countDocuments({ roles: customerRole._id }) : 0;
        const totalStaff = staffRole ? await User.countDocuments({ roles: staffRole._id }) : 0;
        const totalAdmins = adminRole ? await User.countDocuments({ roles: adminRole._id }) : 0;

        // Services statistics
        const totalServices = await Service.countDocuments();
        const activeServices = await Service.countDocuments({ isActive: true });

        // Outstanding revenue (from appointments with remainingAmount > 0)
        const appointmentsWithRemaining = await Appointment.find({
            remainingAmount: { $gt: 0 },
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });
        const outstandingRevenue = appointmentsWithRemaining.reduce(
            (sum, apt) => sum + apt.remainingAmount,
            0
        );

        // Recent activity (last 10 items)
        const recentAppointments = await Appointment.find()
            .populate('customerId', 'firstName lastName email')
            .populate('staffId', 'firstName lastName email')
            .populate('services', 'name duration fullPrice')
            .sort({ createdAt: 'desc' })
            .limit(10);

        const recentPayments = await Payment.find()
            .populate('appointmentId')
            .sort({ createdAt: 'desc' })
            .limit(10);

        const recentUsers = await User.find()
            .select('firstName lastName email phone isActive emailVerified createdAt')
            .sort({ createdAt: 'desc' })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    appointments: {
                        total: totalAppointments,
                        byStatus: appointmentsByStatus
                    },
                    payments: {
                        total: totalPayments,
                        totalAmount: totalRevenue,
                        byStatus: paymentsByStatus,
                        byMethod: paymentsByMethod
                    },
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                        verified: verifiedUsers,
                        byRole: {
                            customers: totalCustomers,
                            staff: totalStaff,
                            admins: totalAdmins
                        }
                    },
                    services: {
                        total: totalServices,
                        active: activeServices
                    },
                    revenue: {
                        total: totalRevenue,
                        outstanding: outstandingRevenue
                    }
                },
                recentActivity: {
                    appointments: recentAppointments,
                    payments: recentPayments,
                    users: recentUsers
                }
            }
        });

    } catch (error: any) {
        console.error('Get admin dashboard error:', error);
        next(errorHandler(500, "Server error while fetching admin dashboard"));
    }
};

export const getClientDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const customerId = req.user?._id;

        if (!customerId) {
            return next(errorHandler(401, "Customer authentication required"));
        }

        // Appointments statistics
        const totalAppointments = await Appointment.countDocuments({ customerId });
        const appointmentsByStatus = {
            pending: await Appointment.countDocuments({ customerId, status: 'PENDING' }),
            confirmed: await Appointment.countDocuments({ customerId, status: 'CONFIRMED' }),
            completed: await Appointment.countDocuments({ customerId, status: 'COMPLETED' }),
            cancelled: await Appointment.countDocuments({ customerId, status: 'CANCELLED' }),
            no_show: await Appointment.countDocuments({ customerId, status: 'NO_SHOW' })
        };

        // Get customer appointments for calculations
        const customerAppointments = await Appointment.find({ customerId });
        const appointmentIds = customerAppointments.map(apt => apt._id);

        // Calculate total spent from completed appointments
        const completedAppointments = customerAppointments.filter(apt => apt.status === 'COMPLETED');
        const totalSpent = completedAppointments.reduce((sum, apt) => {
            // Total spent = bookingFeeAmount + (fullPrice - bookingFeeAmount) for completed appointments
            // Since remainingAmount is 0 for fully paid, we calculate from the original amounts
            const fullAmount = apt.bookingFeeAmount + apt.remainingAmount;
            return sum + fullAmount;
        }, 0);

        // Outstanding balance from appointments with remainingAmount > 0
        const outstandingBalance = customerAppointments
            .filter(apt => apt.remainingAmount > 0 && ['PENDING', 'CONFIRMED'].includes(apt.status))
            .reduce((sum, apt) => sum + apt.remainingAmount, 0);

        // Payments statistics
        const customerPayments = await Payment.find({
            appointmentId: { $in: appointmentIds }
        });
        const totalPayments = customerPayments.length;
        const successfulPayments = customerPayments.filter(pay => pay.status === 'SUCCESS');
        const totalPaymentAmount = successfulPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // Recent activity (last 5 items)
        const recentAppointments = await Appointment.find({ customerId })
            .populate('staffId', 'firstName lastName email')
            .populate('services', 'name duration fullPrice')
            .sort({ createdAt: 'desc' })
            .limit(5);

        const recentPayments = await Payment.find({
            appointmentId: { $in: appointmentIds }
        })
            .populate('appointmentId')
            .sort({ createdAt: 'desc' })
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    appointments: {
                        total: totalAppointments,
                        byStatus: appointmentsByStatus
                    },
                    payments: {
                        total: totalPayments,
                        totalAmount: totalPaymentAmount
                    },
                    financial: {
                        totalSpent: totalSpent,
                        outstandingBalance: outstandingBalance
                    }
                },
                recentActivity: {
                    appointments: recentAppointments,
                    payments: recentPayments
                }
            }
        });

    } catch (error: any) {
        console.error('Get client dashboard error:', error);
        next(errorHandler(500, "Server error while fetching client dashboard"));
    }
};

export const getRevenueStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { period = 'monthly', startDate, endDate } = req.query;

        // Calculate date range
        let start: Date;
        let end: Date = new Date();

        if (startDate && endDate) {
            start = new Date(startDate as string);
            end = new Date(endDate as string);
        } else {
            // Default to last 30 days
            start = new Date();
            start.setDate(start.getDate() - 30);
        }

        // Get successful payments in date range
        const payments = await Payment.find({
            status: 'SUCCESS',
            createdAt: { $gte: start, $lte: end }
        }).populate({
            path: 'appointmentId',
            populate: {
                path: 'customerId',
                select: 'firstName lastName email phone'
            }
        });

        // Calculate total revenue
        const totalRevenue = payments.reduce((sum, pay) => sum + pay.amount, 0);

        // Revenue by payment method
        const revenueByMethod: any = {};
        payments.forEach(payment => {
            const method = payment.method.toLowerCase();
            if (!revenueByMethod[method]) {
                revenueByMethod[method] = 0;
            }
            revenueByMethod[method] += payment.amount;
        });

        // Outstanding revenue
        const outstandingAppointments = await Appointment.find({
            remainingAmount: { $gt: 0 },
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });
        const outstandingRevenue = outstandingAppointments.reduce(
            (sum, apt) => sum + apt.remainingAmount,
            0
        );

        // Top customers by revenue
        const customerRevenue: any = {};
        payments.forEach(pay => {
            if (pay.appointmentId) {
                const appointment = pay.appointmentId as any;
                const customerId = appointment.customerId?._id?.toString() || appointment.customerId?.toString();
                if (customerId) {
                    if (!customerRevenue[customerId]) {
                        customerRevenue[customerId] = {
                            customerId: customerId,
                            customer: appointment.customerId,
                            total: 0
                        };
                    }
                    customerRevenue[customerId].total += pay.amount;
                }
            }
        });

        const topCustomers = Object.values(customerRevenue)
            .sort((a: any, b: any) => b.total - a.total)
            .slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                period: {
                    start: start,
                    end: end,
                    type: period
                },
                revenue: {
                    total: totalRevenue,
                    outstanding: outstandingRevenue,
                    byMethod: revenueByMethod
                },
                topCustomers: topCustomers,
                paymentCount: payments.length
            }
        });

    } catch (error: any) {
        console.error('Get revenue stats error:', error);
        next(errorHandler(500, "Server error while fetching revenue statistics"));
    }
};

export const getAppointmentStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Appointments by status
        const appointmentsByStatus = {
            pending: await Appointment.countDocuments({ status: 'PENDING' }),
            confirmed: await Appointment.countDocuments({ status: 'CONFIRMED' }),
            completed: await Appointment.countDocuments({ status: 'COMPLETED' }),
            cancelled: await Appointment.countDocuments({ status: 'CANCELLED' }),
            no_show: await Appointment.countDocuments({ status: 'NO_SHOW' })
        };

        const totalAppointments = await Appointment.countDocuments();

        // Calculate completion rate
        const completedCount = appointmentsByStatus.completed;
        const completionRate = totalAppointments > 0 
            ? (completedCount / totalAppointments) * 100 
            : 0;

        // Calculate cancellation rate
        const cancelledCount = appointmentsByStatus.cancelled;
        const cancellationRate = totalAppointments > 0 
            ? (cancelledCount / totalAppointments) * 100 
            : 0;

        // Calculate no-show rate
        const noShowCount = appointmentsByStatus.no_show;
        const noShowRate = totalAppointments > 0 
            ? (noShowCount / totalAppointments) * 100 
            : 0;

        // Calculate average appointment duration
        const allAppointments = await Appointment.find();
        let totalDuration = 0;
        let validDurations = 0;

        allAppointments.forEach(apt => {
            if (apt.startTime && apt.endTime) {
                const duration = (apt.endTime.getTime() - apt.startTime.getTime()) / (1000 * 60); // minutes
                if (duration > 0) {
                    totalDuration += duration;
                    validDurations++;
                }
            }
        });

        const averageDuration = validDurations > 0 ? totalDuration / validDurations : 0;

        // Completed appointments with actual end time
        const completedAppointments = await Appointment.find({
            status: 'COMPLETED',
            actualEndTime: { $exists: true }
        });

        // Calculate average actual duration for completed appointments
        let totalActualDuration = 0;
        let validActualDurations = 0;

        completedAppointments.forEach(apt => {
            if (apt.startTime && apt.actualEndTime) {
                const duration = (apt.actualEndTime.getTime() - apt.startTime.getTime()) / (1000 * 60); // minutes
                if (duration > 0) {
                    totalActualDuration += duration;
                    validActualDurations++;
                }
            }
        });

        const averageActualDuration = validActualDurations > 0 ? totalActualDuration / validActualDurations : 0;

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total: totalAppointments,
                    byStatus: appointmentsByStatus
                },
                performance: {
                    completionRate: Math.round(completionRate * 100) / 100,
                    cancellationRate: Math.round(cancellationRate * 100) / 100,
                    noShowRate: Math.round(noShowRate * 100) / 100,
                    averageDuration: Math.round(averageDuration),
                    averageActualDuration: Math.round(averageActualDuration),
                    completed: completedCount
                }
            }
        });

    } catch (error: any) {
        console.error('Get appointment stats error:', error);
        next(errorHandler(500, "Server error while fetching appointment statistics"));
    }
};

export const getServiceDemandStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // All services
        const allServices = await Service.find({ isActive: true });

        // Get all appointments with services populated
        const appointments = await Appointment.find()
            .populate('services', 'name fullPrice duration');

        // Count service usage in appointments
        const serviceUsage: any = {};
        appointments.forEach(appointment => {
            if (appointment.services && Array.isArray(appointment.services)) {
                appointment.services.forEach((service: any) => {
                    const serviceId = service._id ? service._id.toString() : service.toString();
                    if (!serviceUsage[serviceId]) {
                        serviceUsage[serviceId] = {
                            service: service,
                            count: 0,
                            totalRevenue: 0
                        };
                    }
                    serviceUsage[serviceId].count += 1;
                    
                    // Calculate revenue from completed appointments
                    if (appointment.status === 'COMPLETED') {
                        const servicePrice = service.fullPrice || 0;
                        serviceUsage[serviceId].totalRevenue += servicePrice;
                    }
                });
            }
        });

        // Convert to array and sort by count
        const serviceDemand = Object.values(serviceUsage)
            .sort((a: any, b: any) => b.count - a.count);

        // Get service revenue from payments
        const successfulPayments = await Payment.find({ status: 'SUCCESS' })
            .populate({
                path: 'appointmentId',
                populate: {
                    path: 'services',
                    select: 'name fullPrice'
                }
            });

        const serviceRevenue: any = {};
        successfulPayments.forEach(payment => {
            if (payment.appointmentId) {
                const appointment = payment.appointmentId as any;
                if (appointment.services && Array.isArray(appointment.services)) {
                    const totalServicePrice = appointment.services.reduce((sum: number, s: any) => 
                        sum + (s.fullPrice || 0), 0);
                    
                    appointment.services.forEach((service: any) => {
                        const serviceId = service._id ? service._id.toString() : service.toString();
                        if (!serviceRevenue[serviceId]) {
                            serviceRevenue[serviceId] = 0;
                        }
                        // Distribute payment amount proportionally
                        const servicePrice = service.fullPrice || 0;
                        if (totalServicePrice > 0) {
                            serviceRevenue[serviceId] += (payment.amount * servicePrice) / totalServicePrice;
                        }
                    });
                }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                totalServices: allServices.length,
                serviceDemand: serviceDemand.slice(0, 10),
                serviceRevenue: serviceRevenue
            }
        });

    } catch (error: any) {
        console.error('Get service demand stats error:', error);
        next(errorHandler(500, "Server error while fetching service demand statistics"));
    }
};

export const getStaffActivityStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { period = 'monthly' } = req.query;

        // Calculate date range
        const end = new Date();
        const start = new Date();
        
        if (period === 'daily') {
            start.setDate(start.getDate() - 1);
        } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
        } else if (period === 'monthly') {
            start.setMonth(start.getMonth() - 1);
        } else if (period === 'yearly') {
            start.setFullYear(start.getFullYear() - 1);
        }

        // Get staff role
        const staffRole = await Role.findOne({ name: 'staff' });
        if (!staffRole) {
            res.status(200).json({
                success: true,
                data: {
                    overview: {
                        total: 0,
                        active: 0
                    },
                    period: {
                        start: start,
                        end: end,
                        type: period
                    },
                    topStaff: []
                }
            });
            return;
        }

        // Total staff
        const totalStaff = await User.countDocuments({ roles: staffRole._id });
        const activeStaff = await User.countDocuments({ 
            roles: staffRole._id, 
            isActive: true 
        });

        // Staff with appointments in period
        const staffAppointments = await Appointment.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$staffId',
                    appointmentCount: { $sum: 1 },
                    completedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { appointmentCount: -1 }
            },
            {
                $limit: 10
            }
        ]);

        const topStaff = await Promise.all(
            staffAppointments.map(async (item) => {
                const staff = await User.findById(item._id)
                    .select('firstName lastName email phone isActive');
                return {
                    staff: staff,
                    appointmentCount: item.appointmentCount,
                    completedCount: item.completedCount
                };
            })
        );

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total: totalStaff,
                    active: activeStaff,
                    activeInPeriod: staffAppointments.length
                },
                period: {
                    start: start,
                    end: end,
                    type: period
                },
                topStaff: topStaff
            }
        });

    } catch (error: any) {
        console.error('Get staff activity stats error:', error);
        next(errorHandler(500, "Server error while fetching staff activity statistics"));
    }
};
