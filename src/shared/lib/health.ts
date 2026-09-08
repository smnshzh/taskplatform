export const HEALTH_STATUS = {
  ok: true,
  service: "taskmanager",
} as const;

export function createHealthResponse(timestamp = new Date()) {
  return {
    ...HEALTH_STATUS,
    timestamp: timestamp.toISOString(),
  };
}
