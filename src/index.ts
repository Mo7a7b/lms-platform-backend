import express, { type Request, type Response } from "express";
const app = express();
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import authRouter from "./routers/auth.router.ts";
import cookieParser from "cookie-parser";
import "./services/cron.ts";

dotenv.config();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);
app.use(helmet());
app.use("/auth", authRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, World!");
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
