import { PrismaClient } from "../generated/prisma/client";
import { BrewStyle } from "../generated/prisma/enums";

const db = new PrismaClient();

async function main() {
  const [alex, bri, cass] = await Promise.all(
    ["Alex", "Bri", "Cass"].map((name) =>
      db.user.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

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

  await db.favoriteSetting.createMany({
    data: [
      { userId: alex.id, label: "Morning Latte", grindAmountGrams: 20, milkFrothed: true, brewStyle: BrewStyle.SPECIALTY },
      { userId: bri.id, label: "Quick Classic", grindAmountGrams: 16, milkFrothed: false, brewStyle: BrewStyle.CLASSIC },
      { userId: cass.id, label: "Iced Afternoon", grindAmountGrams: 22, milkFrothed: false, brewStyle: BrewStyle.OVER_ICE },
    ],
  });

  await db.brew.createMany({
    data: [
      { userId: alex.id, beanId: yirgacheffe.id, grindAmountGrams: 20, milkFrothed: true, brewStyle: BrewStyle.SPECIALTY, label: "Morning Latte" },
      { userId: bri.id, beanId: houseBlend.id, grindAmountGrams: 16, milkFrothed: false, brewStyle: BrewStyle.CLASSIC },
      { userId: cass.id, beanId: yirgacheffe.id, grindAmountGrams: 22, milkFrothed: false, brewStyle: BrewStyle.OVER_ICE, label: "Iced Afternoon" },
      { userId: alex.id, beanId: houseBlend.id, grindAmountGrams: 18, milkFrothed: false, brewStyle: BrewStyle.RICH },
    ],
  });

  console.log("Seeded users, beans, favorites, and brews.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
