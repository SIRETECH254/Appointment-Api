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

### Functions Overview

#### `register(userData)`
**Purpose:** Register new user with OTP verification  
**Access:** Public (for customer registration) or Admin (for admin creation)
**Validation:**
- Email uniqueness check
- Password strength validation
- Phone number format validation
- Role assignment validation (optional, defaults to "customer")
**Process:**
- Generate and hash password
- Assign default "customer" role (or specified role if provided)
- Create OTP code with expiry
- Send OTP via email and SMS
- Set user as unverified initially
**Response:** User data without password, verification status, with roles array

#### `verifyOTP(email/phone, otp)`
**Purpose:** Verify OTP and activate account  
**Access:** Public  
**Process:** Verify OTP, activate account, clear OTP, send welcome notification, generate tokens.

#### `resendOTP(email/phone)`
**Purpose:** Resend OTP for verification  
**Access:** Public  
**Process:** Generate new OTP, update user, send notification.

#### `login(credentials)`
**Purpose:** Authenticate users  
**Process:** Verify credentials, check verification/active status, generate tokens.

#### `logout()`
**Purpose:** Invalidate current session  
**Implementation:** Client-side token removal.

#### `forgotPassword(email)`
**Purpose:** Send password reset instructions  
**Process:** Generate secure token, store expiry, send notification.

#### `resetPassword(token, newPassword)`
**Purpose:** Reset password with token  
**Process:** Verify token, hash new password, clear token.

#### `refreshToken(refreshToken)`
**Purpose:** Generate new access token  
**Process:** Verify refresh token, regenerate tokens.

#### `getMe()`
**Purpose:** Get current user profile  
**Access:** Authenticated users only.

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

#### `requireOwnershipOrAdmin`
**Purpose:** User owns resource OR is admin

#### `requireEmailVerification`
**Purpose:** Require verified email

#### `optionalAuth`
**Purpose:** Optional authentication (doesn't fail if no token)

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

#### 2. Verify OTP
```bash
curl -X POST http://localhost:4500/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@appointment.com",
    "otp": "123456"
  }'
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

#### 4. Refresh Token
```bash
curl -X POST http://localhost:4500/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
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
