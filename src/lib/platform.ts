export type SolutionKey = "taskplatform" | "insight" | "workflows";

export type SolutionCard = {
  key: SolutionKey;
  name: string;
  slogan: string;
  description: string;
  accent: string;
  href: string;
};

export const SOLUTIONS: SolutionCard[] = [
  {
    key: "taskplatform",
    name: "TaskPlatform",
    slogan: "Task operations for internal teams",
    description:
      "Planning, task assignment, approvals, calendars, and messaging for operations-focused companies.",
    accent: "from-cyan-500 to-blue-600",
    href: "/solutions/taskplatform",
  },
  {
    key: "insight",
    name: "Insight",
    slogan: "Reporting and analytics",
    description:
      "Dashboards, curated KPIs, and source-backed reporting for leaders and analysts.",
    accent: "from-emerald-500 to-teal-600",
    href: "/solutions",
  },
  {
    key: "workflows",
    name: "Workflows",
    slogan: "Cross-team automation",
    description:
      "Reusable workflow templates, approvals, and operational orchestration across business units.",
    accent: "from-amber-500 to-orange-600",
    href: "/solutions",
  },
];

export function slugifyCompanyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
