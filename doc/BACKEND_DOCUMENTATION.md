# Appointment API - Backend Documentation

## Table of Contents
- [Technology Stack](#technology-stack)
- [Required Packages](#required-packages)
- [Database Models](#database-models)
- [Controllers](#controllers)
- [Routes](#routes)
- [Architecture Overview](#architecture-overview)

---

## Technology Stack

- Runtime: Node.js
- Framework: Express.js
- Language: TypeScript
- Database: MongoDB (Mongoose ODM)
- Realtime: Socket.io (live updates and reminders)
- API Docs: Swagger (swagger-jsdoc, swagger-ui-express)

---

## Required Packages

### Core Dependencies (from package.json)
```json
{
  "africastalking": "^0.7.7",
  "axios": "^1.13.3",
  "bcryptjs": "^3.0.2",
  "cloudinary": "^1.41.3",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "express": "^4.21.2",
  "jsonwebtoken": "^9.0.2",
  "mongoose": "^8.18.3",
  "multer": "^2.0.2",
  "multer-storage-cloudinary": "^4.0.0",
  "nodemailer": "^7.0.6",
  "socket.io": "^4.8.1",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "validator": "^13.15.0"
}
```

### Dev Dependencies
```json
{
  "ts-node": "^10.9.2",
  "typescript": "^5.9.2",
  "nodemon": "^3.1.10"
}
```
(Type definitions such as @types/express, @types/node, etc. are listed in dependencies in the current package.json.)

---

## Database Models

### 1. User Model
```typescript
interface IUser {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string; // hashed
  roles: ObjectId[]; // Role references
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string | null;
  avatarPublicId?: string | null;
  otpCode?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  lastLoginAt?: Date;
  services?: ObjectId[];
  workingHours?: {
    monday: Array<{ start: string; end: string }>;
    tuesday: Array<{ start: string; end: string }>;
    wednesday: Array<{ start: string; end: string }>;
    thursday: Array<{ start: string; end: string }>;
    friday: Array<{ start: string; end: string }>;
    saturday: Array<{ start: string; end: string }>;
    sunday: Array<{ start: string; end: string }>;
  };
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2. Role Model
```typescript
interface IRole {
  _id: ObjectId;
  name: string; // customer | admin | staff
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3. Service Model
```typescript
interface IService {
  _id: ObjectId;
  name: string;
  description?: string | null;
  duration: number; // minutes
  fullPrice: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. StoreConfiguration Model
```typescript
interface IStoreConfiguration {
  _id: ObjectId;
  appointmentFeeType: "FIXED" | "PERCENTAGE";
  appointmentFeeValue: number;
  currency: "KES";
  minBookingNotice: number; // minutes
  lateGracePeriod: number; // minutes
  allowWalkIns: boolean;
  notificationSettings: {
    sendSMS: boolean;
    sendEmail: boolean;
    sendPush: boolean;
    reminderTimes: number[]; // minutes before appointment
  };
  businessHoursTimezone: "Africa/Nairobi";
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 6. Appointment Model
```typescript
interface IAppointment {
  _id: ObjectId;
  customerId: ObjectId;
  staffId: ObjectId;
  services: ObjectId[];
  startTime: Date;
  endTime: Date;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  bookingFeeAmount: number;
  remainingAmount: number;
  checkedInAt?: Date;
  actualEndTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

Index:
```typescript
db.appointments.createIndex({ staffId: 1, startTime: 1, endTime: 1 })
```

---

### 7. Payment Model
```typescript
interface IPayment {
  _id: ObjectId;
  appointmentId?: ObjectId;
  paymentNumber: string;
  amount: number;
  currency: "KES";
  type: "BOOKING_FEE" | "FULL_PAYMENT";
  method: "MPESA" | "CARD" | "CASH";
  status: "PENDING" | "SUCCESS" | "FAILED";
  transactionRef?: string;
  processorRefs?: {
    daraja?: { merchantRequestId?: string; checkoutRequestId?: string };
    paystack?: { reference?: string };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 8. Break Model
```typescript
interface IBreak {
  _id: ObjectId;
  staffId: ObjectId;
  startTime: Date;
  endTime: Date;
  reason?: string;
  createdAt: Date;
}
```

---

### 9. Contact Model
```typescript
interface IContact {
  _id: ObjectId;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  userId?: ObjectId | null;  // set when submitter is authenticated
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ status: 1 }`, `{ createdAt: -1 }`, `{ userId: 1 }` (sparse).

---

### 10. Notification Model
```typescript
interface INotification {
  _id: ObjectId;
  userId: ObjectId;
  appointmentId?: ObjectId;
  type: "SMS" | "EMAIL" | "PUSH";
  title?: string;
  message: string;
  status: "PENDING" | "SENT" | "FAILED";
  scheduledFor?: Date;
  createdAt: Date;
}
```

---

### 11. Newsletter Model
```typescript
interface INewsletter {
  _id: ObjectId;
  email: string;
  userId?: ObjectId | null;
  status: "SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED";
  subscribedAt: Date;
  unsubscribedAt?: Date;
  unsubscribeToken?: string;
  source: "WEBSITE" | "ADMIN" | "API" | "IMPORT";
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ email: 1 }` (unique), `{ status: 1 }`, `{ subscribedAt: -1 }`, `{ userId: 1 }` (sparse), `{ unsubscribeToken: 1 }` (unique, sparse).

---

### 12. Review Model
```typescript
interface IReview {
  _id: ObjectId;
  userId: ObjectId;
  appointmentId: ObjectId;
  rating: number; // 1-5
  comment?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ userId: 1 }`, `{ appointmentId: 1 }`, `{ status: 1 }`, `{ createdAt: -1 }`.

---

## Controllers

### 1. Auth Controllers

#### `authController.ts`
- `register()` - Create user account (admin, staff, or customer)
- `verifyOTP()` - Verify OTP and activate account
- `resendOTP()` - Resend OTP for verification
- `login()` - Authenticate with phone/email and password
- `forgotPassword()` - Request password reset
- `resetPassword()` - Reset password with token
- `refreshToken()` - Renew JWT access token
- `logout()` - Invalidate session
- `getMe()` - Get current user profile

---

### 2. Role Controllers

#### `roleController.ts`
- `getAllRoles()` - List roles (admin)
- `getRole()` - Get role by ID (admin)
- `createRole()` - Create role (admin)
- `updateRole()` - Update role (admin)
- `deleteRole()` - Delete role (admin)
- `getUsersByRole()` - List users by role (admin)
- `getCustomers()` - List customers (admin)

---

### 3. User Controllers

#### `userController.ts`
- `getUserProfile()` - Get authenticated user's profile
- `updateUserProfile()` - Update own profile details
- `changePassword()` - Change password
- `getNotificationPreferences()` - Get notification preferences
- `updateNotificationPreferences()` - Update notification preferences
- `getAllUsers()` - Admin list of users
- `getUserById()` - Get user by ID (admin)
- `updateUser()` - Update user profile (admin)
- `updateUserStatus()` - Activate/deactivate user (admin)
- `setUserAdmin()` - Set user admin role (admin, deprecated)
- `getUserRoles()` - Get user roles (admin)
- `deleteUser()` - Delete user (admin)
- `adminCreateCustomer()` - Admin create customer
- `assignRole()` - Assign role to user (admin)
- `removeRole()` - Remove role from user (admin)
- `getCustomers()` - List customers (admin)

---

### 4. Staff Controllers

#### `staffController.ts`
- `createStaff()` - Create staff record for a user
- `getStaff()` - Get staff details
- `updateStaff()` - Update staff profile or assigned services
- `setWorkingHours()` - Update staff working hours
- `setAvailabilityStatus()` - Activate/deactivate staff
- `getStaffSchedule()` - Get staff calendar view

---

### 5. Service Controllers

#### `serviceController.ts`
- `createService()` - Create a new service
- `getServices()` - List services
- `getService()` - Get service by ID
- `updateService()` - Update service
- `deleteService()` - Delete service
- `toggleServiceStatus()` - Activate/deactivate service
- `assignServicesToStaff()` - Assign multiple services to a staff user

---

### 5. Availability Controllers

#### `availabilityController.ts`
- `getAvailableSlots()` - Calculate available slots for staff + service + date
- `getDayAvailability()` - View availability summary for a day

---

### 7. Appointment Controllers

#### `appointmentController.ts`
- `createAppointment()` - Book an appointment (pending)
- `confirmAppointment()` - Confirm after payment
- `rescheduleAppointment()` - Move appointment time
- `cancelAppointment()` - Cancel appointment
- `checkIn()` - Mark customer arrival
- `completeAppointment()` - Mark appointment completed
- `markNoShow()` - Mark no-show
- `getAppointments()` - List appointments (admin or staff)
- `getMyAppointments()` - Customer's appointments
- `getAppointmentById()` - Get single appointment by ID
- `deleteAppointment()` - Delete appointment (admin/staff)

---

### 7. Payment Controllers

#### `paymentController.ts`
- `initiatePayment()` - Start service-only payment (no appointment required)
- `servicePayment()` - Pay remaining amount for an appointment
- `mpesaWebhook()` - M-Pesa (Daraja) callback handler
- `paystackWebhook()` - Paystack callback handler
- `getPayments()` - List payments (admin/staff)
- `getMyPayments()` - Get authenticated user's payment history
- `getPayment()` - Get single payment
- `checkPaymentStatus()` - Check M-Pesa STK push payment status

---

### 9. Notification Controllers

#### `notificationController.ts`
- `sendNotification()` - Send notification (admin/staff)
- `getUserNotifications()` - List current user's notifications
- `getNotification()` - Get single notification by ID
- `markAsRead()` - Mark notification as read
- `markAllAsRead()` - Mark all as read
- `deleteNotification()` - Delete notification
- `getUnreadCount()` - Get unread count
- `getUnreadNotifications()` - Get unread notifications
- `getNotificationsByCategory()` - List by category
- `sendBulkNotification()` - Send bulk notification (admin)

---

### 9. Store Configuration Controllers

#### `storeConfigurationController.ts`
- `getStoreConfiguration()` - Get store configuration (public read)
- `updateStoreConfiguration()` - Update configuration (admin)

---

### 10. Break Controllers

#### `breakController.ts`
- `createBreak()` - Create break for staff (admin)
- `getBreaks()` - List breaks (admin)
- `getBreak()` - Get break by ID (admin)
- `updateBreak()` - Update break (admin)
- `deleteBreak()` - Delete break (admin)

---

### 11. Contact Controllers

#### `contactController.ts`
- `submitContact()` - Submit contact message (public; optional auth attaches userId)
- `getContacts()` - List contact submissions (admin)
- `getContact()` - Get contact by ID (admin)
- `replyToContact()` - Send reply by email to customer (admin; uses user email if contact has userId, else contact email)
- `updateContactStatus()` - Update contact status to READ/REPLIED/ARCHIVED (admin)

---

### 12. Newsletter Controllers

#### `newsletterController.ts`
- `subscribeNewsletter()` - Subscribe to newsletter (public; optional auth attaches userId)
- `unsubscribeNewsletter()` - Unsubscribe from newsletter (public; via token or email)
- `getSubscribers()` - List newsletter subscribers (admin)
- `getSubscriber()` - Get subscriber by ID (admin)
- `updateSubscriberStatus()` - Update subscriber status (admin)
- `deleteSubscriber()` - Delete subscriber (admin)
- `sendNewsletter()` - Send newsletter to subscribers (admin)
- `getSubscriptionStats()` - Get subscription statistics (admin)

---

### 13. Review Controllers

#### `reviewController.ts`
- `createReview()` - Create review for completed appointment (authenticated)
- `getReviews()` - List reviews (public; shows approved by default)
- `getReview()` - Get review by ID (public)
- `updateReview()` - Update review (owner or admin)
- `deleteReview()` - Delete review (owner or admin)
- `updateReviewStatus()` - Update review status (admin)

---

## Routes

### Auth Routes
Base: `/api/auth`

```typescript
POST   /register                  // Register user
POST   /verify-otp                // Verify OTP
POST   /resend-otp                // Resend OTP
POST   /login                     // Login
POST   /forgot-password           // Request password reset
POST   /reset-password/:token     // Reset password
POST   /refresh-token             // Refresh JWT
POST   /logout                    // Logout
GET    /me                        // Current user profile
```

---

### Role Routes
Base: `/api/roles`

```typescript
GET    /                          // Get all roles (admin)
GET    /:roleId                   // Get single role (admin)
POST   /                          // Create role (admin)
PUT    /:roleId                   // Update role (admin)
DELETE /:roleId                   // Delete role (admin)
GET    /:roleId/users             // Get users by role (admin)
GET    /customer/users            // Get customers (admin)
```

---

### User Routes
Base: `/api/users`

```typescript
GET    /profile                   // My profile
PUT    /profile                   // Update my profile
PUT    /change-password           // Change password
GET    /notifications             // Get notification preferences
PUT    /notifications             // Update notification preferences
POST   /admin-create              // Admin create customer
GET    /customers                 // List customers (admin)
GET    /                          // List users (admin)
GET    /:userId                   // Get user by ID (admin)
PUT    /:userId                   // Update user (admin)
PUT    /:userId/status            // Update user status (admin)
PUT    /:userId/admin             // Set user admin role (admin)
GET    /:userId/roles             // Get user roles (admin)
DELETE /:userId                   // Delete user (admin)
POST   /:userId/roles             // Assign role (admin)
DELETE /:userId/roles/:roleId     // Remove role (admin)
```

---

### Staff Routes
Base: `/api/staff`

```typescript
POST   /                          // Create staff
GET    /                          // List staff
GET    /:staffId                  // Get staff
PUT    /:staffId                  // Update staff
PATCH  /:staffId/working-hours    // Update working hours
PATCH  /:staffId/status           // Activate/deactivate
GET    /:staffId/schedule         // Staff schedule
```

---

### Service Routes
Base: `/api/services`

```typescript
POST   /                          // Create service
GET    /                          // List services
GET    /:serviceId                // Get service
PUT    /:serviceId                // Update service
PATCH  /:serviceId/toggle-status  // Activate/deactivate
DELETE /:serviceId               // Delete service
POST   /assign/:userId            // Assign services to staff (admin)
```

---

### Availability Routes
Base: `/api/availability`

```typescript
GET    /slots                     // Available slots for staff+service+date
GET    /day                        // Availability summary for a date
```

---

### Break Routes
Base: `/api/breaks`

```typescript
GET    /                          // List breaks (admin)
GET    /:breakId                  // Get break by ID (admin)
POST   /                          // Create break (admin)
PUT    /:breakId                  // Update break (admin)
DELETE /:breakId                  // Delete break (admin)
```

---

### Appointment Routes
Base: `/api/appointments`

```typescript
POST   /                          // Create appointment
POST   /:appointmentId/confirm    // Confirm appointment
PATCH  /:appointmentId/reschedule // Reschedule
PATCH  /:appointmentId/cancel     // Cancel
PATCH  /:appointmentId/check-in   // Check in
PATCH  /:appointmentId/complete   // Complete
PATCH  /:appointmentId/no-show    // No-show
GET    /                          // List appointments (admin/staff)
GET    /my                        // Customer appointments
```

---

### Payment Routes
Base: `/api/payments`

```typescript
POST   /initiate                  // Initiate service-only payment
POST   /service-payment           // Pay remaining amount for appointment
POST   /webhooks/mpesa            // M-Pesa webhook
POST   /webhooks/paystack         // Paystack webhook
GET    /                          // List payments (admin/staff)
GET    /my-payments               // Get user's payment history
GET    /status/:checkoutRequestId // Check M-Pesa payment status
GET    /:paymentId                // Get payment
```

---

### Notification Routes
Base: `/api/notifications`

```typescript
POST   /                          // Send notification (admin/staff)
GET    /                          // List current user's notifications
GET    /unread-count              // Get unread count
GET    /unread                    // Get unread notifications
GET    /category/:category        // List by category
GET    /:notificationId           // Get notification by ID
PATCH  /:notificationId/read      // Mark as read
PATCH  /read-all                  // Mark all as read
DELETE /:notificationId           // Delete notification
POST   /bulk                      // Send bulk notification (admin)
```

---

### Store Configuration Routes
Base: `/api/store-configuration`

```typescript
GET    /                          // Get configuration
PUT    /                          // Update configuration
```

---

### Contact Routes
Base: `/api/contact`

```typescript
POST   /                    // Submit contact (public; optionalAuth to attach user)
GET    /                    // List contacts (admin)
GET    /:contactId          // Get contact by id (admin)
POST   /:contactId/reply    // Send reply by email (admin)
PATCH  /:contactId/status   // Update contact status (admin)
```

---

### Newsletter Routes
Base: `/api/newsletter`

```typescript
POST   /subscribe                    // Subscribe to newsletter (public; optional auth)
GET    /unsubscribe                  // Unsubscribe from newsletter (public; via token or email)
GET    /                             // List subscribers (admin)
GET    /stats                        // Get subscription statistics (admin)
GET    /:subscriberId                 // Get subscriber by ID (admin)
PATCH  /:subscriberId/status          // Update subscriber status (admin)
DELETE /:subscriberId                // Delete subscriber (admin)
POST   /send                         // Send newsletter to subscribers (admin)
```

---

### Review Routes
Base: `/api/reviews`

```typescript
POST   /                             // Create review (authenticated)
GET    /                             // List reviews (public; approved by default)
GET    /:reviewId                    // Get review by ID (public)
PUT    /:reviewId                    // Update review (owner or admin)
DELETE /:reviewId                    // Delete review (owner or admin)
PATCH  /:reviewId/status             // Update review status (admin)
```

---

### Utility Routes
```typescript
GET    /api                        // API root info
GET    /api/health                 // Health check
GET    /api/debug/cors             // CORS debug (allowed origins, request origin)
GET    /api/docs                   // Swagger UI
```

## Architecture Overview

### Folder Structure
```
appointment-api/
├── src/
│   ├── config/
│   │   ├── cloudinary.ts          # Cloudinary upload config
│   │   └── swagger.ts             # Swagger documentation config
│   ├── models/
│   │   ├── Role.ts
│   │   ├── User.ts
│   │   ├── Service.ts
│   │   ├── StoreConfiguration.ts
│   │   ├── Appointment.ts
│   │   ├── Payment.ts
│   │   ├── Break.ts
│   │   ├── Contact.ts
│   │   ├── Notification.ts
│   │   ├── Newsletter.ts
│   │   └── Review.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── roleController.ts
│   │   ├── userController.ts
│   │   ├── serviceController.ts
│   │   ├── availabilityController.ts
│   │   ├── appointmentController.ts
│   │   ├── paymentController.ts
│   │   ├── notificationController.ts
│   │   ├── storeConfigurationController.ts
│   │   ├── breakController.ts
│   │   ├── contactController.ts
│   │   ├── newsletterController.ts
│   │   └── reviewController.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── roleRoutes.ts
│   │   ├── userRoutes.ts
│   │   ├── serviceRoutes.ts
│   │   ├── availabilityRoutes.ts
│   │   ├── appointmentRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   ├── notificationRoutes.ts
│   │   ├── storeConfigurationRoutes.ts
│   │   ├── breakRoutes.ts
│   │   ├── contactRoutes.ts
│   │   ├── newsletterRoutes.ts
│   │   └── reviewRoutes.ts
│   ├── middleware/
│   │   ├── auth.ts                # JWT auth, optionalAuth, requireAdmin, authorizeRoles
│   │   └── errorHandler.ts        # Global error handling
│   ├── services/
│   │   ├── external/
│   │   │   ├── darajaService.ts   # M-Pesa/Daraja integration
│   │   │   ├── emailService.ts    # Nodemailer email sending
│   │   │   ├── paystackService.ts # Paystack integration
│   │   │   └── smsService.ts      # Africa's Talking SMS
│   │   └── internal/
│   │       ├── notificationService.ts
│   │       └── paymentService.ts
│   ├── jobs/                      # Scheduled/cron jobs (to be added)
│   │   └── reminderScheduler.ts  # Appointment reminders (planned)
│   ├── scripts/
│   │   ├── seedRoles.ts           # Seed default roles
│   │   └── seedStoreConfiguration.ts  # Seed store config
│   ├── types/
│   │   ├── africastalking.d.ts
│   │   └── index.ts               # Shared interfaces (IUser, IContact, etc.)
│   ├── utils/
│   │   ├── authHelpers.ts         # JWT + OTP helpers
│   │   ├── availability.ts       # Slot calculation helpers
│   │   └── notificationHelper.ts
│   └── index.ts                   # App entry point
├── doc/                           # Documentation
├── .env                           # Environment variables
├── .gitignore
├── package.json
└── tsconfig.json
```

#### Jobs (planned)

The **jobs/** folder is reserved for scheduled and background jobs. It is not yet implemented and will be added later. Planned content:

- **reminderScheduler.ts** – Cron-based job to schedule and send appointment reminders (e.g. email/SMS) at configured times before appointments, using store configuration reminder times and the notification service.

---

### Middleware

#### Authentication Middleware (auth.ts)
- `authenticateToken` - Verify JWT and load user
- `optionalAuth` - Attach user if token present; do not require auth
- `requireAdmin` - Require admin role
- `authorizeRoles(allowedRoles)` - Role-based access control
- `requireOwnershipOrAdmin(resourceUserIdField)` - Owner or admin
- `requireEmailVerification` - Require verified email

#### Error Handling
- `errorHandler(statusCode, message)` - Centralized error formatter (errorHandler.ts)

---

### Availability & Slot Logic (No Slot Model)

Availability is calculated dynamically using:

- Staff working hours
- Existing appointments
- Breaks
- Service duration + buffers
- Minimum booking notice

Formula:
```
Available Time = Working Hours
               - Appointments
               - Breaks
               - Buffers
               - Past Time
```

Slots exist only in memory and are returned to the client for display.

---

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=4500
API_BASE_URL=https://yourdomain.com
CORS_ORIGIN=http://localhost:8081

# Database
MONGO_URI=mongodb://localhost:27017/appointment

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_refresh_secret

# Booking Policy
MIN_BOOKING_NOTICE_MINUTES=60
DEFAULT_TIMEZONE=Africa/Nairobi

# Payments
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORT_CODE=your_shortcode
MPESA_PASSKEY=your_passkey
CARD_PROVIDER_SECRET=your_card_provider_secret

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
FROM_EMAIL=noreply@appointmentapp.com
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username
```

---

### Security Features

1. Authentication
   - JWT-based authentication
   - Password hashing with bcryptjs
2. Authorization
   - Role-based access control (admin, staff, customer)
3. API Security
   - CORS allowlist
   - Rate limiting for auth and payments
   - Error responses omit stack traces in production

---

### Integration Points

1. Payment Gateways
   - M-Pesa for mobile money
   - Card payments via provider
2. Communication
   - Email via Nodemailer
   - SMS via Africa's Talking
   - Push via mobile provider (if enabled)
3. Background Jobs
   - Cron-based reminders
4. Real-time
   - Socket.io for live appointment status updates

---

### PDF Generation

- Optional receipt or booking summary PDF using PDFKit
- Store receipts with appointment or payment records if enabled

---

## Getting Started

### Installation
```bash
cd appointment-api
npm install
```

### Database Setup
```bash
# Ensure MongoDB is running
mongod
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### ObjectId Population
All GET endpoints automatically populate ObjectId references with their related documents. This ensures complete data is returned in API responses:

- **User references** (`userId`, `customerId`, `staffId`, `recipient`) are populated with `firstName`, `lastName`, `email`, and `phone` fields
- **Appointment references** (`appointmentId`) are populated with appointment details including nested `customerId`, `staffId`, and `services`
- **Service references** (`services`) are populated with service details (`name`, `duration`, `fullPrice`, etc.)
- **Role references** (`roles`) are populated with role information (`name`, `displayName`, `description`, `permissions`)

This means when you fetch a payment, contact, notification, or any other resource, all related ObjectId fields will contain the full document data instead of just the ID.

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

---

## Status Codes

- 200 - OK
- 201 - Created
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 500 - Internal Server Error

---

Last Updated: January 2026
Version: 1.0.0

Note: This documentation reflects the current codebase (models, controllers, routes, folder structure, and middleware as implemented).

- 500 - Internal Server Error

---

Last Updated: January 2026
Version: 1.0.0

Note: This documentation reflects the current codebase (models, controllers, routes, folder structure, and middleware as implemented).
