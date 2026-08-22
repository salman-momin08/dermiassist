"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserNav } from './user-nav';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '../ui/sheet';
import { LogOut, Menu } from 'lucide-react';
import React from 'react';
import NotificationInbox from '@/components/notifications/notification-bell';
import { cn } from '@/lib/utils';

export function AppHeader() {
  const { user, userData, role, loading, signOut } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const pathname = usePathname();

  const authenticated = !!user;

  // Strict role-ordered navigation links: Dashboard is ALWAYS first
  const getNavLinks = (userRole: typeof role) => {
    switch (userRole) {
      case 'doctor':
        return [
          { href: "/doctor/dashboard", label: "Dashboard" },
          { href: "/doctor/review-queue", label: "Triage Queue" },
          { href: "/doctor/appointments", label: "Appointments" },
          { href: "/doctor/cases", label: "Patient Cases" },
          { href: "/chat", label: "Patients" },
          { href: "/my-requests", label: "Requests" },
          { href: "/contact", label: "Contact" },
        ];
      case 'admin':
        return [
          { href: "/admin/dashboard", label: "Dashboard" },
          { href: "/admin/requests", label: "Requests" },
          { href: "/admin/ai-engineering", label: "AI Control Center" },
        ];
      case 'patient':
      default:
        return [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/my-analyses", label: "Analyses" },
          { href: "/appointments", label: "Appointments" },
          { href: "/doctors", label: "Doctors" },
          { href: "/chat", label: "Chat" },
          { href: "/my-requests", label: "Requests" },
          { href: "/contact", label: "Contact" },
        ];
    }
  };

  const filteredNavLinks = getNavLinks(role);

  const getHomeHref = () => {
    if (!authenticated) return "/";
    switch (role) {
      case 'doctor':
        return "/doctor/dashboard";
      case 'admin':
        return "/admin/dashboard";
      case 'patient':
      default:
        return "/dashboard";
    }
  };

  const displayName = userData?.displayName || user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-hidden">
      <div className="container relative flex h-16 items-center justify-between px-3 sm:px-6 md:px-8 max-w-full">

        {/* Left: Hamburger (mobile/tablet) + Logo */}
        <div className="flex items-center gap-2">
          <div className="lg:hidden">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col w-[280px] sm:w-72 p-0 max-w-[85vw]" aria-describedby={undefined}>
                <SheetHeader className="sr-only">
                  <SheetTitle>Main Navigation Menu</SheetTitle>
                </SheetHeader>

                {/* Sheet Header: Logo + Brand name */}
                <div className="flex items-center gap-2 px-4 py-4 border-b">
                  <Logo className="h-6 w-6 flex-shrink-0" showText={false} />
                  <span className="font-bold text-base font-headline">DermiAssist-AI</span>
                </div>

                {/* Nav Links */}
                <nav className="flex flex-col gap-1 px-3 py-3 flex-1 overflow-y-auto" aria-label="Mobile Navigation">
                  {authenticated ? (
                    filteredNavLinks.map(link => {
                      const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            "rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                          onClick={() => setIsSheetOpen(false)}
                        >
                          {link.label}
                        </Link>
                      );
                    })
                  ) : (
                    <>
                      <Link
                        href="/"
                        className={cn(
                          "rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                          pathname === '/' ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"
                        )}
                        onClick={() => setIsSheetOpen(false)}
                      >
                        Home
                      </Link>
                      <Link
                        href="/project-details"
                        className={cn(
                          "rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                          pathname === '/project-details' ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"
                        )}
                        onClick={() => setIsSheetOpen(false)}
                      >
                        Project Details
                      </Link>
                      <Link
                        href="/contact"
                        className={cn(
                          "rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                          pathname === '/contact' ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"
                        )}
                        onClick={() => setIsSheetOpen(false)}
                      >
                        Contact
                      </Link>
                      <div className="pt-4 border-t mt-2 flex flex-col gap-2">
                        <Button variant="outline" asChild className="w-full rounded-xl" onClick={() => setIsSheetOpen(false)}>
                          <Link href="/login">Sign In</Link>
                        </Button>
                        <Button asChild className="w-full rounded-xl" onClick={() => setIsSheetOpen(false)}>
                          <Link href="/signup">Get Started</Link>
                        </Button>
                      </div>
                    </>
                  )}
                </nav>

                {/* Sheet Footer: User Profile + Logout */}
                {!loading && authenticated && user && (
                  <div className="border-t">
                    <Link
                      href={role === 'doctor' ? '/doctor/profile' : role === 'admin' ? '/admin/profile' : '/profile'}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                      onClick={() => setIsSheetOpen(false)}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={userData?.photo_url || undefined} alt={displayName} />
                        <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{displayName}</span>
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      </div>
                    </Link>
                    <button
                      onClick={() => { setIsSheetOpen(false); signOut(); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm text-destructive hover:bg-destructive/10 transition-colors border-t cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>

          <Link href={getHomeHref()} className="flex items-center space-x-1.5 sm:space-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1">
            <Logo className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" showText={false} />
            <span className="text-sm sm:text-lg md:text-xl font-bold font-headline truncate max-w-[130px] sm:max-w-none">DermiAssist-AI</span>
          </Link>
        </div>

        {/* Center: Desktop Nav — absolutely centered with active indicators */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center">
          {authenticated && (
            <nav className="flex items-center space-x-6 text-sm font-medium" aria-label="Desktop Navigation">
              {filteredNavLinks.map(link => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      "transition-colors hover:text-foreground py-1 border-b-2 font-medium",
                      isActive
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:border-muted"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right: Notifications + Theme toggle + UserNav (desktop) / Login buttons */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
          {authenticated && user && (
            <div className="block">
              <NotificationInbox subscriberId={user.id} />
            </div>
          )}
          <div className="block">
            <ThemeToggle />
          </div>
          {loading ? (
            <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full" />
          ) : authenticated && user ? (
            <div className="hidden lg:block">
              <UserNav name={displayName} email={user.email || ''} role={role} />
            </div>
          ) : (
            <nav className="space-x-1.5 sm:space-x-2 flex">
              <Button variant="ghost" size="sm" asChild className="text-xs sm:text-sm px-2.5 sm:px-3">
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild className="text-xs sm:text-sm px-2.5 sm:px-3">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
