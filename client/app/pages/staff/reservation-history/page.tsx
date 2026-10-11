"use client";

import { PermissionGate } from "@/components/ui/permissionGate";
import { ReservationHistoryView } from "@/components/ui/reservationHistoryView";

export default function Page() {
  return (
    <PermissionGate permission="reservation history">
      <div className="w-full min-h-screen p-6 sm:p-8">
        <ReservationHistoryView />
      </div>
    </PermissionGate>
  );
}
