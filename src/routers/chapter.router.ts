import { Router } from "express";
const chapterRouter = Router();

import {
  createChapter,
  updateChapter,
  deleteChapter,
  getChapter,
  reorderVideos,
} from "../controllers/chapter.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

chapterRouter.post("/", authMiddleware, createChapter);
chapterRouter.delete("/", authMiddleware, deleteChapter);
chapterRouter.put("/reorderVideos", authMiddleware, reorderVideos);
chapterRouter.put("/:id", authMiddleware, updateChapter);
chapterRouter.get("/:id", authMiddleware, getChapter);

export default chapterRouter;
