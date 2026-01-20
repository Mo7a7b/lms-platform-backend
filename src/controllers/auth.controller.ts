import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { UserRole } from "../generated/prisma/client.ts";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { sendEmail, verifyEmailTemplate } from "../services/resend.ts";
import crypto from "crypto";
dotenv.config();
const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function signUp(req: Request, res: Response): Promise<void> {
  const signUpSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
    name: z.string().min(2),
    role: z
      .enum([UserRole.Admin, UserRole.Instructor, UserRole.Student])
      .default(UserRole.Student),
  });
  try {
    const userData = signUpSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = await bcrypt.hash(verificationToken, 10);
    const newUser = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: userData.role as UserRole,
        verificationToken: hashedVerificationToken,
        verificationTokenExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        lastVerificationSentAt: new Date(),
      },
    });
    await sendEmail(
      [newUser.email],
      "Verify your email",
      verifyEmailTemplate(verificationToken),
    );
    res
      .status(201)
      .json({ message: "We've sent a verification email to your inbox." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ error: validationError.message });
    } else if (error instanceof Error && (error as any).code === "P2002") {
      // Unique constraint violation (e.g., email already exists)
      res.status(409).json({ error: "Email already registered" });
    } else {
      console.error("SignUp Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const signInSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
  });
  try {
    const credentials = signInSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const passwordMatch = await bcrypt.compare(
      credentials.password,
      user.password,
    );
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    if (!user.emailVerified) {
      // check if we can resend verification email
      if (user.lastVerificationSentAt) {
        const timeSinceLastVerification =
          Date.now() - user.lastVerificationSentAt.getTime();
        if (timeSinceLastVerification < 15 * 60 * 1000) {
          // 15 minutes
          res.status(429).json({
            error:
              "We've already sent a verification email. Please check your inbox.",
          });
          return;
        }
      }
      const verificationToken = crypto.randomBytes(32).toString("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken: await bcrypt.hash(verificationToken, 10),
          verificationTokenExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
          lastVerificationSentAt: new Date(),
        },
      });
      await sendEmail(
        [user.email],
        "Verify your email",
        verifyEmailTemplate(verificationToken),
      );
      res
        .status(403)
        .json({ error: "We've sent a verification email to your inbox." });
      return;
    }
    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "User signed in successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ error: validationError.message });
    } else {
      console.error("SignIn Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { verificationToken } = req.query;
  if (!verificationToken) {
    res.status(400).json({ error: "Verification token is required" });
    return;
  }
  try {
    const users = await prisma.user.findMany({
      where: {
        verificationTokenExpiry: {
          gt: new Date(),
        },
      },
    });
    let user = null;

    for (const u of users) {
      const isMatch = await bcrypt.compare(
        verificationToken as string,
        u.verificationToken as string,
      );
      if (isMatch) {
        user = u;
        break;
      }
    }

    if (!user) {
      res.status(400).json({ error: "Invalid or expired verification token" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        lastVerificationSentAt: null,
      },
    });
    // Generate new JWT token after verification
    const newToken = jwt.sign(
      { email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect(process.env.FRONTEND_LINK as string);
  } catch (error) {
    console.error("Email Verification Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
