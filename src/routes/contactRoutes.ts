
/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Public contact form submissions and management
 */

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

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a contact message (publicly accessible)
 *     tags: [Contact]
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
router.post("/", optionalAuth, submitContact);
/**
 * @swagger
 * /api/contact:
 *   get:
 *     summary: Get a list of contact submissions (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [NEW, READ, REPLIED, ARCHIVED]
 *         description: Filter contacts by their status.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search contacts by name, email, or subject.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt:asc, createdAt:desc]
 *           default: createdAt:desc
 *         description: Sort order for contacts.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page.
 *     responses:
 *       "200":
 *         description: A paginated list of contact submissions.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get("/", authenticateToken, requireAdmin, getContacts);
/**
 * @swagger
 * /api/contact/{contactId}:
 *   get:
 *     summary: Get a single contact submission by ID (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the contact submission to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the contact submission.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Contact not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:contactId", authenticateToken, requireAdmin, getContact);
/**
 * @swagger
 * /api/contact/{contactId}/reply:
 *   post:
 *     summary: Send a reply to a contact submission (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the contact submission to reply to.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: The reply message content.
 *     responses:
 *       "200":
 *         description: Reply sent successfully and contact status updated to REPLIED.
 *       "400":
 *         description: Invalid input (e.g., missing message, message too long).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Contact not found or recipient user/email not found.
 *       "500":
 *         description: Server error, possibly due to email sending failure.
 */
router.post("/:contactId/reply", authenticateToken, requireAdmin, replyToContact);
/**
 * @swagger
 * /api/contact/{contactId}/status:
 *   patch:
 *     summary: Update the status of a contact submission (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the contact submission to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [READ, REPLIED, ARCHIVED]
 *                 description: The new status for the contact.
 *     responses:
 *       "200":
 *         description: Contact status updated successfully.
 *       "400":
 *         description: Invalid status provided.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Contact not found.
 *       "500":
 *         description: Server error.
 */
router.patch("/:contactId/status", authenticateToken, requireAdmin, updateContactStatus);

export default router;
