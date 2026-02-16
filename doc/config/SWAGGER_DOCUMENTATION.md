# 📄 Appointment API - Swagger Documentation

## 📋 Table of Contents
- [Swagger Overview](#swagger-overview)
- [Implemented Modules (Swagger Documented)](#implemented-modules-swagger-documented)
  - [Auth Module](#auth-module)
  - [Users Module](#users-module)
  - [Roles Module](#roles-module)
  - [Services Module](#services-module)
  - [Availability Module](#availability-module)
  - [Appointments Module](#appointments-module)
  - [Breaks Module](#breaks-module)
  - [Payments Module](#payments-module)
  - [Notifications Module](#notifications-module)
  - [Store Configuration Module](#store-configuration-module)
  - [Contact Module](#contact-module)
  - [Dashboard Module](#dashboard-module)
- [Setup and Configuration](#setup-and-configuration)
- [Documenting Endpoints (JSDoc)](#documenting-endpoints-jsdoc)
- [Viewing the Documentation](#viewing-the-documentation)
- [Swagger UI Features](#swagger-ui-features)
- [Troubleshooting](#troubleshooting)
- [Adding New Modules](#adding-new-modules)

---

## Swagger Overview

This document explains how the Appointment API uses Swagger (OpenAPI) to automatically generate interactive API documentation. The documentation is generated from JSDoc comments within the route files and a central configuration file.

**Key Benefits:**
- **Interactive UI:** Provides a user-friendly interface to visualize and interact with the API's resources.
- **Auto-generated:** Documentation is kept up-to-date with code changes by parsing JSDoc comments.
- **Testable Endpoints:** Allows direct testing of API endpoints from the browser.
- **Standardized:** Follows the OpenAPI 3.0 specification, making it easily consumable by other tools.

---

## Implemented Modules (Swagger Documented)

The following core API modules are fully documented via JSDoc comments in their respective route files and are visible in the Swagger UI. Each subsection provides a brief overview, base path, a summary of its routes, and examples of the JSDoc used for documentation.

### Auth Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user session management
 */
\`\`\`

#### Overview
The Appointment API uses JWT (JSON Web Tokens) for authentication with a unified role-based access control (RBAC) system. All users are managed through a single User model with role assignments. The system incorporates OTP verification and comprehensive security features.

#### Base Path
`/api/auth`

#### Illustrative Route JSDoc Snippet (`POST /register`)
\`\`\`typescript
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
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/register` | Register new user with OTP |
| `POST` | `/verify-otp` | Verify OTP and activate account |
| `POST` | `/resend-otp` | Resend OTP for verification |
| `POST` | `/login` | User login (email/phone + password) |
| `POST` | `/logout` | Logout user |
| `POST` | `/forgot-password` | Request password reset |
| `POST` | `/reset-password/:token` | Reset password with token |
| `POST` | `/refresh-token` | Refresh JWT |
| `GET` | `/me` | Current user profile |

---

### Users Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User account and profile management
 */
\`\`\`

#### JSDoc Schema Snippet (User Model)
\`\`\`typescript
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
\`\`\`

#### Overview
User Management covers all users in the unified system. All users authenticate via JWT and are assigned roles from the Role model. Users can have multiple roles assigned. Role-based access control (RBAC) governs permissions throughout the system. The default role for new registrations is "customer".

#### Base Path
`/api/users`

#### Illustrative Route JSDoc Snippet (`PUT /profile`)
\`\`\`typescript
/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: URL of the user's avatar image. Send null or empty string to remove.
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: User's avatar image file.
 *     responses:
 *       "200":
 *         description: Profile updated successfully.
 *       "400":
 *         description: Invalid input (e.g., invalid phone, duplicate phone).
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/profile` | Get current user profile |
| `PUT` | `/profile` | Update own profile |
| `PUT` | `/change-password` | Change password |
| `GET` | `/notifications` | Get notification preferences |
| `PUT` | `/notifications` | Update notification preferences |
| `POST` | `/admin-create` | Admin create customer |
| `GET` | `/customers` | Get customers (admin) |
| `GET` | `/` | Get all users (admin) |
| `GET` | `/:userId` | Get single user (admin) |
| `PUT` | `/:userId` | Update user (admin) |
| `PUT` | `/:userId/status` | Update user status (admin) |
| `PUT` | `/:userId/admin` | Set user admin role (admin) |
| `GET` | `/:userId/roles` | Get user roles (admin) |
| `DELETE` | `/:userId` | Delete user (admin) |
| `POST` | `/:userId/roles` | Assign role to user (admin) |
| `DELETE` | `/:userId/roles/:roleId` | Remove role from user (admin) |

---

### Roles Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: User role and permission management
 */
\`\`\`

#### Overview
The Appointment API uses a unified role-based access control (RBAC) system where all users are managed through a single User model with role assignments. Roles define user permissions and access levels throughout the system.

#### Base Path
`/api/roles`

#### Illustrative Route JSDoc Snippet (`POST /`)
\`\`\`typescript
/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new custom role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *             properties:
 *               name:
 *                 type: string
 *                 description: The internal name of the role (e.g., 'support_agent').
 *               displayName:
 *                 type: string
 *                 description: The user-friendly display name of the role (e.g., 'Support Agent').
 *               description:
 *                 type: string
 *                 description: A brief description of the role.
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: A list of permissions granted to this role.
 *               isActive:
 *                 type: boolean
 *                 description: Whether the role is active.
 *     responses:
 *       "201":
 *         description: Role created successfully.
 *       "400":
 *         description: Invalid input (e.g., missing name/displayName, duplicate name).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Get all roles (admin) |
| `GET` | `/:roleId` | Get single role (admin) |
| `POST` | `/` | Create role (admin) |
| `PUT` | `/:roleId` | Update role (admin) |
| `DELETE` | `/:roleId` | Delete role (admin) |
| `GET` | `/:roleId/users` | Get users by role (admin) |
| `GET` | `/customer/users` | Get customers (admin) |

---

### Services Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Service catalog management
 */
\`\`\`

#### Overview
Service Management covers the service catalog used in appointment booking. Each service includes pricing, duration, sort ordering, and an active flag for availability. Admins manage services, while read access is public for discovery and booking.

#### Base Path
`/api/services`

#### Illustrative Route JSDoc Snippet (`POST /`)
\`\`\`typescript
/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Create a new service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - duration
 *               - fullPrice
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the service.
 *               description:
 *                 type: string
 *                 description: A brief description of the service.
 *               duration:
 *                 type: number
 *                 description: The duration of the service in minutes.
 *               fullPrice:
 *                 type: number
 *                 description: The full price of the service.
 *               sortOrder:
 *                 type: number
 *                 description: The order in which the service should appear.
 *               isActive:
 *                 type: boolean
 *                 description: Whether the service is active.
 *     responses:
 *       "201":
 *         description: Service created successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid numbers, duplicate name).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List services |
| `GET` | `/:serviceId` | Get service by id |
| `POST` | `/` | Create service (admin) |
| `PUT` | `/:serviceId` | Update service (admin) |
| `DELETE` | `/:serviceId` | Delete service (admin) |
| `PATCH` | `/:serviceId/toggle-status` | Activate/deactivate (admin) |
| `POST` | `/assign/:userId` | Assign services to staff (admin) |

---

### Availability Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Availability
 *   description: Staff availability and slot calculation
 */
\`\`\`

#### Overview
Availability (also called slots) is calculated dynamically. Slots are not stored in the database. Key characteristics: Slots are computed on demand based on working hours, service duration, appointments, and breaks. The frontend only displays slots; it never decides availability. The backend re-validates availability during booking to prevent double booking.

#### Base Path
`/api/availability`

#### Illustrative Route JSDoc Snippet (`GET /slots`)
\`\`\`typescript
/**
 * @swagger
 * /api/availability/slots:
 *   get:
 *     summary: Get available slots for staff, service, and date
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the staff member.
 *       - in: query
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: The ID(s) of the service(s). Can be repeated for multiple services.
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: The date for which to check availability (YYYY-MM-DD).
 *     responses:
 *       "200":
 *         description: An array of available time slots.
 *       "400":
 *         description: Invalid input (e.g., missing parameters, invalid ID, invalid date format).
 *       "404":
 *         description: Staff or service not found.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/slots` | Available slots for staff + service + date |
| `GET` | `/day` | Day availability summary |

---

### Appointments Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment scheduling and management
 */
\`\`\`

#### JSDoc Schema Snippet (Appointment Model)
\`\`\`typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Appointment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The unique identifier for the appointment.
 *         customerId:
 *           type: string
 *           description: The ID of the customer who booked the appointment.
 *         staffId:
 *           type: string
 *           description: The ID of the staff member assigned to the appointment.
 *         services:
 *           type: array
 *           items:
 *             type: string
 *           description: A list of service IDs included in the appointment.
 *         startTime:
 *           type: string
 *           format: date-time
 *           description: The scheduled start time of the appointment.
 *         endTime:
 *           type: string
 *           format: date-time
 *           description: The scheduled end time of the appointment.
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW]
 *           description: The current status of the appointment.
 *         bookingFeeAmount:
 *           type: number
 *           description: The calculated booking fee for the appointment.
 *         remainingAmount:
 *           type: number
 *           description: The remaining amount to be paid for the appointment.
 *         checkedInAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the customer checked in.
 *         actualEndTime:
 *           type: string
 *           format: date-time
 *           description: The actual end time of the appointment.
 */
\`\`\`

#### Overview
Appointments represent a booked service for a customer with a staff member at a specific time. Appointments can include **multiple services**, and the **booking fee** is derived from store configuration. The **remaining amount** is computed server-side from the full service total minus the booking fee (never accepted from `req.body`).

#### Base Path
`/api/appointments`

#### Illustrative Route JSDoc Snippet (`POST /`)
\`\`\`typescript
/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staffId
 *               - services
 *               - startTime
 *               - endTime
 *             properties:
 *               staffId:
 *                 type: string
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       "201":
 *         description: Appointment created successfully.
 *       "400":
 *         description: Bad request due to invalid input.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create appointment |
| `POST` | `/:appointmentId/confirm` | Confirm appointment |
| `PATCH` | `/:appointmentId/reschedule` | Reschedule |
| `PATCH` | `/:appointmentId/cancel` | Cancel |
| `PATCH` | `/:appointmentId/check-in` | Check in |
| `PATCH` | `/:appointmentId/complete` | Complete |
| `PATCH` | `/:appointmentId/no-show` | No-show |
| `GET` | `/` | List appointments (admin/staff) |
| `GET` | `/my` | Customer appointments |
| `GET` | `/:appointmentId` | Get appointment by id |
| `DELETE` | `/:appointmentId` | Delete appointment |

---

### Breaks Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Breaks
 *   description: Staff break time management
 */
\`\`\`

#### Overview
Breaks represent time ranges when a staff member is not available for appointments. Breaks are stored in the database and are used by availability to remove slots.

#### Base Path
`/api/breaks`

#### Illustrative Route JSDoc Snippet (`POST /`)
\`\`\`typescript
/**
 * @swagger
 * /api/breaks:
 *   post:
 *     summary: Create a new break for a staff member
 *     tags: [Breaks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staffId
 *               - startTime
 *               - endTime
 *             properties:
 *               staffId:
 *                 type: string
 *                 description: The ID of the staff member for whom to create the break.
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: The start time of the break.
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: The end time of the break.
 *               reason:
 *                 type: string
 *                 description: An optional reason for the break.
 *     responses:
 *       "201":
 *         description: Break created successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid times).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Staff not found.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List breaks (admin) |
| `GET` | `/:breakId` | Get break (admin) |
| `POST` | `/` | Create break (admin) |
| `PUT` | `/:breakId` | Update break (admin) |
| `DELETE` | `/:breakId` | Delete break (admin) |

---

### Payments Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and history
 */
\`\`\`

#### Overview
Payments cover booking fees and full payments for appointments. The system integrates **Daraja (M-Pesa STK Push)** and **Paystack (card)** using the same service-layer approach as SIRE-API, with external gateway services and an internal payment service that drives status updates. **There are no invoices** in this application.

#### Base Path
`/api/payments`

#### Illustrative Route JSDoc Snippet (`POST /initiate`)
\`\`\`typescript
/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initiate a service-only payment (no appointment required)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - services
 *               - method
 *             properties:
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of service IDs to be paid for.
 *               method:
 *                 type: string
 *                 enum: [MPESA, CARD, CASH]
 *                 description: Payment method.
 *               phone:
 *                 type: string
 *                 description: Phone number for MPESA payments.
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email for CARD payments.
 *     responses:
 *       "200":
 *         description: Payment initiated successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid method).
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: Service not found.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/initiate` | Initiate payment (services-based) |
| `POST` | `/service-payment` | Service payment |
| `POST` | `/webhooks/mpesa` | Daraja callback |
| `POST` | `/webhooks/paystack` | Paystack webhook |
| `GET` | `/` | List payments |
| `GET` | `/status/:checkoutRequestId` | Check M-Pesa payment status |
| `GET` | `/:paymentId` | Get payment |

---

### Notifications Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification management
 */
\`\`\`

#### Overview
The Appointment API Notification System handles all notification-related operations for appointment lifecycle and payment events. Notifications are delivered via email, SMS, and in-app (Socket.io), with read tracking and optional bidirectional actions.

#### Base Path
`/api/notifications`

#### Illustrative Route JSDoc Snippet (`POST /`)
\`\`\`typescript
/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Send a notification to a user (Admin/Staff only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient
 *               - type
 *               - category
 *               - subject
 *               - message
 *             properties:
 *               recipient:
 *                 type: string
 *                 description: The ID of the user to send the notification to.
 *               type:
 *                 type: string
 *                 enum: [email, sms, in_app]
 *                 description: The type of notification to send.
 *               category:
 *                 type: string
 *                 enum: [general, appointment, payment]
 *                 description: The category of the notification.
 *               subject:
 *                 type: string
 *                 description: The subject of the notification.
 *               message:
 *                 type: string
 *                 description: The content of the notification message.
 *               metadata:
 *                 type: object
 *                 description: Optional metadata to include with the notification.
 *               actions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     label: { type: string }
 *                     type: { type: string, enum: [api, navigate, modal, confirm] }
 *                     endpoint: { type: string }
 *                     method: { type: string, enum: [GET, POST, PATCH, DELETE] }
 *                     payload: { type: object }
 *                     route: { type: string }
 *                     modal: { type: string }
 *                     variant: { type: string }
 *                     requiresConfirmation: { type: boolean }
 *                     confirmationMessage: { type: string }
 *                 description: Optional actions associated with the notification.
 *               context:
 *                 type: object
 *                 properties:
 *                   resourceId: { type: string }
 *                   resourceType: { type: string }
 *                   additionalData: { type: object }
 *                 description: Optional context data for the notification.
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiry date for the notification.
 *     responses:
 *       "201":
 *         description: Notification sent successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid type/category).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "404":
 *         description: Recipient not found.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Send notification |
| `GET` | `/` | Get user notifications (paginated) |
| `GET` | `/unread-count` | Get unread count |
| `GET` | `/unread` | Get unread notifications |
| `GET` | `/category/:category` | Get notifications by category |
| `GET` | `/:notificationId` | Get single notification |
| `PATCH` | `/:notificationId/read` | Mark as read |
| `PATCH` | `/read-all` | Mark all as read |
| `DELETE` | `/:notificationId` | Delete notification |
| `POST` | `/bulk` | Send bulk notification |

---

### Store Configuration Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Store Configuration
 *   description: Global business rule configuration
 */
\`\`\`

#### Overview
The Appointment API uses a single store configuration document that defines business rules, pricing logic, and notification settings for the entire platform.

#### Base Path
`/api/store-configuration`

#### Illustrative Route JSDoc Snippet (`PUT /`)
\`\`\`typescript
/**
 * @swagger
 * /api/store-configuration:
 *   put:
 *     summary: Update the store's global configuration (Admin only)
 *     tags: [Store Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appointmentFeeType:
 *                 type: string
 *                 enum: [FIXED, PERCENTAGE]
 *                 description: Type of appointment fee.
 *               appointmentFeeValue:
 *                 type: number
 *                 description: Value of the appointment fee.
 *               currency:
 *                 type: string
 *                 enum: [KES]
 *                 description: Currency used for transactions.
 *               minBookingNotice:
 *                 type: number
 *                 description: Minimum notice in minutes required for booking.
 *               lateGracePeriod:
 *                 type: number
 *                 description: Grace period in minutes for late arrivals.
 *               allowWalkIns:
 *                 type: boolean
 *                 description: Whether walk-in appointments are allowed.
 *               notificationSettings:
 *                 type: object
 *                 properties:
 *                   sendSMS: { type: boolean }
 *                   sendEmail: { type: boolean }
 *                   sendPush: { type: boolean }
 *                   reminderTimes:
 *                     type: array
 *                     items: { type: number }
 *                     description: Array of reminder times in minutes before an appointment.
 *                 description: Configuration for various notification channels.
 *               businessHoursTimezone:
 *                 type: string
 *                 enum: [Africa/Nairobi]
 *                 description: Timezone for business hours.
 *     responses:
 *       "200":
 *         description: Store configuration updated successfully.
 *       "400":
 *         description: Invalid input (e.g., malformed notification settings, invalid reminder times).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Get store configuration (public) |
| `PUT` | `/` | Update store configuration (admin) |

---

### Contact Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Public contact form submissions and management
 */
\`\`\`

#### Overview
Contact Management allows customers to reach the admin by submitting a contact form. Submissions are accepted from **both authenticated and non-authenticated** users. When a user is logged in and sends a token, their `userId` is attached to the contact for reference. Admins can list, view, and update the status of contact entries (e.g. NEW, READ, REPLIED, ARCHIVED).

#### Base Path
`/api/contact`

#### Illustrative Route JSDoc Snippet (`POST /`)
\`\`\`typescript
/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a contact message (publicly accessible)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: [] # Optional: if an authenticated user submits, their userId is attached
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the person submitting the contact.
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email of the person submitting the contact.
 *               phone:
 *                 type: string
 *                 description: Optional phone number.
 *               subject:
 *                 type: string
 *                 description: Subject of the contact message.
 *               message:
 *                 type: string
 *                 description: The content of the message.
 *     responses:
 *       "201":
 *         description: Contact submitted successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid email).
 *       "500":
 *         description: Server error.
 */
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Submit contact (public; optionalAuth to attach user) |
| `GET` | `/` | List contacts (admin) |
| `GET` | `/:contactId` | Get contact by id (admin) |
| `POST` | `/:contactId/reply` | Send reply by email (admin) |
| `PATCH` | `/:contactId/status` | Update contact status (admin) |

---

### Dashboard Module

#### JSDoc Tags Snippet
\`\`\`typescript
/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Analytics and statistical dashboards
 */
\`\`\`

#### Overview
The Appointment API Dashboard Analytics System provides comprehensive analytics and statistics for both admin users and customers. Dashboards aggregate data from various modules including appointments, payments, services, and users to provide insights and overviews.

#### Base Path
`/api/dashboard`

#### Illustrative Route JSDoc Snippet (`GET /admin`)
\`\`\`typescript
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
\`\`\`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin` | Admin dashboard |
| `GET` | `/client` | Client dashboard |
| `GET` | `/revenue` | Revenue analytics |
| `GET` | `/appointments` | Appointment statistics |
| `GET` | `/service-demand` | Service demand analytics |
| `GET` | `/staff-activity` | Staff activity statistics |

---

## Setup and Configuration

Swagger documentation is configured in `src/config/swagger.ts`. This file defines the basic API information, server details, security schemes, and the paths where Swagger-JSdoc should look for API definitions.

**File: `src/config/swagger.ts`**
```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    // API metadata and global settings
    openapi: "3.0.0",
    info: {
      title: "Appointment API",
      version: "1.0.0",
      description: "Appointment API server for managing appointments and related resources",
      contact: { name: "Appointment API Support", email: "support@example.com" },
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" }
    },
    servers: [
      {
        url: process.env.NODE_ENV === "production"
            ? process.env.API_BASE_URL || "https://example.com"
            : `http://localhost:${process.env.PORT || 4500}`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server"
      }
    ],
    // Reusable components (e.g., security schemes, schemas)
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer token in the format: Bearer <token>"
        }
      },
      schemas: {
        // Global schemas can be defined here if needed,
        // otherwise inline schemas in JSDoc are common.
        // Example:
        // ErrorResponse: {
        //   type: 'object',
        //   properties: {
        //     success: { type: 'boolean', example: false },
        //     message: { type: 'string', example: 'Error message' }
        //   }
        // }
      }
    },
    // Global tags for categorizing endpoints
    tags: [
      { name: "Auth", description: "Authentication and user session management" },
      { name: "Users", description: "User account and profile management" },
      { name: "Roles", description: "User role and permission management" },
      { name: "Services", description: "Service catalog management" },
      { name: "Availability", description: "Staff availability and slot calculation" },
      { name: "Appointments", description: "Appointment scheduling and management" },
      { name: "Breaks", description: "Staff break time management" },
      { name: "Payments", description: "Payment processing and history" },
      { name: "Notifications", description: "User notification management" },
      { name: "Store Configuration", description: "Global business rule configuration" },
      { name: "Contact", description: "Public contact form submissions" },
      { name: "Dashboard", description: "Analytics and statistical dashboards" }
    ]
  },
  // Paths to files containing JSDoc comments for API definitions
  apis: ["./src/routes/*.ts"] // Scan all .ts files in the src/routes directory
};

const specs = swaggerJsdoc(options);

const swaggerConfig = {
  swaggerUi,
  specs,
  options: {
    explorer: true, // Enable the explorer bar for filtering endpoints
    customCss: `
      .swagger-ui .topbar { display: none } // Hide Swagger UI top bar
      .swagger-ui .info .title { color: #2563eb }
      .swagger-ui .scheme-container { background: #f8f9fa }
      .swagger-ui .info .description { font-size: 16px; color: #6b7280; }
    `,
    customSiteTitle: "Appointment API Documentation",
    customfavIcon: "/favicon.ico"
  }
};

export default swaggerConfig;
```

The `apis` array is crucial as it tells `swagger-jsdoc` which files to parse for JSDoc comments containing OpenAPI definitions. For this project, all route definitions are expected to be in `src/routes/*.ts`.

---

## Documenting Endpoints (JSDoc)

API endpoints are documented using JSDoc comments directly above their route definitions in the `src/routes` directory. These comments follow the OpenAPI 3.0 specification and are parsed by `swagger-jsdoc` to build the API documentation.

### General Structure

```typescript
/**
 * @swagger
 * /api/your-path:
 *   method:
 *     summary: A short summary of the endpoint's purpose.
 *     tags: [YourTag]
 *     description: |
 *       A more detailed description of the endpoint.
 *       Use markdown for rich text.
 *     security:
 *       - bearerAuth: [] # If authentication is required
 *     parameters: # Path, query, or header parameters
 *       - in: path
 *         name: paramName
 *         schema:
 *           type: string
 *         required: true
 *         description: Description of the path parameter.
 *       - in: query
 *         name: queryParam
 *         schema:
 *           type: integer
 *           format: int64
 *         description: Description of the query parameter.
 *     requestBody: # For POST, PUT, PATCH requests
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field1:
 *                 type: string
 *                 description: Description of field1.
 *               field2:
 *                 type: integer
 *             example:
 *               field1: "value"
 *               field2: 123
 *     responses:
 *       "200":
 *         description: Success response description.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *             example:
 *               message: "Operation successful"
 *               data: {}
 *       "400":
 *         description: Bad request.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Forbidden.
 *       "404":
 *         description: Not Found.
 *       "500":
 *         description: Server error.
 */
router.method("/api/your-path", middleware, controllerFunction);
```

### Key JSDoc Keywords

-   `@swagger`: Marks the beginning of a Swagger/OpenAPI definition block.
-   `summary`: A brief summary of the operation.
-   `tags`: Used to group related operations in the UI. Must correspond to a tag defined in `src/config/swagger.ts`.
-   `description`: A more detailed explanation. Can use Markdown.
-   `security`: Defines authentication requirements. `bearerAuth: []` refers to the scheme defined in `swagger.ts`.
-   `parameters`: Defines path, query, header, or cookie parameters.
    -   `in`: Location of the parameter (`path`, `query`, `header`, `cookie`).
    -   `name`: Name of the parameter.
    -   `schema`: Data type of the parameter.
    -   `required`: Boolean indicating if the parameter is mandatory.
-   `requestBody`: Describes the payload for requests that send data (POST, PUT, PATCH).
    -   `content`: Specifies media types (e.g., `application/json`, `multipart/form-data`).
    -   `schema`: Defines the structure of the request body.
    -   `example`: An example of the request body.
-   `responses`: Describes possible responses for the operation, indexed by HTTP status code.
    -   `description`: Explanation of the response.
    -   `content`: Specifies media types of the response body.
    -   `schema`: Defines the structure of the response body.
    -   `example`: An example of the response body.

### Example: Documenting a `POST` Request

Consider the `POST /api/appointments` route from `src/routes/appointmentRoutes.ts`:

```typescript
/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staffId
 *               - services
 *               - startTime
 *               - endTime
 *             properties:
 *               staffId:
 *                 type: string
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       "201":
 *         description: Appointment created successfully.
 *       "400":
 *         description: Bad request due to invalid input.
 */
router.post("/", authenticateToken, authorizeRoles(["customer", "admin"]), createAppointment);
```

---

## Viewing the Documentation

To view the generated Swagger documentation:

1.  **Ensure the API server is running.** You can start it in development mode:
    ```bash
    cd appointment-api
    npm run dev
    ```
2.  **Open your web browser** and navigate to:
    ```
    http://localhost:4500/api/docs
    ```
    (Note: The port might vary if configured differently in your `.env` file or if 4500 is already in use. Check your server's startup logs for the exact port.)

You will see an interactive Swagger UI listing all documented endpoints, grouped by tags.

---

## Swagger UI Features

-   **Endpoint List:** All documented API endpoints are listed and grouped by tags.
-   **Expand/Collapse:** Click on an endpoint to expand its details, including parameters, request body, and responses.
-   **"Try it out" Button:** For each endpoint, you can click "Try it out" to send a request directly from the UI.
    -   Fill in the parameters and request body.
    -   If a `bearerAuth` security scheme is defined, you can click the "Authorize" button at the top right, enter your JWT token, and it will be included in subsequent requests.
    -   Click "Execute" to send the request and see the response directly in the UI.
-   **Schemas:** Data models (schemas) are displayed at the bottom of the page, defining the structure of request and response bodies.

---

## Troubleshooting

-   **"No operations defined in spec!"**:
    -   Ensure your API server is running.
    -   Verify that `src/config/swagger.ts`'s `apis` array correctly points to your route files (e.g., `./src/routes/*.ts`).
    -   Check that your JSDoc comments are correctly formatted and are placed directly above the `router.method(...)` calls.
    -   Make sure `swagger-jsdoc` and `swagger-ui-express` are installed in your `package.json`.
-   **Routes not appearing/outdated**:
    -   Restart your API server after making changes to JSDoc comments or `swagger.ts`.
    -   Clear your browser cache if necessary.
-   **Authentication issues ("Unauthorized")**:
    -   Ensure you have provided a valid JWT token in the "Authorize" dialog.
    -   Verify that your `authenticateToken` middleware is correctly applied to protected routes.

---

## Adding New Modules

When adding a new module with new routes (e.g., `staffRoutes.ts` for Staff Management), follow these steps to integrate it into the Swagger documentation:

1.  **Create the Route File:** Add your new route definitions in `src/routes/yourNewModuleRoutes.ts`.
2.  **Update `swagger.ts` (Optional but Recommended):**
    *   Add a new tag to the `tags` array in `src/config/swagger.ts` for your new module (e.g., `{ name: "Staff", description: "Staff management operations" }`).
    *   Ensure your route file is covered by the `apis` array (e.g., `./src/routes/*.ts` already covers all `.ts` files in the `routes` directory).
3.  **Document Endpoints:** Add detailed JSDoc comments, following the structure outlined above, directly above each route definition in `src/routes/yourNewModuleRoutes.ts`.
4.  **Restart Server:** Restart your API server (`npm run dev`) to regenerate the Swagger documentation.
5.  **Verify:** Visit `http://localhost:4500/api/docs` to confirm your new module and its endpoints appear correctly.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
