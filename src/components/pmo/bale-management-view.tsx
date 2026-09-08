"use client";

import { NotificationSystemSettings } from "./admin-view";

export function BaleManagementView() {
  return (
    <div className="h-[calc(100vh-6rem)] overflow-y-auto p-1">
      <NotificationSystemSettings />
    </div>
  );
}
