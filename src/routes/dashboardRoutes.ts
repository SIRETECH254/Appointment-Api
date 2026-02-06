import express from 'express';
import {
    getAdminDashboard,
    getClientDashboard,
    getRevenueStats,
    getAppointmentStats,
    getServiceDemandStats,
    getStaffActivityStats
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/dashboard/admin
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/admin', authenticateToken, authorizeRoles(['admin']), getAdminDashboard);

/**
 * @route   GET /api/dashboard/client
 * @desc    Get client dashboard statistics
 * @access  Private (Customer)
 */
router.get('/client', authenticateToken, getClientDashboard);

/**
 * @route   GET /api/dashboard/revenue
 * @desc    Get revenue analytics
 * @access  Private (Admin only)
 */
router.get('/revenue', authenticateToken, authorizeRoles(['admin']), getRevenueStats);

/**
 * @route   GET /api/dashboard/appointments
 * @desc    Get appointment statistics
 * @access  Private (Admin only)
 */
router.get('/appointments', authenticateToken, authorizeRoles(['admin']), getAppointmentStats);

/**
 * @route   GET /api/dashboard/service-demand
 * @desc    Get service demand analytics
 * @access  Private (Admin only)
 */
router.get('/service-demand', authenticateToken, authorizeRoles(['admin']), getServiceDemandStats);

/**
 * @route   GET /api/dashboard/staff-activity
 * @desc    Get staff activity statistics
 * @access  Private (Admin only)
 */
router.get('/staff-activity', authenticateToken, authorizeRoles(['admin']), getStaffActivityStats);

export default router;
