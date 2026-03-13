import { Router } from "express";
import {
  connectStripeAccount,
  stripeConnectCallback,
  getStripeConnectStatus,
  createCheckoutSession,
  getDashboardLink,
} from "../controllers/stripe.controller.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

const stripeRouter = Router();

// Stripe Connect
stripeRouter.post("/connect", authMiddleware, connectStripeAccount);
stripeRouter.get("/connect/callback", authMiddleware, stripeConnectCallback);
stripeRouter.get("/connect/status", authMiddleware, getStripeConnectStatus);

// Checkout
stripeRouter.post("/checkout", authMiddleware, createCheckoutSession);

// Get Dashboard Link
stripeRouter.get("/dashboard", authMiddleware, getDashboardLink);

// Note: webhook route is registered directly in index.ts (needs raw body)

export default stripeRouter;
