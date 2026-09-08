import { db } from "../src/lib/db";
import {
  hashPassword,
  isPasswordHash,
} from "../src/features/auth/server/password";

async function main() {
  const members = await db.member.findMany({
    select: { id: true, password: true },
  });
  let upgraded = 0;

  for (const member of members) {
    if (isPasswordHash(member.password)) continue;
    await db.member.update({
      where: { id: member.id },
      data: {
        password: await hashPassword(member.password),
        mustChangePassword: true,
      },
    });
    upgraded += 1;
  }

  console.log(`Password hash backfill completed: ${upgraded} upgraded`);
}

main()
  .catch((error) => {
    console.error("Password hash backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
