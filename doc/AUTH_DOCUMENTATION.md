# 🔐 Appointment API - Authentication System Documentation

## 📋 Table of Contents
- [Authentication Overview](#authentication-overview)
- [Authentication Controller](#authentication-controller)
- [Authentication Routes](#authentication-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)

---

## 🔑 Authentication Overview

The Appointment API uses JWT (JSON Web Tokens) for authentication with a unified role-based access control (RBAC) system. All users are managed through a single User model with role assignments. The system incorporates OTP verification and comprehensive security features.

### Authentication Flow
1. **Registration/Login** → Generate JWT tokens with role-based payload (roleIds array)
2. **OTP Verification** → Email/SMS verification for new accounts
3. **Token Validation** → Middleware verifies tokens and user status
4. **Role Authorization** → Check user roles and permissions
5. **Protected Routes** → Access granted based on roles and verification status

### Unified User System
- **Single User Model** - All users use the same User model
- **Role-Based Access** - Users have roles array referencing Role documents
- **Default Role** - New users automatically receive "customer" role on registration
- **Multiple Roles** - Users can have multiple roles assigned
- **Presaved Roles** - Roles are stored in database and fetched dynamically

### User Roles
- `customer` - Default role for customers (assigned automatically on registration)
- `admin` - Full system access, can manage all users and system settings
- `staff` - Basic admin access, customer and appointment operations

### Security Features
- **OTP Verification** - Email and SMS verification for new accounts
- **Password Reset** - Secure token-based password reset flow
- **Refresh Tokens** - Separate refresh token mechanism for security
- **Account Status** - Active/inactive user management
- **Email Verification** - Required for sensitive operations

---

## 🎮 Authentication Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import { errorHandler } from '../middleware/errorHandler';
import { sendOTPNotification, sendPasswordResetNotification, sendWelcomeNotification } from '../services/notificationService';
import User from '../models/User';
import Role from '../models/Role';
import { generateTokens, generateOTP } from '../utils/authHelpers';
```

### Controller Implementations

#### `register(userData)` — Register new user with OTP verification  
**Access:** Public (customer registration) or Admin (admin/staff creation)  
**Validation:** Email/phone format, uniqueness, role assignment (defaults to `customer`)  
**Response:** User data without password, verification status, roles array
```typescript
export const register = async (req, res, next) => {
  const { firstName, lastName, email, phone, password, role } = req.body;

  if (!firstName || !lastName || !email || !phone || !password) {
    return next(errorHandler(400, 'All fields are required'));
  }

  if (!validator.isEmail(email)) return next(errorHandler(400, 'Please provide a valid email'));
  if (!validator.isMobilePhone(phone)) return next(errorHandler(400, 'Please provide a valid phone number'));

  const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
  if (existingUser) return next(errorHandler(400, 'User already exists with this email or phone'));

  const hashedPassword = bcrypt.hashSync(password, 12);
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXP_MINUTES || '10', 10) * 60 * 1000);

  let assignedRoles = [];
  if (role) {
    const specifiedRole = await Role.findOne({ name: role.toLowerCase() });
    if (!specifiedRole) return next(errorHandler(400, `Role "${role}" not found`));
    assignedRoles = [specifiedRole._id];
  } else {
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) return next(errorHandler(500, 'Default customer role not found. Please run seed script first.'));
    assignedRoles = [customerRole._id];
  }

  const user = new User({ firstName, lastName, email: email.toLowerCase(), phone, password: hashedPassword, roles: assignedRoles, otpCode: otp, otpExpiry, emailVerified: false });
  await user.save();

  await sendOTPNotification(email, phone, otp, `${firstName} ${lastName}`);
  await user.populate('roles', 'name displayName');

  res.status(201).json({ success: true, message: 'User registered successfully. Please verify your email with the OTP sent.', data: { userId: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, roles: user.roles, emailVerified: user.emailVerified } });
};
```

#### `verifyOTP(email/phone, otp)` — Verify OTP and activate account  
**Access:** Public  
**Response:** User data + access/refresh tokens
```typescript
export const verifyOTP = async (req, res, next) => {
  const { email, phone, otp } = req.body;

  if (!otp) return next(errorHandler(400, 'OTP is required'));
  if (!email && !phone) return next(errorHandler(400, 'Email or phone is required'));

  const query = email ? { email: email.toLowerCase() } : { phone };
  const user = await User.findOne(query).select('+otpCode +otpExpiry');

  if (!user) return next(errorHandler(404, 'User not found'));
  if (user.otpExpiry && user.otpExpiry < new Date()) return next(errorHandler(400, 'OTP has expired. Please request a new one'));
  if (user.otpCode !== otp.trim()) return next(errorHandler(400, 'Incorrect OTP code'));

  user.emailVerified = true;
  user.otpCode = undefined;
  user.otpExpiry = undefined;
  await user.save();

  await sendWelcomeNotification(user.email, user.phone, `${user.firstName} ${user.lastName}`);
  const { accessToken, refreshToken } = generateTokens(user);

  res.status(200).json({ success: true, message: 'Email verified successfully', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, roles: user.roles, emailVerified: user.emailVerified }, accessToken, refreshToken } });
};
```

#### `resendOTP(email/phone)` — Resend OTP for verification  
**Access:** Public  
**Response:** Confirmation + OTP expiry
```typescript
export const resendOTP = async (req, res, next) => {
  const { email, phone } = req.body;

  if (!email && !phone) return next(errorHandler(400, 'Email or phone is required'));

  const query = email ? { email: email.toLowerCase() } : { phone };
  const user = await User.findOne(query);

  if (!user) return next(errorHandler(404, 'User not found'));
  if (user.emailVerified) return next(errorHandler(400, 'Account is already verified'));

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXP_MINUTES || '10', 10) * 60 * 1000);
  user.otpCode = otp;
  user.otpExpiry = otpExpiry;
  await user.save();

  await sendOTPNotification(user.email, user.phone, otp, `${user.firstName} ${user.lastName}`);

  res.status(200).json({ success: true, message: 'OTP has been resent to your email and phone', data: { userId: user._id, email: user.email, phone: user.phone, otpExpiry } });
};
```

#### `login(credentials)` — Authenticate users  
**Response:** User data + access/refresh tokens
```typescript
export const login = async (req, res, next) => {
  const { email, phone, password } = req.body;

  if (!password) return next(errorHandler(400, 'Password is required'));
  if (!email && !phone) return next(errorHandler(400, 'Email or phone is required'));

  const query = email ? { email: email.toLowerCase() } : { phone };
  const user = await User.findOne(query).select('+password');

  if (!user) return next(errorHandler(401, email ? 'Email does not exist' : 'Phone number does not exist'));

  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) return next(errorHandler(401, 'Password is incorrect'));

  if (!user.emailVerified) return next(errorHandler(403, 'Please verify your email before logging in'));
  if (!user.isActive) return next(errorHandler(403, 'Account is deactivated. Please contact support.'));

  user.lastLoginAt = new Date();
  await user.save();
  await user.populate('roles', 'name displayName');
  const { accessToken, refreshToken } = generateTokens(user);

  res.status(200).json({ success: true, message: 'Login successful', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, avatar: user.avatar, roles: user.roles, emailVerified: user.emailVerified }, accessToken, refreshToken } });
};
```

#### `logout()` — Logout user  
**Response:** Success confirmation
```typescript
export const logout = async (_req, res, next) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};
```

#### `forgotPassword(email)` — Send password reset instructions  
**Response:** Success confirmation
```typescript
export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) return next(errorHandler(400, 'Email is required'));

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return next(errorHandler(404, 'No user found with this email'));

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpiry = resetExpiry;
  await user.save();

  await sendPasswordResetNotification(user.email, user.phone, resetToken, `${user.firstName} ${user.lastName}`);

  res.status(200).json({ success: true, message: 'Password reset instructions sent to your email and phone' });
};
```

#### `resetPassword(token, newPassword)` — Reset password with token  
**Response:** Success confirmation
```typescript
export const resetPassword = async (req, res, next) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!token || !newPassword) return next(errorHandler(400, 'Token and new password are required'));

  const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpiry: { $gt: new Date() } }).select('+password');
  if (!user) return next(errorHandler(400, 'Invalid or expired reset token'));

  user.password = bcrypt.hashSync(newPassword, 12);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiry = undefined;
  await user.save();

  res.status(200).json({ success: true, message: 'Password reset successfully' });
};
```

#### `refreshToken(refreshToken)` — Generate new access token  
**Response:** New token pair
```typescript
export const refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return next(errorHandler(400, 'Refresh token is required'));

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) return next(errorHandler(403, 'User not found or inactive'));

  const tokens = generateTokens(user);

  res.status(200).json({ success: true, message: 'Token refreshed successfully', data: tokens });
};
```

#### `getMe()` — Get current user profile  
**Access:** Authenticated users only
```typescript
export const getMe = async (req, res, next) => {
  const user = await User.findById(req.user?._id).select('-password -otpCode -resetPasswordToken');

  if (!user) return next(errorHandler(404, 'User not found'));

  res.status(200).json({ success: true, data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, avatar: user.avatar, roles: user.roles, isActive: user.isActive, emailVerified: user.emailVerified, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt } } });
};
```
---

## 🛣️ Authentication Routes

### Base Path: `/api/auth`

```typescript
POST   /register                 // Register new user with OTP
POST   /verify-otp               // Verify OTP and activate account
POST   /resend-otp               // Resend OTP for verification
POST   /login                    // User login (email/phone + password)
POST   /logout                   // Logout user
POST   /forgot-password          // Request password reset
POST   /reset-password/:token    // Reset password with token
POST   /refresh-token            // Refresh access token
GET    /me                       // Get current user profile
```

### Router Implementation

**File: `src/routes/authRoutes.ts`**

```typescript
import express from 'express';
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
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/register', register);

router.post('/verify-otp', verifyOTP);

router.post('/resend-otp', resendOTP);

router.post('/login', login);

router.post('/logout', authenticateToken, logout);

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

router.post('/refresh-token', refreshToken);

router.get('/me', authenticateToken, getMe);

export default router;
```

### Route Details

#### `POST /api/auth/register`
**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "phone": "+254712345678",
  "password": "securePassword123",
  "role": "staff"
}
```
**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email with the OTP sent.",
  "data": {
    "userId": "...",
    "email": "john@company.com",
    "phone": "+254712345678",
    "emailVerified": false
  }
}
```

#### `POST /api/auth/verify-otp`
**Body:**
```json
{
  "email": "john@company.com",
  "otp": "123456"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "john@company.com",
      "emailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `POST /api/auth/resend-otp`
**Body:**
```json
{
  "email": "john@company.com"
}
```
**Response:**
```json
{
  "success": true,
  "message": "OTP has been resent to your email and phone",
  "data": {
    "userId": "...",
    "email": "john@company.com",
    "otpExpiry": "2026-01-22T00:00:00.000Z"
  }
}
```

#### `POST /api/auth/login`
**Body:**
```json
{
  "email": "john@company.com",
  "password": "securePassword123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "email": "john@company.com",
      "roles": []
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `POST /api/auth/forgot-password`
**Body:**
```json
{
  "email": "john@company.com"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Password reset instructions sent to your email and phone"
}
```

#### `POST /api/auth/reset-password/:token`
**Body:**
```json
{
  "newPassword": "newSecurePassword123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

#### `POST /api/auth/refresh-token`
**Body:**
```json
{
  "refreshToken": "your_refresh_token_here"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `GET /api/auth/me`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "john@company.com"
    }
  }
}
```

---

## 🛡️ Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token  
**Usage:**
```typescript
router.get('/protected', authenticateToken, controllerFunction);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check user permissions  
**Parameters:**
- `allowedRoles` - Array of permitted roles

#### `requireAdmin`
**Purpose:** Admin access only
**Usage:**
```typescript
router.post('/roles', authenticateToken, requireAdmin, createRole);
```

#### `requireOwnershipOrAdmin`
**Purpose:** User owns resource OR is admin
**Usage:**
```typescript
router.put('/users/:userId', authenticateToken, requireOwnershipOrAdmin('userId'), updateUser);
```

#### `requireEmailVerification`
**Purpose:** Require verified email
**Usage:**
```typescript
router.post('/sensitive', authenticateToken, requireEmailVerification, handler);
```

#### `optionalAuth`
**Purpose:** Optional authentication (doesn't fail if no token)
**Usage:**
```typescript
router.get('/public', optionalAuth, handler);
```

---

## 📝 API Examples

### Complete Authentication Flow

#### 1. Register User with OTP
```bash
curl -X POST http://localhost:4500/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "admin@appointment.com",
    "password": "securePassword123",
    "phone": "+254712345678",
    "role": "staff"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email with the OTP sent.",
  "data": {
    "userId": "...",
    "email": "admin@appointment.com",
    "phone": "+254712345678",
    "emailVerified": false
  }
}
```

#### 2. Verify OTP
```bash
curl -X POST http://localhost:4500/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@appointment.com",
    "otp": "123456"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "admin@appointment.com",
      "emailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### 3. Login (Email or Phone)
```bash
curl -X POST http://localhost:4500/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@appointment.com",
    "password": "securePassword123"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "email": "admin@appointment.com"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### 4. Refresh Token
```bash
curl -X POST http://localhost:4500/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 🔒 Security Features

### Password Security
- **Hashing:** bcryptjs with 12 salt rounds
- **Minimum Length:** 6 characters
- **Hidden by Default:** Password field excluded from queries
- **Password Reset:** Secure token-based reset with 15-minute expiry

### JWT Security
- **Secret Key:** Environment variable
- **Access Token:** Short-lived (15 minutes default)
- **Refresh Token:** Long-lived (7 days default)
- **Token Payload:** 
  - `userId` - User ID
  - `roleIds` - Array of role IDs assigned to user
  - `userType` - Always "user" for unified system

### OTP Verification
- **6-Digit Code:** Random numeric OTP generation
- **Dual Channel:** Email and SMS delivery
- **Expiry Time:** Configurable (default 10 minutes)
- **Account Activation:** Required before login access

---

**Last Updated:** January 2026  
**Version:** 1.0.0
