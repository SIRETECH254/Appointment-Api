import express from "express";
import {
  submitContact,
  getContacts,
  getContact,
  updateContactStatus
} from "../controllers/contactController";
import { authenticateToken, requireAdmin, optionalAuth } from "../middleware/auth";

const router = express.Router();

router.post("/", optionalAuth, submitContact);
router.get("/", authenticateToken, requireAdmin, getContacts);
router.get("/:contactId", authenticateToken, requireAdmin, getContact);
router.patch("/:contactId/status", authenticateToken, requireAdmin, updateContactStatus);

export default router;
