import { Router } from "express";
import { getStudentEnrollments } from "../controllers/enrollment.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

const router = Router();

router.get("/", authMiddleware, getStudentEnrollments);

export default router;
