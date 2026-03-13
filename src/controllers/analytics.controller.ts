import type { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();
const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function getInstructorAnalytics(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (user.role !== "Instructor") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const totalCourses = await prisma.course.count({
      where: { instructorId: user.id },
    });

    const instructorCourses = await prisma.course.findMany({
      where: { instructorId: user.id, status: "Published" },
      include: { enrollments: true },
    });

    const revenue = instructorCourses.reduce((acc, course) => {
      return acc + course.price * course?.enrollments?.length;
    }, 0);
    const totalRevenueAfterLmsCut = revenue - revenue * 0.15;

    const publishedCourses = await prisma.course.findMany({
      where: { instructorId: user.id, status: "Published" },
      include: { enrollments: true },
    });

    const totalStudents = instructorCourses.reduce((acc, course) => {
      return acc + course?.enrollments?.length;
    }, 0);

    const avgRating = await prisma.review.aggregate({
      where: { courseId: { in: instructorCourses.map((course) => course.id) } },
      _avg: { rating: true },
    });

    const studentsPerCourse = instructorCourses.map((course) => {
      return {
        course: course.title,
        students: course.enrollments.length,
      };
    });

    const analytics = {
      totalCourses,
      totalRevenue: totalRevenueAfterLmsCut,
      publishedCourses,
      totalStudents,
      avgRating: avgRating._avg.rating,
      studentsPerCourse,
    };
    res.status(200).json({
      message: "Instructor's Analytics retrieved successfully",
      analytics,
    });
  } catch (error) {
    console.error("GetInstructorAnalytics Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
