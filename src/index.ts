import express, { type Request, type Response } from "express";
const app = express();
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import authRouter from "./routers/auth.router.ts";
import courseRouter from "./routers/course.router.ts";
import chapterRouter from "./routers/chapter.router.ts";
import cookieParser from "cookie-parser";
import "./services/cron.ts";
import videoRouter from "./routers/video.router.ts";
import analyticsRouter from "./routers/analytics.router.ts";
import stripeRouter from "./routers/stripe.router.ts";
import { stripeWebhook } from "./controllers/stripe.controller.ts";
import reviewRouter from "./routers/review.router.ts";
import enrollmentRouter from "./routers/enrollment.router.ts";

dotenv.config();

// Stripe webhook must be registered BEFORE express.json() — it needs the raw body
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:8000"],
    credentials: true,
  }),
);
app.use(helmet());
app.use("/auth", authRouter);
app.use("/course", courseRouter);
app.use("/chapter", chapterRouter);
app.use("/enrollment", enrollmentRouter);
app.use("/video", videoRouter);
app.use("/analytics", analyticsRouter);
app.use("/stripe", stripeRouter);
app.use("/review", reviewRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, World!");
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
