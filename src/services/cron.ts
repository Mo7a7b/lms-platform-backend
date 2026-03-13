import cron from "node-cron";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();
const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
// Schedule a task to cleanup unverified user accounts if they remain unverified for more than 2 days
cron.schedule(
  "0 0 * * *", // run every day at midnight
  async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    try {
      const result = await prisma.user.deleteMany({
        where: {
          emailVerified: false,
          createdAt: {
            lt: twoDaysAgo,
          },
        },
      });
      console.log(`Deleted ${result.count} unverified user accounts.`);
    } catch (error) {
      console.error("Error deleting unverified user accounts:", error);
    }
  },
  {
    timezone: "Africa/Cairo",
  },
);

export default cron;
