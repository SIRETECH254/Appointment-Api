
/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user session management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The unique identifier for the user.
 *         firstName:
 *           type: string
 *           description: The user's first name.
 *         lastName:
 *           type: string
 *           description: The user's last name.
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address.
 *         phone:
 *           type: string
 *           description: The user's phone number.
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *           description: An array of role IDs assigned to the user.
 *         emailVerified:
 *           type: boolean
 *           description: Indicates if the user's email has been verified.
 *         isActive:
 *           type: boolean
 *           description: Indicates if the user's account is active.
 */
import express from "express";
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  logout,
  forgotPassword,
  resetPassword,
  refreshToken,
  getMe
} from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Register new user with OTP verification
router.post("/register", register);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with OTP verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *               role:
 *                 type: string
 *                 enum: [customer, admin, staff]
 *                 default: customer
 *     responses:
 *       "201":
 *         description: User registered successfully, awaiting OTP verification.
 *       "400":
 *         description: Invalid input or user already exists.
 *       "500":
 *         description: Server error.
 */

// Verify OTP and activate account
/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and activate account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Email verified successfully, and tokens issued.
 *       "400":
 *         description: Invalid OTP or OTP expired.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.post("/verify-otp", verifyOTP);
// Resend OTP to email/phone
/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP for verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *     responses:
 *       "200":
 *         description: OTP has been resent successfully.
 *       "400":
 *         description: Account already verified or missing identifier.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.post("/resend-otp", resendOTP);
// Login with email/phone and password
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and issue tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       "200":
 *         description: Login successful, returns user data and tokens.
 *       "400":
 *         description: Missing credentials.
 *       "401":
 *         description: Incorrect email/phone or password.
 *       "403":
 *         description: Account not verified or inactive.
 *       "500":
 *         description: Server error.
 */
router.post("/login", login);
// Logout authenticated user
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Logged out successfully.
 *       "500":
 *         description: Server error.
 */
router.post("/logout", authenticateToken, logout);
// Request password reset token
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       "200":
 *         description: Password reset instructions sent successfully.
 *       "400":
 *         description: Email is required.
 *       "404":
 *         description: No user found with this email.
 *       "500":
 *         description: Server error.
 */
router.post("/forgot-password", forgotPassword);
// Reset password using token
/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The password reset token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       "200":
 *         description: Password reset successfully.
 *       "400":
 *         description: Invalid or expired reset token, or missing new password.
 *       "500":
 *         description: Server error.
 */
router.post("/reset-password/:token", resetPassword);
// Refresh access token
/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Generate a new access token using a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Token refreshed successfully, returns new access and refresh tokens.
 *       "400":
 *         description: Refresh token is required.
 *       "403":
 *         description: Invalid refresh token, user not found, or inactive.
 *       "500":
 *         description: Server error.
 */
router.post("/refresh-token", refreshToken);
// Get authenticated user profile
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Current user profile data.
 *       "401":
 *         description: Unauthorized, no token or invalid token.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.get("/me", authenticateToken, getMe);

export default router;
