import type { Request, Response } from "express";
import { PrismaClient, VideoProvider } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function createVideoRecord(req: Request, res: Response) {
  try {
    const { title, description, duration, chapterId, url, provider } =
      req.body as {
        title: string;
        description: string;
        duration: number;
        chapterId: number;
        url: string;
        provider: VideoProvider;
      };
    const user = (req as any).user;
    if (user.role !== "Instructor") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        course: true,
        videos: true,
      },
    });
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }
    if (chapter.course.instructorId !== user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!url || !provider) {
      return res.status(400).json({ message: "Invalid video payload" });
    }

    const video = await prisma.video.create({
      data: {
        title,
        description,
        chapterId,
        order: chapter.videos.length + 1,
        url,
        provider,
        duration,
      },
      include: {
        chapter: true,
      },
    });

    await prisma.course.update({
      where: { id: chapter.courseId },
      data: {
        totalDuration: (chapter.course.totalDuration as number) + duration,
        totalVideos: (chapter.course.totalVideos as number) + 1,
      },
    });

    res.status(201).json({ success: true, video });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteVideoRecord(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (user.role !== "Instructor") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id: Number(id) },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    if (video.chapter.course.instructorId !== user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await prisma.video.delete({
      where: { id: Number(id) },
    });
    await prisma.course.update({
      where: { id: video?.chapter.courseId },
      data: {
        totalDuration:
          (video?.chapter.course.totalDuration as number) -
          (video?.duration as number),
        totalVideos: (video?.chapter.course.totalVideos as number) - 1,
      },
    });
    res.status(200).json({ message: "Video deleted Successfuly", video });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateVideo(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (user.role !== "Instructor") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const { id } = req.params;
    const { title, description, url, duration } = req.body as {
      title: string;
      description: string;
      url?: string;
      duration?: number;
    };
    const video = await prisma.video.findUnique({
      where: { id: Number(id) },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    if (video.chapter.course.instructorId !== user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const newVideo = await prisma.video.update({
      where: { id: Number(id) },
      data: {
        title,
        description,
        url: url || video.url,
        duration: duration || video.duration,
      },
    });
    if (duration !== video.duration) {
      await prisma.course.update({
        where: { id: video.chapter.courseId },
        data: {
          totalDuration:
            (video?.chapter.course.totalDuration as number) -
            (video?.duration as number) +
            (duration as number),
        },
      });
    }
    res
      .status(200)
      .json({ message: "Video updated Successfuly", video: newVideo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getVideoById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id: Number(id) },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    res.status(200).json({ message: "Video retrieved Successfuly", video });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}
