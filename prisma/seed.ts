import { PrismaClient } from "../generated/prisma/client";
import { BasketSize } from "../generated/prisma/enums";
import { hashPassword } from "../app/lib/auth.server";

const db = new PrismaClient();

async function main() {
  // Hash passwords
  const hashedPassword = await hashPassword("password");

  const [alex, bri, cass] = await Promise.all(
    ["Alex", "Bri", "Cass"].map((name) =>
      db.user.upsert({
        where: { name },
        update: {},
        create: { name, password: hashedPassword },
      }),
    ),
  );

  await db.appSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      paymentRecipient: "Coffee Kitty",
      paymentIban: "DE02120300000000202051",
      paymentBic: "BYLADEM1001",
      paymentReference: "Ninja Coffee",
    },
  });

  const yirgacheffe = await db.bean.create({
    data: {
      name: "Ethiopia Yirgacheffe",
      roaster: "Local Roastery",
      weightGrams: 250,
      priceCents: 1499,
    },
  });

  const houseBlend = await db.bean.create({
    data: {
      name: "House Blend",
      roaster: "Costco",
      weightGrams: 907,
      priceCents: 1199,
    },
  });

  const wholeMilk = await db.milkType.upsert({
    where: { name: "Whole milk" },
    update: { pricePerLiterCents: 120 },
    create: { name: "Whole milk", pricePerLiterCents: 120 },
  });

  const oatMilk = await db.milkType.upsert({
    where: { name: "Oat milk" },
    update: { pricePerLiterCents: 250 },
    create: { name: "Oat milk", pricePerLiterCents: 250 },
  });

  await db.favoriteSetting.createMany({
    data: [
      {
        userId: alex.id,
        label: "Morning Latte",
        basketSize: BasketSize.DOUBLE,
        milkTypeId: wholeMilk.id,
        milkVolumeMl: 150,
      },
      {
        userId: bri.id,
        label: "Quick Classic",
        basketSize: BasketSize.SINGLE,
      },
      {
        userId: cass.id,
        label: "Iced Afternoon",
        basketSize: BasketSize.LUXE,
      },
    ],
  });

  await db.brew.createMany({
    data: [
      {
        userId: alex.id,
        beanId: yirgacheffe.id,
        basketSize: BasketSize.DOUBLE,
        milkTypeId: wholeMilk.id,
        milkVolumeMl: 150,
        label: "Morning Latte",
      },
      {
        userId: bri.id,
        beanId: houseBlend.id,
        basketSize: BasketSize.SINGLE,
      },
      {
        userId: cass.id,
        beanId: yirgacheffe.id,
        basketSize: BasketSize.LUXE,
        label: "Iced Afternoon",
      },
      {
        userId: alex.id,
        beanId: houseBlend.id,
        basketSize: BasketSize.DOUBLE,
        milkTypeId: oatMilk.id,
        milkVolumeMl: 100,
      },
    ],
  });

  await db.payment.createMany({
    data: [
      {
        userId: alex.id,
        amountCents: 500,
        note: "Top-up",
      },
      {
        userId: bri.id,
        amountCents: 200,
        note: "Cash settled",
      },
    ],
  });

  console.log("Seeded users, beans, milk types, favorites, brews, settings, and payments.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
