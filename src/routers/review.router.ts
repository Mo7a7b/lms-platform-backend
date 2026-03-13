import { Router } from "express";
import {
  createReview,
  deleteReview,
  getCourseReviews,
  getInstructorReviews,
  getReview,
  updateReview,
} from "../controllers/review.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

const router = Router();

router.post("/", authMiddleware, createReview);
router.delete("/:reviewId", authMiddleware, deleteReview);
router.put("/", authMiddleware, updateReview);
router.get("/course/:courseId", getCourseReviews);
router.get("/instructor", authMiddleware, getInstructorReviews);

export default router;
