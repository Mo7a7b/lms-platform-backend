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

export async function createChapter(req: Request, res: Response) {
  const createChapterSchema = z.object({
    courseId: z.number().int().positive("Course ID must be a positive integer"),
    order: z.number().int().positive("Order Number must be positive"),
  });
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (user.role !== "Instructor") {
      return res
        .status(403)
        .json({ error: "Forbidden, Instructor role required" });
    }
    const course = await prisma.course.findUnique({
      where: { id: req.body.courseId, instructorId: user.id },
    });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    const result = createChapterSchema.parse(req.body);
    const { courseId, order } = result;
    const chapter = await prisma.chapter.create({
      data: {
        title: `Chapter ${order}`,
        courseId,
        order,
        isFreePreview: course.price === 0 ? true : false,
      },
    });
    return res
      .status(201)
      .json({ message: "Chapter created successfully", chapter });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateChapter(req: Request, res: Response) {
  const updateChapterSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters long"),
    isFreePreview: z.boolean(),
  });
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (user.role !== "Instructor") {
      return res
        .status(403)
        .json({ error: "Forbidden, Instructor role required" });
    }
    const course = await prisma.course.findUnique({
      where: { id: req.body.courseId, instructorId: user.id },
    });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    const result = updateChapterSchema.parse(req.body);
    const id = Number(req.params.id);
    const { title, isFreePreview } = result;
    const chapter = await prisma.chapter.update({
      where: {
        id,
      },
      data: {
        title,
        isFreePreview,
      },
    });
    return res
      .status(200)
      .json({ message: "Chapter updated successfully", chapter });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteChapter(req: Request, res: Response) {
  const deleteChapterSchema = z.object({
    id: z.number().int().positive("Chapter ID must be a positive integer"),
  });
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (user.role !== "Instructor") {
      return res
        .status(403)
        .json({ error: "Forbidden, Instructor role required" });
    }
    const course = await prisma.course.findUnique({
      where: { id: req.body.courseId, instructorId: user.id },
    });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    const result = deleteChapterSchema.parse(req.body);
    const { id } = result;
    const chapter = await prisma.chapter.delete({
      where: {
        id,
      },
    });
    return res
      .status(200)
      .json({ message: "Chapter deleted successfully", chapter });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getChapter(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (user.role !== "Instructor") {
      return res
        .status(403)
        .json({ error: "Forbidden, Instructor role required" });
    }
    const { id } = req.params;
    const chapter = await prisma.chapter.findUnique({
      where: {
        id: parseInt(id as string),
      },
      include: {
        videos: true,
      },
    });
    return res
      .status(200)
      .json({ message: "Chapter fetched successfully", chapter });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function reorderVideos(req: Request, res: Response) {
  try {
    const { videos, chapterId } = req.body;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (user.role !== "Instructor") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId },
    });

    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    await prisma.$transaction(
      videos.map((videoId: number, index: number) =>
        prisma.video.update({
          where: { id: videoId, chapterId: chapterId },
          data: { order: index + 1 },
        }),
      ),
    );

    const updatedVideos = await prisma.video.findMany({
      where: { chapterId },
      orderBy: { order: "asc" },
      include: {
        chapter: true,
      },
    });

    return res.status(200).json({
      message: "Videos reordered successfully",
      videos: updatedVideos,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
