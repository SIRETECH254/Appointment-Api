
/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Analytics and statistical dashboards
 */

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
/**
 * @swagger
 * /api/dashboard/admin:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Comprehensive admin dashboard data.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get('/admin', authenticateToken, authorizeRoles(['admin']), getAdminDashboard);

/**
 * @route   GET /api/dashboard/client
 * @desc    Get client dashboard statistics
 * @access  Private (Customer)
 */
/**
 * @swagger
 * /api/dashboard/client:
 *   get:
 *     summary: Get client dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Personalized client dashboard data.
 *       "401":
 *         description: Unauthorized, customer authentication required.
 *       "500":
 *         description: Server error.
 */
router.get('/client', authenticateToken, getClientDashboard);

/**
 * @route   GET /api/dashboard/revenue
 * @desc    Get revenue analytics
 * @access  Private (Admin only)
 */
/**
 * @swagger
 * /api/dashboard/revenue:
 *   get:
 *     summary: Get revenue analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *           default: monthly
 *         description: The period for which to retrieve revenue data.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the revenue period (ISO format).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the revenue period (ISO format).
 *     responses:
 *       "200":
 *         description: Revenue analytics data.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get('/revenue', authenticateToken, authorizeRoles(['admin']), getRevenueStats);

/**
 * @route   GET /api/dashboard/appointments
 * @desc    Get appointment statistics
 * @access  Private (Admin only)
 */
/**
 * @swagger
 * /api/dashboard/appointments:
 *   get:
 *     summary: Get appointment statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Appointment statistics data, including completion and no-show rates.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get('/appointments', authenticateToken, authorizeRoles(['admin']), getAppointmentStats);

/**
 * @route   GET /api/dashboard/service-demand
 * @desc    Get service demand analytics
 * @access  Private (Admin only)
 */
/**
 * @swagger
 * /api/dashboard/service-demand:
 *   get:
 *     summary: Get service demand analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Service demand statistics, including most requested and revenue.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get('/service-demand', authenticateToken, authorizeRoles(['admin']), getServiceDemandStats);

/**
 * @route   GET /api/dashboard/staff-activity
 * @desc    Get staff activity statistics
 * @access  Private (Admin only)
 */
/**
 * @swagger
 * /api/dashboard/staff-activity:
 *   get:
 *     summary: Get staff activity statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *           default: monthly
 *         description: The period for which to retrieve staff activity data.
 *     responses:
 *       "200":
 *         description: Staff activity statistics, including appointment counts and top staff.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get('/staff-activity', authenticateToken, authorizeRoles(['admin']), getStaffActivityStats);

export default router;
