import express from "express";
import {
  initiatePayment,
  servicePayment,
  mpesaWebhook,
  paystackWebhook,
  getPayments,
  getPayment,
  checkPaymentStatus
} from "../controllers/paymentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.post("/initiate", authenticateToken, initiatePayment);
router.post("/service-payment", authenticateToken, servicePayment);
router.post("/webhooks/mpesa", mpesaWebhook);
router.post("/webhooks/paystack", paystackWebhook);
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getPayments);
router.get("/status/:checkoutRequestId", authenticateToken, checkPaymentStatus);
router.get("/:paymentId", authenticateToken, getPayment);

export default router;
