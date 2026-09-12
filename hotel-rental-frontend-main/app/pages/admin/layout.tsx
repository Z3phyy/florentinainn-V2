"use client";

import { AdminSidebar } from "@/components/ui/sidebarAdmin";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminTopBar } from "@/components/ui/adminTopBar";
import { RoleGate } from "@/components/ui/roleGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate
      allowedTypes={["admin", "super admin"]}
      icon="shield"
      title="Administrative Access Restricted"
      description="You must be logged in as an Administrator or Super Admin to access this executive portal."
      buttonText="Go to Admin Login"
    >
      <div className="flex min-h-screen bg-[#FAF5F5] dark:bg-[#130005] text-[#130005] dark:text-gray-100 font-sans antialiased">
        <SidebarProvider>
          <AdminSidebar />
          <main className="w-full flex-1 flex flex-col min-w-0">
            <AdminTopBar />
            <div className="flex-1 p-6 md:p-8">
              {children}
            </div>
          </main>
        </SidebarProvider>
      </div>
    </RoleGate>
  );
}