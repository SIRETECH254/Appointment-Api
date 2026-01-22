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

### Core Dependencies
```json
{
  "axios": "^1.12.2",
  "bcryptjs": "^3.0.2",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "express": "^4.21.2",
  "joi": "^18.0.1",
  "jsonwebtoken": "^9.0.2",
  "mongoose": "^8.18.3",
  "node-cron": "^3.0.3",
  "nodemailer": "^7.0.6",
  "socket.io": "^4.8.1",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "africastalking": "^0.7.7"
}
```

### Dev Dependencies
```json
{
  "@types/cors": "^2.8.19",
  "@types/express": "^5.0.3",
  "@types/jsonwebtoken": "^9.0.10",
  "@types/node": "^24.5.2",
  "@types/swagger-jsdoc": "^6.0.4",
  "@types/swagger-ui-express": "^4.1.8",
  "nodemon": "^3.1.10",
  "ts-node": "^10.9.2",
  "typescript": "^5.9.2"
}
```

---

## Database Models

### 1. User Model
```typescript
interface IUser {
  _id: ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2. Staff Model
```typescript
interface IStaff {
  _id: ObjectId;
  userId: ObjectId;
  services: ObjectId[];
  workingHours: {
    monday: Array<{ start: string; end: string }>;
    tuesday: Array<{ start: string; end: string }>;
    wednesday: Array<{ start: string; end: string }>;
    thursday: Array<{ start: string; end: string }>;
    friday: Array<{ start: string; end: string }>;
    saturday: Array<{ start: string; end: string }>;
    sunday: Array<{ start: string; end: string }>;
  };
  isActive: boolean;
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
  description?: string;
  duration: number; // minutes
  fullPrice: number;
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
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

### 5. Appointment Model
```typescript
interface IAppointment {
  _id: ObjectId;
  customerId: ObjectId;
  staffId: ObjectId;
  serviceId: ObjectId;
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

### 6. Payment Model
```typescript
interface IPayment {
  _id: ObjectId;
  appointmentId: ObjectId;
  amount: number;
  currency: "KES";
  type: "BOOKING_FEE" | "FULL_PAYMENT";
  method: "MPESA" | "CARD" | "CASH";
  status: "PENDING" | "SUCCESS" | "FAILED";
  transactionRef?: string;
  createdAt: Date;
}
```

---

### 7. Break Model
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

### 8. Notification Model
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

## Controllers

### 1. Auth Controllers

#### `authController.ts`
- `register()` - Create user account (admin, staff, or customer)
- `login()` - Authenticate with phone/email and password
- `refreshToken()` - Renew JWT access token
- `logout()` - Invalidate session
- `getMe()` - Get current user profile

---

### 2. User Controllers

#### `userController.ts`
- `getUsers()` - Admin list of users
- `getUser()` - Get user by ID
- `updateUser()` - Update user profile or role
- `deactivateUser()` - Soft disable user
- `getProfile()` - Get authenticated user's profile
- `updateProfile()` - Update own profile details

---

### 3. Staff Controllers

#### `staffController.ts`
- `createStaff()` - Create staff record for a user
- `getStaff()` - Get staff details
- `updateStaff()` - Update staff profile or assigned services
- `setWorkingHours()` - Update staff working hours
- `setAvailabilityStatus()` - Activate/deactivate staff
- `getStaffSchedule()` - Get staff calendar view

---

### 4. Service Controllers

#### `serviceController.ts`
- `createService()` - Create a new service
- `getServices()` - List services
- `getService()` - Get service by ID
- `updateService()` - Update service
- `toggleServiceStatus()` - Activate/deactivate service

---

### 5. Availability Controllers

#### `availabilityController.ts`
- `getAvailableSlots()` - Calculate available slots for staff + service + date
- `getDayAvailability()` - View availability summary for a day

---

### 6. Appointment Controllers

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

---

### 7. Payment Controllers

#### `paymentController.ts`
- `initiatePayment()` - Start booking fee or full payment
- `paymentWebhook()` - Payment provider callback handler
- `getPayments()` - List payments
- `getPayment()` - Get single payment

---

### 8. Notification Controllers

#### `notificationController.ts`
- `scheduleReminders()` - Schedule appointment reminders
- `sendNotification()` - Send notification instantly
- `getNotifications()` - List user notifications
- `updateNotificationStatus()` - Mark as sent/failed

---

### 9. Store Configuration Controllers

#### `storeConfigController.ts`
- `getConfig()` - Get store configuration
- `updateConfig()` - Update appointment fee, reminders, and policies

---

## Routes

### Auth Routes
Base: `/api/auth`

```typescript
POST   /register                  // Register user
POST   /login                     // Login
POST   /refresh-token             // Refresh JWT
POST   /logout                    // Logout
GET    /me                        // Current user profile
```

---

### User Routes
Base: `/api/users`

```typescript
GET    /                          // List users (admin)
GET    /:userId                   // Get user by ID (admin)
PUT    /:userId                   // Update user (admin)
PATCH  /:userId/deactivate        // Deactivate user (admin)
GET    /profile                   // My profile
PUT    /profile                   // Update my profile
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
```

---

### Availability Routes
Base: `/api/availability`

```typescript
GET    /slots                     // Available slots for staff+service+date
GET    /day                        // Availability summary for a date
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
POST   /initiate                  // Initiate payment
POST   /webhook                   // Payment webhook
GET    /                          // List payments
GET    /:paymentId                // Get payment
```

---

### Notification Routes
Base: `/api/notifications`

```typescript
POST   /send                      // Send notification
POST   /schedule                  // Schedule reminders
GET    /                          // List notifications
PATCH  /:notificationId/status    // Update status
```

---

### Store Configuration Routes
Base: `/api/config`

```typescript
GET    /                          // Get configuration
PUT    /                          // Update configuration
```

---

### Utility Routes
```typescript
GET    /api                        // API root info
GET    /api/health                 // Health check
GET    /api/docs                   // Swagger UI
```

## Architecture Overview

### Folder Structure
```
appointment-api/
├── src/
│   ├── config/
│   │   ├── swagger.ts             # Swagger documentation config
│   ├── models/
│   │   ├── User.ts
│   │   ├── Staff.ts
│   │   ├── Service.ts
│   │   ├── StoreConfiguration.ts
│   │   ├── Appointment.ts
│   │   ├── Payment.ts
│   │   ├── Break.ts
│   │   └── Notification.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── userController.ts
│   │   ├── staffController.ts
│   │   ├── serviceController.ts
│   │   ├── availabilityController.ts
│   │   ├── appointmentController.ts
│   │   ├── paymentController.ts
│   │   ├── notificationController.ts
│   │   └── storeConfigController.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── userRoutes.ts
│   │   ├── staffRoutes.ts
│   │   ├── serviceRoutes.ts
│   │   ├── availabilityRoutes.ts
│   │   ├── appointmentRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   ├── notificationRoutes.ts
│   │   └── storeConfigRoutes.ts
│   ├── middleware/
│   │   ├── auth.ts                # JWT auth and role checks
│   │   ├── errorHandler.ts        # Global error handling
│   │   ├── validate.ts            # Request validation
│   │   └── rateLimit.ts           # Rate limiting
│   ├── services/
│   │   ├── availabilityService.ts # Slot calculation engine
│   │   ├── paymentService.ts      # Payment gateway integrations
│   │   └── notificationService.ts # Reminders and notifications
│   ├── jobs/
│   │   └── reminderScheduler.ts   # Cron-based reminder jobs
│   ├── utils/
│   │   ├── time.ts                # Timezone and time helpers
│   │   └── tokens.ts              # JWT helpers
│   └── index.ts                   # App entry point
├── doc/                           # Documentation
├── .env                           # Environment variables
├── .gitignore
├── package.json
└── tsconfig.json
```

---

### Middleware

#### Authentication Middleware
- `authenticateToken` - Verify JWT and load user
- `authorizeRoles(allowedRoles)` - Role-based access control

#### Validation & Error Handling
- `validateRequest` - Joi-based payload validation
- `errorHandler` - Centralized error formatter

#### Rate Limiting
- Apply rate limits to auth and payment endpoints

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
   - Role-based access control (ADMIN, STAFF, CUSTOMER)
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

Note: This documentation describes the intended backend design and architecture, not necessarily the current implementation.
