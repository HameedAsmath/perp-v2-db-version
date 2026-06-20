import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({
  adapter,
});

export * from "./utils/orders";
export * from "./utils/fills";
export * from "./utils/markets";
export * from "./utils/insurance";
export * from "./utils/liquidations";
export * from "./utils/adl";
export * from "./utils/klines";
