import { Router } from "express";
import {
  createVideoRecord,
  deleteVideoRecord,
  updateVideo,
  getVideoById,
} from "../controllers/video.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

const videoRouter = Router();

videoRouter.post("/", authMiddleware, createVideoRecord);
videoRouter.delete("/:id", authMiddleware, deleteVideoRecord);
videoRouter.put("/:id", authMiddleware, updateVideo);
videoRouter.get("/:id", authMiddleware, getVideoById);

export default videoRouter;
