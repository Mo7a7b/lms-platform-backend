import { Router } from "express";
import {
  deleteAccount,
  getInstructorById,
  getInstructors,
  getUserData,
  signIn,
  signOut,
  signUp,
  updatePassword,
  updateProfilePicture,
  verifyEmail,
} from "../controllers/auth.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { upload } from "../config/multer.ts";
const authRouter = Router();
authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);
authRouter.get("/verify-email", verifyEmail);
authRouter.get("/user-data", authMiddleware, getUserData);
authRouter.get("/instructors", getInstructors);
authRouter.get("/instructors/:id", getInstructorById);
authRouter.post("/signout", signOut);
authRouter.put("/update-password", authMiddleware, updatePassword);
authRouter.delete("/delete-account", authMiddleware, deleteAccount);
authRouter.put(
  "/update-profile",
  authMiddleware,
  upload.single("picture"),
  updateProfilePicture,
);
export default authRouter;
