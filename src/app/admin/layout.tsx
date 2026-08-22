
"use client";

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({
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
      } else if (role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, role, router]);

  const showLoadingOverlay = loading || !user || role !== 'admin';

  if (showLoadingOverlay) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1 bg-muted/40 p-4 md:p-8">
          <div className="container mx-auto space-y-8 animate-in fade-in">
            <Skeleton className="h-10 w-64 mb-6" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-64 w-full mt-4" />
          </div>
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 bg-muted/40">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
