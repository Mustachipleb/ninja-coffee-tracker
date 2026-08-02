import { PrismaClient } from "../generated/prisma/client";
import { BrewStyle, BasketSize } from "../generated/prisma/enums";

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

  const wholeMilk = await db.milkType.create({
    data: { name: "Whole milk", pricePerLiterCents: 120 },
  });

  const oatMilk = await db.milkType.create({
    data: { name: "Oat milk", pricePerLiterCents: 250 },
  });

  await db.favoriteSetting.createMany({
    data: [
      {
        userId: alex.id,
        label: "Morning Latte",
        basketSize: BasketSize.DOUBLE,
        milkTypeId: wholeMilk.id,
        milkVolumeMl: 150,
        brewStyle: BrewStyle.SPECIALTY,
      },
      {
        userId: bri.id,
        label: "Quick Classic",
        basketSize: BasketSize.SINGLE,
        brewStyle: BrewStyle.CLASSIC,
      },
      {
        userId: cass.id,
        label: "Iced Afternoon",
        basketSize: BasketSize.LUXE,
        brewStyle: BrewStyle.OVER_ICE,
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
        brewStyle: BrewStyle.SPECIALTY,
        label: "Morning Latte",
      },
      {
        userId: bri.id,
        beanId: houseBlend.id,
        basketSize: BasketSize.SINGLE,
        brewStyle: BrewStyle.CLASSIC,
      },
      {
        userId: cass.id,
        beanId: yirgacheffe.id,
        basketSize: BasketSize.LUXE,
        brewStyle: BrewStyle.OVER_ICE,
        label: "Iced Afternoon",
      },
      {
        userId: alex.id,
        beanId: houseBlend.id,
        basketSize: BasketSize.DOUBLE,
        milkTypeId: oatMilk.id,
        milkVolumeMl: 100,
        brewStyle: BrewStyle.RICH,
      },
    ],
  });

  console.log("Seeded users, beans, milk types, favorites, and brews.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
