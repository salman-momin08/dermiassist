
"use client";

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (role !== 'doctor') {
        // If a logged-in user is not a doctor, redirect them
        router.push('/dashboard');
      }
    }
  }, [user, loading, role, router]);

  const showLoadingOverlay = loading || !user || role !== 'doctor';

  return (
    <div className="flex min-h-screen flex-col">
      <LoadingOverlay isLoading={showLoadingOverlay} message="Verifying access..." />
      <AppHeader />
      <main className="flex-1 bg-muted/40">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
