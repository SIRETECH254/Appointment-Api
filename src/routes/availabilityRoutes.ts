import express from "express";
import { getAvailableSlots, getDayAvailability } from "../controllers/availabilityController";

const router = express.Router();

// Public availability endpoints
router.get("/slots", getAvailableSlots);
router.get("/day", getDayAvailability);

export default router;
