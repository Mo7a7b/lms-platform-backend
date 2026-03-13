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
import cloudinary from "../config/cloudinary.ts";
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
      { id: user.id, email: user.email, role: user.role },
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

    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie("academos-logged-in", true, {
      httpOnly: false,
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

export async function getUserData(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res
        .status(401)
        .json({ error: "Unauthorized. Please sign in to continue." });
      return;
    }
    const userData = await prisma.user.findUnique({
      where: { email: user.email },
      include: {
        enrollments: true,
      },
      omit: {
        password: true,
        verificationToken: true,
        verificationTokenExpiry: true,
        lastVerificationSentAt: true,
      },
    });
    if (!userData) {
      res
        .status(404)
        .json({ error: "User not found. Please sign up to continue." });
      return;
    }
    res.status(200).json({
      user: userData,
      message: "User data fetched successfully",
    });
  } catch (error) {
    console.error("Get User Data Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    res.clearCookie("token");
    res.clearCookie("academos-logged-in");
    res.status(200).json({ message: "User signed out successfully" });
  } catch (error) {
    console.error("Sign Out Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function updatePassword(
  req: Request,
  res: Response,
): Promise<void> {
  const updatePasswordSchema = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
  });
  try {
    const user = (req as any).user;
    if (!user) {
      res
        .status(401)
        .json({ error: "Unauthorized. Please sign in to continue." });
      return;
    }

    const passwordData = updatePasswordSchema.parse(req.body);

    const userData = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!userData) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordMatch = await bcrypt.compare(
      passwordData.currentPassword,
      userData.password,
    );

    if (!passwordMatch) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(
      passwordData.newPassword,
      userData.password,
    );

    if (isSamePassword) {
      res.status(400).json({
        error: "New password must be different from current password",
      });
      return;
    }

    // Hash and update the new password
    const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 10);
    await prisma.user.update({
      where: { id: userData.id },
      data: { password: hashedNewPassword },
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ error: validationError.message });
    } else {
      console.error("Update Password Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

export async function deleteAccount(
  req: Request,
  res: Response,
): Promise<void> {
  const deleteAccountSchema = z.object({
    password: z.string().min(6),
  });
  try {
    const user = (req as any).user;
    if (!user) {
      res
        .status(401)
        .json({ error: "Unauthorized. Please sign in to continue." });
      return;
    }

    const { password } = deleteAccountSchema.parse(req.body);

    const userData = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!userData) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      res.status(401).json({ error: "Password is incorrect" });
      return;
    }

    // Delete the user account
    await prisma.user.delete({
      where: { id: userData.id },
    });

    // Clear authentication cookies
    res.clearCookie("token");
    res.clearCookie("academos-logged-in");

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ error: validationError.message });
    } else {
      console.error("Delete Account Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

export const updateProfilePicture = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file || !req.file.buffer)
      return res.status(400).json({ error: "No image uploaded" });

    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { profileImg: true },
    });

    // Delete old image from Cloudinary if exists
    if (existingUser?.profileImg?.publicId) {
      try {
        await cloudinary.uploader.destroy(existingUser.profileImg.publicId);
      } catch (err) {
        console.error("Failed to delete old profile image:", err);
      }
    }

    // Upload new image to Cloudinary
    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "profile-images",
          transformation: [{ width: 400, height: 400, crop: "fill" }],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      stream.end((req.file as { buffer: Buffer }).buffer);
    });

    const profileImg = {
      url: result.secure_url,
      publicId: result.public_id,
    };

    // Save new image info to DB
    await prisma.user.update({
      where: { email: user.email },
      data: { profileImg },
    });

    res.status(200).json({ message: "Profile picture updated", profileImg });
  } catch (err) {
    console.error("Update Profile Picture Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err });
  }
};

export async function getInstructors(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [instructors, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: { role: "Instructor" },
        select: {
          id: true,
          name: true,
          role: true,
          profileImg: true,
          courses: {
            include: {
              chapters: {
                include: {
                  videos: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: { role: "Instructor" } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      message: "Instructors retrieved successfully",
      instructors,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function getInstructorById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const instructor = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        name: true,
        role: true,
        profileImg: true,
        courses: {
          include: {
            chapters: {
              include: {
                videos: true,
              },
            },
          },
        },
      },
    });
    res
      .status(200)
      .json({ message: "Instructor retrieved successfully", instructor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
