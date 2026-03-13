import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { PrismaClient, CourseCategory } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import cloudinary from "../config/cloudinary.ts";
dotenv.config();
const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function createCourse(req: Request, res: Response) {
  const zCourseSchema = z.object({
    title: z.string().min(5).max(100),
    description: z.string().min(5).max(1000),
    whatYouWillLearn: z.array(z.string().min(10).max(100)).min(1),
    requirements: z.array(z.string().min(10).max(100)).min(1),
    poster: z.string().url(),
    category: z.enum([
      "Programming",
      "Design",
      "Business",
      "Marketing",
      "Health",
      "Productivity",
      "Languages",
      "Mathematics",
      "Science",
      "Engineering",
      "Electronics",
      "Cooking",
      "Music",
      "Writing",
      "History",
      "Law",
    ]),
    price: z.number().min(0),
  });

  const {
    title,
    description,
    poster,
    category,
    price,
    requirements,
    whatYouWillLearn,
  } = zCourseSchema.parse(req.body);
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.role !== "Instructor") {
    return res
      .status(403)
      .json({ error: "Forbidden, Instructor role required" });
  }

  try {
    const course = await prisma.course.create({
      data: {
        title,
        description,
        poster: { url: poster, publicId: "external_url" },
        category,
        price,
        requirements,
        whatYouWillLearn,
        status: "Draft",
        instructorId: user?.id,
      },
    });

    res.status(201).json({ message: "Course created successfully", course });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function updateCourse(req: Request, res: Response) {
  const zCourseSchema = z.object({
    title: z.string().min(5).max(100).optional(),
    description: z.string().min(5).max(1000).optional(),
    poster: z.string().url().optional(),
    category: z
      .enum([
        "Programming",
        "Design",
        "Business",
        "Marketing",
        "Health",
        "Productivity",
        "Languages",
        "Mathematics",
        "Science",
        "Engineering",
        "Electronics",
        "Cooking",
        "Music",
        "Writing",
        "History",
        "Law",
      ])
      .optional(),
    requirements: z.array(z.string().min(10).max(100)).min(1).optional(),
    whatYouWillLearn: z.array(z.string().min(10).max(100)).min(1).optional(),
    price: z.number().min(0).optional(),
  });

  const {
    title,
    description,
    poster,
    category,
    price,
    requirements,
    whatYouWillLearn,
  } = zCourseSchema.parse(req.body);
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.role !== "Instructor") {
    return res
      .status(403)
      .json({ error: "Forbidden, Instructor role required" });
  }

  try {
    const courseId = parseInt(req.params.id as string);
    const course = await prisma.course.update({
      where: { id: courseId, instructorId: user.id },
      data: {
        title,
        description,
        poster: { url: poster, publicId: "external_url" },
        category,
        price,
        requirements,
        whatYouWillLearn,
      },
    });

    res.status(200).json({ message: "Course updated successfully", course });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function deleteCourse(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.role !== "Instructor") {
    return res
      .status(403)
      .json({ error: "Forbidden, Instructor role required" });
  }

  try {
    const courseId = parseInt(req.params.id as string);
    const course = await prisma.course.findUnique({
      where: { id: courseId, instructorId: user.id },
      include: { enrollments: true },
    });

    if (!course) {
      return res.status(404).json({
        error: "Course not found",
      });
    }

    if (
      course.status === "Draft" ||
      ((course.status === "Published" || course.status === "Archived") &&
        course?.enrollments?.length === 0) ||
      ((course.status === "Published" || course.status === "Archived") &&
        course.price === 0)
    ) {
      await prisma.course.delete({
        where: { id: courseId, instructorId: user.id },
      });
    } else {
      res.status(400).json({
        error: "Course cannot be deleted",
      });
    }

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function changeCourseStatus(req: Request, res: Response) {
  const zSchema = z.object({
    status: z.enum(["Published", "Archived"]),
  });
  const { status } = zSchema.parse(req.body);

  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.role !== "Instructor") {
    return res
      .status(403)
      .json({ error: "Forbidden, Instructor role required" });
  }

  try {
    const courseId = parseInt(req.params.id as string);
    const course = await prisma.course.findUnique({
      where: { id: courseId, instructorId: user.id },
      include: { chapters: { include: { videos: true } } },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    // Ensure the course has at least one chapter and all chapters contain videos before publishing.
    if (status === "Published") {
      if (!course.chapters || course.chapters.length === 0) {
        return res.status(400).json({
          error: "Course must have at least one chapter to be published",
        });
      }
      for (const chapter of course.chapters) {
        if (!chapter?.videos || chapter?.videos?.length === 0) {
          return res.status(400).json({
            error:
              "All chapters must contain at least one video to be published",
          });
        }
      }
    }
    const updatedCourse = await prisma.course.update({
      where: { id: courseId, instructorId: user.id },
      data: {
        status,
      },
    });

    res.status(200).json({
      message: "Course status changed successfully",
      course: updatedCourse,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function getAllCourses(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [courses, total] = await prisma.$transaction([
      prisma.course.findMany({
        where: {
          status: "Published",
        },
        include: {
          instructor: true,
          chapters: {
            include: { videos: true },
          },
          enrollments: true,
          reviews: true,
        },
        skip,
        take: limit,
      }),
      prisma.course.count({
        where: {
          status: "Published",
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      message: "Courses retrieved successfully",
      courses,
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

export async function getCourseById(req: Request, res: Response) {
  try {
    const courseId = parseInt(req.params.id as string);
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructor: true,
        chapters: {
          include: { videos: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
        reviews: true,
        enrollments: true,
      },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.status(200).json({ message: "Course retrieved successfully", course });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error from getCourseById" });
  }
}

export async function getInstructorCourses(req: Request, res: Response) {
  try {
    const userId = parseInt((req as any).user.id);
    const courses = await prisma.course.findMany({
      where: { instructorId: userId },
      include: {
        chapters: { include: { videos: true } },
        reviews: true,
        enrollments: true,
      },
    });

    res
      .status(200)
      .json({ message: "Courses retrieved successfully", courses });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error from getInstructorCourses" });
  }
}

export async function getInstructorReviews(req: Request, res: Response) {
  const user = (req as any).user;
  if (user.role !== "INSTRUCTOR") {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const reviews = await prisma.review.findMany({
      where: { course: { instructorId: user.id } },
    });

    res
      .status(200)
      .json({ message: "Reviews retrieved successfully", reviews });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function reorderChapters(req: Request, res: Response) {
  try {
    const { chapters, courseId } = req.body;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (user.role !== "Instructor") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, instructorId: user.id },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    await prisma.$transaction(
      chapters.map((chapterId: number, index: number) =>
        prisma.chapter.update({
          where: { id: chapterId },
          data: { order: index + 1 },
        }),
      ),
    );

    const updatedChapters = await prisma.chapter.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      include: {
        videos: true,
      },
    });

    return res.status(200).json({
      message: "Chapters reordered successfully",
      chapters: updatedChapters,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
