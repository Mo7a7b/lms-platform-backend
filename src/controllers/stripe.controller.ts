import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import stripe from "../config/stripe.ts";
import dotenv from "dotenv";
dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ──────────────────────────────────────────────
//  Stripe Connect — Onboarding
// ──────────────────────────────────────────────

export async function connectStripeAccount(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (userData.role !== "Instructor") {
      res
        .status(403)
        .json({ error: "Only instructors can connect a Stripe account" });
      return;
    }

    // If already has a Stripe account, generate a new onboarding link
    let stripeAccountId = userData.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: userData.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;

      await prisma.user.update({
        where: { id: userData.id },
        data: { stripeAccountId },
      });
    } else {
      // Ensure capabilities are requested even if account exists
      await stripe.accounts.update(stripeAccountId, {
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${process.env.FRONTEND_LINK}/dashboard/settings/stripe/refresh`,
      return_url: `${process.env.FRONTEND_LINK}/dashboard/settings/stripe/return`,
      type: "account_onboarding",
    });

    res.status(200).json({
      message: "Stripe onboarding link created",
      url: accountLink.url,
    });
  } catch (error) {
    console.error("Connect Stripe Account Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ──────────────────────────────────────────────
//  Stripe Connect — Callback (after onboarding)
// ──────────────────────────────────────────────

export async function stripeConnectCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData || !userData.stripeAccountId) {
      res.status(400).json({ error: "No Stripe account found for this user" });
      return;
    }

    const account = await stripe.accounts.retrieve(userData.stripeAccountId);

    const isConnected = account.charges_enabled && account.details_submitted;

    if (isConnected && !userData.isStripeConnected) {
      await prisma.user.update({
        where: { id: userData.id },
        data: { isStripeConnected: true },
      });
    }

    res.status(200).json({
      message: isConnected
        ? "Stripe account is fully connected"
        : "Stripe onboarding is not yet complete",
      isStripeConnected: isConnected,
      stripeAccountId: userData.stripeAccountId,
    });
  } catch (error) {
    console.error("Stripe Connect Callback Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ──────────────────────────────────────────────
//  Stripe Connect — Status check
// ──────────────────────────────────────────────

export async function getStripeConnectStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        stripeAccountId: true,
        isStripeConnected: true,
      },
    });

    if (!userData) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // If account exists but not yet marked connected, live-check with Stripe
    if (userData.stripeAccountId && !userData.isStripeConnected) {
      const account = await stripe.accounts.retrieve(userData.stripeAccountId);
      const isConnected = account.charges_enabled && account.details_submitted;

      if (isConnected) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isStripeConnected: true },
        });

        res.status(200).json({
          isStripeConnected: true,
          stripeAccountId: userData.stripeAccountId,
        });
        return;
      }
    }

    res.status(200).json({
      message: "Stripe Connected Status retrieved successfully",
      isStripeConnected: userData.isStripeConnected,
      stripeAccountId: userData.stripeAccountId,
    });
  } catch (error) {
    console.error("Get Stripe Connect Status Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ──────────────────────────────────────────────
//  Checkout — Create Session (15% platform fee)
// ──────────────────────────────────────────────

const PLATFORM_FEE_PERCENT = 0.15;

export async function createCheckoutSession(
  req: Request,
  res: Response,
): Promise<void> {
  const checkoutSchema = z.object({
    courseId: z.number().int().positive(),
  });

  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { courseId } = checkoutSchema.parse(req.body);

    // Fetch the course with instructor info
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { instructor: true },
    });

    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    if (course.status !== "Published") {
      res.status(400).json({ error: "Course is not available for purchase" });
      return;
    }

    if (course.instructorId === user.id) {
      res.status(400).json({ error: "You cannot purchase your own course" });
      return;
    }

    // Check if instructor has a connected Stripe account
    if (
      !course.instructor.stripeAccountId ||
      !course.instructor.isStripeConnected
    ) {
      res.status(400).json({
        error: "You have not set up payments yet. Please try again later.",
      });
      return;
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId: user.id, courseId },
    });

    if (existingEnrollment) {
      res
        .status(400)
        .json({ error: "You are already enrolled in this course" });
      return;
    }

    // Calculate amounts (Stripe expects cents)
    const priceInCents = Math.round(course.price * 100);
    const applicationFee = Math.round(priceInCents * PLATFORM_FEE_PERCENT);

    // Parse poster for image
    const poster = course.poster as { url?: string } | null;
    const images = poster?.url ? [poster.url] : [];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: course.title,
              description: course.description,
              images,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: course.instructor.stripeAccountId!,
        },
      },
      metadata: {
        userId: String(user.id),
        courseId: String(courseId),
      },
      success_url: `${process.env.FRONTEND_LINK}/courses/checkout/success`,
      cancel_url: `${process.env.FRONTEND_LINK}/courses/checkout/cancel`,
    });

    res.status(200).json({
      message: "Checkout session created",
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ error: validationError.message });
    } else if (
      error?.raw?.code === "insufficient_capabilities_for_transfer" ||
      error?.code === "insufficient_capabilities_for_transfer"
    ) {
      console.error("Transfer Capability Error:", error);
      res.status(400).json({
        error:
          "The instructor's account is not fully set up for payments. Please contact support or try again later.",
      });
    } else {
      console.error("Create Checkout Session Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

// Get Stripe Express Dashboard Link
export async function getDashboardLink(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeAccountId: true },
    });

    if (!userData || !userData.stripeAccountId) {
      res.status(404).json({ error: "Stripe account not found" });
      return;
    }

    const account = await stripe.accounts.createLoginLink(
      userData.stripeAccountId,
    );

    res.status(200).json({
      message: "Dashboard link retrieved successfully",
      url: account.url,
    });
  } catch (error) {
    console.error("Get Dashboard Link Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ──────────────────────────────────────────────
//  Webhook — Handle Stripe events
// ──────────────────────────────────────────────

export async function stripeWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body (Buffer)
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).json({ error: "Webhook signature verification failed" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = Number(session.metadata?.userId);
        const courseId = Number(session.metadata?.courseId);

        if (!userId || !courseId) {
          console.error("Missing metadata in checkout session:", session.id);
          break;
        }

        // Prevent duplicate enrollments
        const existingEnrollment = await prisma.enrollment.findFirst({
          where: { userId, courseId },
        });

        if (!existingEnrollment) {
          await prisma.enrollment.create({
            data: {
              userId,
              courseId,
              checkoutId: session.id,
            },
          });
          console.log(
            `Enrollment created: user ${userId} → course ${courseId}`,
          );
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object;
        const userId = Number(account.metadata?.userId);

        if (!userId) {
          console.error(
            "Missing metadata in account updated event:",
            account.id,
          );
          break;
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeAccountId: account.id,
            isStripeConnected: account.id ? true : false,
          },
        });
        console.log(`Account updated: user ${userId} → ${account.id}`);
        break;
      }
      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
