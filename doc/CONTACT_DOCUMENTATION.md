# Appointment API - Contact Management Documentation

## Table of Contents
- [Contact Management Overview](#contact-management-overview)
- [Contact Model](#-contact-model)
- [Contact Controller](#-contact-controller)
- [Contact Routes](#-contact-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Contact Management Overview

Contact Management allows customers to reach the admin by submitting a contact form. Submissions are accepted from **both authenticated and non-authenticated** users. When a user is logged in and sends a token, their `userId` is attached to the contact for reference. Admins can list, view, and update the status of contact entries (e.g. NEW, READ, REPLIED, ARCHIVED).

---

## Contact Model

### Schema Definition
```typescript
interface IContact {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  userId?: string | null;  // set when submitter is authenticated
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Contact.ts`**

```typescript
import mongoose, { Schema } from "mongoose";
import type { IContact } from "../types/index";

const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 2000
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    status: {
      type: String,
      enum: ["NEW", "READ", "REPLIED", "ARCHIVED"],
      default: "NEW"
    }
  },
  { timestamps: true }
);

contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ userId: 1 }, { sparse: true });

const Contact = mongoose.model<IContact>("Contact", contactSchema);

export default Contact;
```

### Validation Rules
```typescript
name:    { required: true, maxlength: 120 }
email:   { required: true, maxlength: 254 }
phone:   { optional, maxlength: 30 }
subject: { required: true, maxlength: 200 }
message: { required: true, maxlength: 2000 }
userId:  { optional, ref User }
status:  { default: "NEW", enum: NEW | READ | REPLIED | ARCHIVED }
```

---

## Contact Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Contact from "../models/Contact";
import User from "../models/User";
import { sendGenericEmail } from "../services/external/emailService";
```

### Functions Overview

#### `submitContact()`
**Purpose:** Submit a contact message (how customers reach admin)  
**Access:** Public (no auth required); optional auth attaches `userId`  
**Validation:** `name`, `email`, `subject`, `message` required; `phone` optional; basic email format/length  
**Process:** If `req.user` exists (after optionalAuth), set `userId`. Create contact, return 201.  
**Response:** Created contact

**Controller Implementation:**
```typescript
export const submitContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, subject, message } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
      return next(errorHandler(400, "name, email, subject and message are required"));
    }

    if (trimmedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return next(errorHandler(400, "Valid email is required"));
    }

    if (trimmedName.length > 120) {
      return next(errorHandler(400, "Name must be at most 120 characters"));
    }
    if (trimmedSubject.length > 200) {
      return next(errorHandler(400, "Subject must be at most 200 characters"));
    }
    if (trimmedMessage.length > 2000) {
      return next(errorHandler(400, "Message must be at most 2000 characters"));
    }

    const userId = req.user?._id ?? null;
    const trimmedPhone = typeof phone === "string" ? phone.trim() || null : null;
    if (trimmedPhone && trimmedPhone.length > 30) {
      return next(errorHandler(400, "Phone must be at most 30 characters"));
    }

    const contact = new Contact({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone || undefined,
      subject: trimmedSubject,
      message: trimmedMessage,
      userId: userId || undefined,
      status: "NEW"
    });

    await contact.save();

    res.status(201).json({
      success: true,
      message: "Contact submitted successfully",
      data: { contact }
    });
  } catch (error: any) {
    console.error("Submit contact error:", error);
    next(errorHandler(500, "Server error while submitting contact"));
  }
};
```

#### `getContacts(query)`
**Purpose:** List contact submissions  
**Access:** Admin  
**Validation:** Optional query filters only  
**Process:** Filter by `status`, optional `search` (name/email/subject), sort by `createdAt`  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Response:** Contact list with pagination

**Controller Implementation:**
```typescript
export const getContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search, sort, page = 1, limit = 10 } = req.query;
    const query: any = {};

    if (status === "NEW" || status === "READ" || status === "REPLIED" || status === "ARCHIVED") {
      query.status = status;
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { subject: { $regex: term, $options: "i" } }
      ];
    }

    let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (typeof sort === "string" && sort.length > 0) {
      const [field, order] = sort.split(":");
      if (field === "createdAt" && (order === "asc" || order === "desc")) {
        sortOptions = { createdAt: order === "asc" ? 1 : -1 };
      }
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query contacts with pagination
    const contacts = await Contact.find(query)
      .sort(sortOptions)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await Contact.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        contacts,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalContacts: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get contacts error:", error);
    next(errorHandler(500, "Server error while fetching contacts"));
  }
};
```

#### `getContact(contactId)`
**Purpose:** Fetch a contact by id  
**Access:** Admin  
**Validation:** Contact must exist  
**Process:** Find by id  
**Response:** Contact record

**Controller Implementation:**
```typescript
export const getContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { contactId } = req.params;
    const contact = await Contact.findById(contactId);

    if (!contact) {
      return next(errorHandler(404, "Contact not found"));
    }

    res.status(200).json({
      success: true,
      data: { contact }
    });
  } catch (error: any) {
    console.error("Get contact error:", error);
    next(errorHandler(500, "Server error while fetching contact"));
  }
};
```

#### `updateContactStatus(contactId, { status })`
**Purpose:** Update contact status (e.g. mark as READ, REPLIED, ARCHIVED)  
**Access:** Admin  
**Validation:** Contact must exist; `status` must be READ, REPLIED, or ARCHIVED  
**Process:** Update and save  
**Response:** Updated contact

**Controller Implementation:**
```typescript
export const updateContactStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { status } = req.body;

    const allowed: ("READ" | "REPLIED" | "ARCHIVED")[] = ["READ", "REPLIED", "ARCHIVED"];
    if (!status || typeof status !== "string" || !allowed.includes(status as "READ" | "REPLIED" | "ARCHIVED")) {
      return next(errorHandler(400, "status must be one of: READ, REPLIED, ARCHIVED"));
    }

    const contact = await Contact.findById(contactId);
    if (!contact) {
      return next(errorHandler(404, "Contact not found"));
    }

    contact.status = status as "READ" | "REPLIED" | "ARCHIVED";
    await contact.save();

    res.status(200).json({
      success: true,
      message: "Contact status updated successfully",
      data: { contact }
    });
  } catch (error: any) {
    console.error("Update contact status error:", error);
    next(errorHandler(500, "Server error while updating contact status"));
  }
};
```

#### `replyToContact(contactId, { message })`
**Purpose:** Admin sends a reply by email to the customer who submitted the contact.  
**Access:** Admin  
**Validation:** Contact must exist; `message` required, non-empty, max length 2000.  
**Process:** If contact has `userId`, load User and use `user.email`; otherwise use `contact.email`. Send email via `sendGenericEmail(to, "Re: " + contact.subject, message)`. Set contact `status` to REPLIED, save.  
**Response:** Success and updated contact

**Controller Implementation:**
```typescript
export const replyToContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { message } = req.body;

    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (!trimmedMessage) {
      return next(errorHandler(400, "Reply message is required"));
    }
    if (trimmedMessage.length > 2000) {
      return next(errorHandler(400, "Reply message must be at most 2000 characters"));
    }

    const contact = await Contact.findById(contactId);
    if (!contact) {
      return next(errorHandler(404, "Contact not found"));
    }

    let recipientEmail: string;
    if (contact.userId) {
      const user = await User.findById(contact.userId);
      if (!user || !user.email) {
        return next(errorHandler(400, "User not found or has no email; reply to contact email instead"));
      }
      recipientEmail = user.email;
    } else {
      recipientEmail = contact.email;
    }

    try {
      await sendGenericEmail(recipientEmail, `Re: ${contact.subject}`, trimmedMessage);
    } catch (emailError: any) {
      console.error("Reply email error:", emailError);
      return next(errorHandler(500, "Failed to send reply email"));
    }

    contact.status = "REPLIED";
    await contact.save();

    res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: { contact }
    });
  } catch (error: any) {
    console.error("Reply to contact error:", error);
    next(errorHandler(500, "Server error while sending reply"));
  }
};
```

---

## Contact Routes

### Base Path: `/api/contact`

```typescript
POST   /                    // Submit contact (public; optionalAuth to attach user)
GET    /                    // List contacts (admin)
GET    /:contactId          // Get contact by id (admin)
POST   /:contactId/reply    // Send reply by email (admin)
PATCH  /:contactId/status   // Update contact status (admin)
```

### Router Implementation

**File: `src/routes/contactRoutes.ts`**

```typescript
import express from "express";
import {
  submitContact,
  getContacts,
  getContact,
  updateContactStatus,
  replyToContact
} from "../controllers/contactController";
import { authenticateToken, requireAdmin, optionalAuth } from "../middleware/auth";

const router = express.Router();

router.post("/", optionalAuth, submitContact);
router.get("/", authenticateToken, requireAdmin, getContacts);
router.get("/:contactId", authenticateToken, requireAdmin, getContact);
router.post("/:contactId/reply", authenticateToken, requireAdmin, replyToContact);
router.patch("/:contactId/status", authenticateToken, requireAdmin, updateContactStatus);

export default router;
```

### Route Details

#### `POST /api/contact`
**Headers (optional):** `Authorization: Bearer <token>` — if present, `userId` is attached to the contact  
**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+254700000000",
  "subject": "Booking enquiry",
  "message": "I would like to know your availability next week."
}
```
**Response:**
```json
{
  "success": true,
  "message": "Contact submitted successfully",
  "data": {
    "contact": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Booking enquiry",
      "status": "NEW",
      "createdAt": "..."
    }
  }
}
```

#### `GET /api/contact`
**Headers:** `Authorization: Bearer <admin_token>`  
**Query (optional):** `status=NEW|READ|REPLIED|ARCHIVED`, `search=<term>`, `sort=createdAt:asc|desc`, `page`, `limit`  
**Response:**
```json
{
  "success": true,
  "data": {
    "contacts": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalContacts": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/contact/:contactId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:**
```json
{
  "success": true,
  "data": {
    "contact": {}
  }
}
```

#### `POST /api/contact/:contactId/reply`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "message": "Thank you for reaching out. We will get back to you shortly."
}
```
If the contact has `userId`, the reply is sent to that user's email; otherwise to the contact's submitted email. Contact status is set to REPLIED.
**Response:**
```json
{
  "success": true,
  "message": "Reply sent successfully",
  "data": {
    "contact": {}
  }
}
```

#### `PATCH /api/contact/:contactId/status`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "status": "READ"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Contact status updated successfully",
  "data": {
    "contact": {}
  }
}
```

---

## Middleware

### optionalAuth
**Purpose:** Attach user to request if a valid JWT is sent; do not require auth.  
**Usage:** Used on `POST /api/contact` so authenticated users get their `userId` stored with the contact.
```typescript
router.post("/", optionalAuth, submitContact);
```

### authenticateToken
**Purpose:** Verify JWT for protected routes.  
**Usage:** Admin contact routes.
```typescript
router.get("/", authenticateToken, requireAdmin, getContacts);
```

### requireAdmin
**Purpose:** Restrict access to admin role.  
**Usage:** List, get one, reply, and update status.
```typescript
router.get("/:contactId", authenticateToken, requireAdmin, getContact);
router.post("/:contactId/reply", authenticateToken, requireAdmin, replyToContact);
router.patch("/:contactId/status", authenticateToken, requireAdmin, updateContactStatus);
```

---

## API Examples

### Submit Contact (no auth)
```bash
curl -X POST http://localhost:4500/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "subject": "Question",
    "message": "When do you open?"
  }'
```

### Submit Contact (with auth — userId will be attached)
```bash
curl -X POST http://localhost:4500/api/contact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "subject": "Question",
    "message": "When do you open?"
  }'
```

### List Contacts (admin)
```bash
curl -X GET "http://localhost:4500/api/contact?status=NEW&sort=createdAt:desc" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Contact by ID (admin)
```bash
curl -X GET http://localhost:4500/api/contact/<contactId> \
  -H "Authorization: Bearer <admin_token>"
```

### Reply to Contact (admin)
```bash
curl -X POST http://localhost:4500/api/contact/<contactId>/reply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"message": "Thank you for your message. We will respond soon."}'
```

### Update Contact Status (admin)
```bash
curl -X PATCH http://localhost:4500/api/contact/<contactId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"status": "REPLIED"}'
```

---

## Security Features

- **Public submit:** No auth required; anyone can submit. Consider rate limiting on `POST /api/contact` (e.g. same as auth endpoints).
- **Optional auth:** If token is sent, `userId` is attached for admin reference.
- **Admin-only read/update/reply:** List, get one, reply, and update status require `authenticateToken` and `requireAdmin`.
- **Validation:** Required fields and max lengths enforced; basic email format check.

---

## Error Handling

Common responses:

```json
{ "success": false, "message": "name, email, subject and message are required" }
```
```json
{ "success": false, "message": "Valid email is required" }
```
```json
{ "success": false, "message": "Contact not found" }
```
```json
{ "success": false, "message": "status must be one of: READ, REPLIED, ARCHIVED" }
```
```json
{ "success": false, "message": "Reply message is required" }
```
```json
{ "success": false, "message": "Reply message must be at most 2000 characters" }
```
```json
{ "success": false, "message": "Failed to send reply email" }
```
```json
{ "success": false, "message": "Admin access required" }
```

---

## Database Indexes

```typescript
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ userId: 1 }, { sparse: true });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
