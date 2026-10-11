"use client";

import { StaffSidebar } from "@/components/ui/sideBarStaff";
import { StaffTopBar } from "@/components/ui/staffTopBar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RoleGate } from "@/components/ui/roleGate";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate
      allowedTypes={[]}
      icon="login"
      title="Staff Authentication Required"
      description="Please log in with your front-desk credentials to access operational tools."
      buttonText="Go to Staff Login"
    >
      <div className="flex min-h-screen bg-[#FAF5F5] dark:bg-[#130005] text-[#130005] dark:text-white">
        <SidebarProvider>
          <StaffSidebar />
          <main className="w-full flex-1 flex flex-col min-w-0">
            <StaffTopBar />
            <div className="flex-1 overflow-x-hidden">{children}</div>
          </main>
        </SidebarProvider>
      </div>
    </RoleGate>
  );
}