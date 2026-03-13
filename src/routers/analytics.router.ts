import { Router } from "express";
import { getInstructorAnalytics } from "../controllers/analytics.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

const router = Router();

router.get("/instructor", authMiddleware, getInstructorAnalytics);

export default router;
