
"use client";

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  const showLoadingOverlay = loading || !user;

  return (
    <div className="flex min-h-screen flex-col">
      <LoadingOverlay isLoading={showLoadingOverlay} message="Loading your experience..." />
      <AppHeader />
      <main className="flex-1">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
