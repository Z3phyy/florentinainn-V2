"use client";

import { PermissionGate } from "@/components/ui/permissionGate";
import { HousekeepingBoard } from "@/components/ui/housekeepingBoard";

export default function Page() {
  return (
    <PermissionGate permission="housekeeping">
      <div className="w-full min-h-screen p-6 sm:p-8">
        <HousekeepingBoard />
      </div>
    </PermissionGate>
  );
}
