
"use client"

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { UserNav } from './user-nav';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '../ui/skeleton';

export function AppHeader() {
  const { user, role, loading } = useAuth();

  const authenticated = !!user;

  const patientLinks = (
    <>
      <Link href="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">Dashboard</Link>
      <Link href="/my-analyses" className="transition-colors hover:text-foreground/80 text-foreground/60">My Analyses</Link>
      <Link href="/appointments" className="transition-colors hover:text-foreground/80 text-foreground/60">Appointments</Link>
      <Link href="/doctors" className="transition-colors hover:text-foreground/80 text-foreground/60">Find a Doctor</Link>
      <Link href="/chat" className="transition-colors hover:text-foreground/80 text-foreground/60">Chat</Link>
    </>
  );

  const doctorLinks = (
     <>
      <Link href="/doctor/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">Dashboard</Link>
      <Link href="/doctor/appointments" className="transition-colors hover:text-foreground/80 text-foreground/60">Appointments</Link>
      <Link href="/doctor/cases" className="transition-colors hover:text-foreground/80 text-foreground/60">Patient Cases</Link>
      <Link href="/doctor/chat" className="transition-colors hover:text-foreground/80 text-foreground/60">Chat</Link>
    </>
  );

  const adminLinks = (
     <>
      <Link href="/admin/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">Dashboard</Link>
    </>
  );
  
  const renderNavLinks = () => {
    switch(role) {
      case 'patient':
        return patientLinks;
      case 'doctor':
        return doctorLinks;
      case 'admin':
        return adminLinks;
      default:
        return null;
    }
  }

  const getHomeHref = () => {
    if (!authenticated) return "/";
    switch(role) {
      case 'doctor':
        return "/doctor/dashboard";
      case 'admin':
        return "/admin/dashboard";
      case 'patient':
      default:
        return "/dashboard";
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href={getHomeHref()} className="mr-6 flex items-center space-x-2">
            <Logo />
          </Link>
        </div>
        
        {authenticated && (
            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                {renderNavLinks()}
            </nav>
        )}

        <div className="flex flex-1 items-center justify-end space-x-4">
            <ThemeToggle />
            {loading ? (
                <Skeleton className="h-8 w-8 rounded-full" />
            ) : authenticated && user ? (
                <UserNav name={user.displayName || 'User'} email={user.email || ''} role={role} />
            ) : (
                <nav className="space-x-2">
                    <Button variant="ghost" asChild>
                        <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </nav>
            )}
        </div>
      </div>
    </header>
  );
}
