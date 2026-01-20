import { Router } from "express";
import { signIn, signUp, verifyEmail } from "../controllers/auth.controller.ts";
const authRouter = Router();
authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);
authRouter.get("/verify-email", verifyEmail);
export default authRouter;
