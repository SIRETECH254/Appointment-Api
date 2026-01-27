import express from "express";
import {
  createAppointment,
  confirmAppointment,
  rescheduleAppointment,
  cancelAppointment,
  checkIn,
  completeAppointment,
  markNoShow,
  getAppointments,
  getMyAppointments,
  getAppointmentById,
  deleteAppointment
} from "../controllers/appointmentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.post("/", authenticateToken, authorizeRoles(["customer", "admin"]), createAppointment);
router.post("/:appointmentId/confirm", authenticateToken, authorizeRoles(["admin", "staff"]), confirmAppointment);
router.patch("/:appointmentId/reschedule", authenticateToken, authorizeRoles(["admin", "staff"]), rescheduleAppointment);
router.patch("/:appointmentId/cancel", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), cancelAppointment);
router.patch("/:appointmentId/check-in", authenticateToken, authorizeRoles(["staff", "admin"]), checkIn);
router.patch("/:appointmentId/complete", authenticateToken, authorizeRoles(["staff", "admin"]), completeAppointment);
router.patch("/:appointmentId/no-show", authenticateToken, authorizeRoles(["staff", "admin"]), markNoShow);
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getAppointments);
router.get("/my", authenticateToken, authorizeRoles(["customer"]), getMyAppointments);
router.get("/:appointmentId", authenticateToken, getAppointmentById);
router.delete("/:appointmentId", authenticateToken, authorizeRoles(["admin", "staff"]), deleteAppointment);

export default router;
