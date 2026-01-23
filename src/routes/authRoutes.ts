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
// Verify OTP and activate account
router.post("/verify-otp", verifyOTP);
// Resend OTP to email/phone
router.post("/resend-otp", resendOTP);
// Login with email/phone and password
router.post("/login", login);
// Logout authenticated user
router.post("/logout", authenticateToken, logout);
// Request password reset token
router.post("/forgot-password", forgotPassword);
// Reset password using token
router.post("/reset-password/:token", resetPassword);
// Refresh access token
router.post("/refresh-token", refreshToken);
// Get authenticated user profile
router.get("/me", authenticateToken, getMe);

export default router;
