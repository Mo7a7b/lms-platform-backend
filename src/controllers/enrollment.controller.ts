import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();
const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function getStudentEnrollments(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user.id },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                profileImg: true,
              },
            },
            chapters: {
              include: {
                videos: {
                  include: {
                    chapter: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    res.status(200).json({
      message: "Student enrollments retrieved successfully",
      enrollments,
    });
  } catch (error) {
    console.error("Get Student Enrollments Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
