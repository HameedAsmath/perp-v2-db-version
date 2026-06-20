import { prisma } from "../db";

async function main() {
  await prisma.market.upsert({
    where: { slug: "BTC-PERP" },
    update: {},
    create: {
      slug: "BTC-PERP",
      baseCurrency: "BTC",
      quoteCurrency: "USDT",
      tickSize: 1,
      minOrderSize: 1,
      maxOrderSize: 1_000_000,
      maxLeverage: 100,
      makerFeeRate: 0,
      takerFeeRate: 0,
      maintenanceMarginRate: 50, // 0.5%
      initialMarginRate: 100, // 1%
    },
  });
}
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
