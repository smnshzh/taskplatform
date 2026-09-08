export type WorkflowTaskStatus = { status: string };

/** A workflow is closed only after every connected task has been completed. */
export function isWorkflowClosed(tasks: readonly WorkflowTaskStatus[]) {
  return tasks.length > 0 && tasks.every((task) => task.status === "DONE");
}

export function getCurrentWorkflowLocation<T extends WorkflowTaskStatus>(
  levels: readonly (readonly string[])[],
  tasks: ReadonlyMap<string, T>,
) {
  const levelIndex = levels.findIndex((level) => level.some((id) => tasks.get(id)?.status !== "DONE"));
  const resolvedLevelIndex = levelIndex >= 0 ? levelIndex : Math.max(0, levels.length - 1);
  const currentTasks = (levels[resolvedLevelIndex] ?? []).map((id) => tasks.get(id)).filter((task): task is T => Boolean(task));
  const task = currentTasks.find((item) => item.status === "STARTED")
    ?? currentTasks.find((item) => item.status === "BLOCKED")
    ?? currentTasks[0];
  return { levelIndex: resolvedLevelIndex, task };
}
