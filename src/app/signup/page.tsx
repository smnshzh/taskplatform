import { SignupForm } from "./signup-form";
import type { SolutionKey } from "@/lib/platform";

type SignupSearchParams = {
  solution?: string | string[];
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: SignupSearchParams | Promise<SignupSearchParams>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const solution = resolvedSearchParams?.solution;
  const initialSolutionKey =
    (Array.isArray(solution) ? solution[0] : solution) === "insight" ||
    (Array.isArray(solution) ? solution[0] : solution) === "workflows" ||
    (Array.isArray(solution) ? solution[0] : solution) === "taskplatform"
      ? ((Array.isArray(solution) ? solution[0] : solution) as SolutionKey)
      : "taskplatform";

  return <SignupForm initialSolutionKey={initialSolutionKey} />;
}
