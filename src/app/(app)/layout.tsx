
"use client";

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AppSidebar } from "@/components/layout/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Role-based redirect logic - only redirect once
  useEffect(() => {
    if (!loading && user && role && !hasRedirected.current) {
      const roleDashboards: Record<string, string> = {
        'patient': '/dashboard',
        'doctor': '/doctor/dashboard',
        'admin': '/admin/requests',
      };

      const expectedDashboard = roleDashboards[role];

      if (pathname === '/dashboard' && expectedDashboard !== '/dashboard') {
        hasRedirected.current = true;
        router.replace(expectedDashboard);
      }
    }
  }, [user, loading, role, pathname, router]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <div className="flex-1 flex">
        <AppSidebar />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
      <AppFooter />
    </div>
  );
}
