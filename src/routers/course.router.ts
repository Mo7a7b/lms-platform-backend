import { Router } from "express";
const courseRouter = Router();

import {
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseById,
  changeCourseStatus,
  getAllCourses,
  getInstructorCourses,
  getInstructorReviews,
  reorderChapters,
} from "../controllers/course.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

courseRouter.post("/", authMiddleware, createCourse);

courseRouter.get("/", getAllCourses);
courseRouter.get("/instructor", authMiddleware, getInstructorCourses);
courseRouter.get(
  "/instructor/:id/reviews",
  authMiddleware,
  getInstructorReviews,
);
courseRouter.put("/reorderChapters", authMiddleware, reorderChapters);
courseRouter.get("/:id", getCourseById);
courseRouter.put("/:id", authMiddleware, updateCourse);
courseRouter.delete("/:id", authMiddleware, deleteCourse);
courseRouter.put("/:id/status", authMiddleware, changeCourseStatus);

export default courseRouter;
