import express from "express";
import {
  initiatePayment,
  mpesaWebhook,
  paystackWebhook,
  getPayments,
  getPayment
} from "../controllers/paymentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.post("/initiate", authenticateToken, initiatePayment);
router.post("/webhooks/mpesa", mpesaWebhook);
router.post("/webhooks/paystack", paystackWebhook);
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getPayments);
router.get("/:paymentId", authenticateToken, getPayment);

export default router;
