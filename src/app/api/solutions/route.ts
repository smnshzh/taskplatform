import { NextResponse } from "next/server";
import { SOLUTIONS } from "@/lib/platform";

export async function GET() {
  return NextResponse.json({
    solutions: SOLUTIONS.map((solution) => ({
      key: solution.key,
      name: solution.name,
      slogan: solution.slogan,
      description: solution.description,
      href: solution.href,
    })),
  });
}
