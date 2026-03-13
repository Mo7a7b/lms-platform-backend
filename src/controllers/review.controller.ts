import type { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function createReview(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { courseId, rating, comment } = req.body;
    const review = await prisma.review.create({
      data: {
        courseId: Number(courseId),
        rating,
        comment,
        userId: user.id,
      },
    });
    res.status(201).json({
      message: "Review created successfully",
      review,
    });
  } catch (error) {
    console.error("Create Review Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function getReview(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { courseId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [review, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: {
          courseId: Number(courseId),
        },
        skip,
        take: limit,
      }),
      prisma.review.count({
        where: {
          courseId: Number(courseId),
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      message: "Review fetched successfully",
      review,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get Review Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function deleteReview(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { reviewId } = req.params;
    const review = await prisma.review.delete({
      where: {
        id: Number(reviewId),
      },
    });
    res.status(200).json({
      message: "Review deleted successfully",
      review,
    });
  } catch (error) {
    console.error("Delete Review Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function updateReview(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { reviewId, rating, comment } = req.body;
    const review = await prisma.review.update({
      where: {
        id: Number(reviewId),
      },
      data: {
        rating,
        comment,
      },
    });
    res.status(200).json({
      message: "Review updated successfully",
      review,
    });
  } catch (error) {
    console.error("Update Review Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function getCourseReviews(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: {
          courseId: Number(courseId),
        },
        skip,
        take: limit,
        include: {
          user: true,
          course: true,
        },
      }),
      prisma.review.count({
        where: {
          courseId: Number(courseId),
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      message: "Review fetched successfully",
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get Review Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function getInstructorReviews(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (userData?.role !== "Instructor") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: {
          course: {
            instructorId: Number(userData.id),
          },
        },
        skip,
        take: limit,
        include: {
          user: true,
          course: true,
        },
      }),
      prisma.review.count({
        where: {
          course: {
            instructorId: Number(userData.id),
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      message: "Review fetched successfully",
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get Review Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
