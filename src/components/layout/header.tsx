
"use client"

import Link from 'next/link';
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

export function AppHeader() {
  const { user, userData, role, loading, signOut } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  const authenticated = !!user;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", roles: ["patient"] },
    { href: "/my-analyses", label: "My Analyses", roles: ["patient"] },
    { href: "/appointments", label: "Appointments", roles: ["patient"] },
    { href: "/doctors", label: "Find a Doctor", roles: ["patient"] },
    { href: "/chat", label: "My Doctor", roles: ["patient"] },
    { href: "/my-requests", label: "My Requests", roles: ["patient", "doctor"] },
    { href: "/contact", label: "Contact", roles: ["patient", "doctor"] },
    { href: "/doctor/dashboard", label: "Dashboard", roles: ["doctor"] },
    { href: "/doctor/appointments", label: "Appointments", roles: ["doctor"] },
    { href: "/doctor/cases", label: "Patient Cases", roles: ["doctor"] },
    { href: "/chat", label: "My Patients", roles: ["doctor"] },
    { href: "/admin/dashboard", label: "Dashboard", roles: ["admin"] },
    { href: "/admin/requests", label: "Requests", roles: ["admin"] },
  ];

  const getFilteredLinks = (userRole: typeof role) => {
    if (!userRole) return [];
    return navLinks.filter(link => link.roles.includes(userRole));
  };

  const filteredNavLinks = getFilteredLinks(role);

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
  }

  const displayName = userData?.displayName || user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container relative flex h-16 items-center">

        {/* Left: Hamburger (mobile/tablet) + Logo */}
        <div className="flex items-center gap-2 flex-1">
          {authenticated && (
            <div className="lg:hidden">
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col w-72 p-0" aria-describedby={undefined}>
                  <SheetHeader className="sr-only">
                    <SheetTitle>Main Menu</SheetTitle>
                  </SheetHeader>

                  {/* Sheet Header: Logo + Brand name */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b mr-10">
                    <Logo className="h-6 w-6 flex-shrink-0" showText={false} />
                    <span className="font-bold text-base font-headline">DermiAssist-AI</span>
                  </div>

                  {/* Nav Links */}
                  <nav className="flex flex-col gap-1 px-3 py-3 flex-1 overflow-y-auto">
                    {filteredNavLinks.map(link => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        onClick={() => setIsSheetOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>

                  {/* Sheet Footer: User Profile + Logout */}
                  {!loading && authenticated && user && (
                    <div className="border-t">
                      {/* Profile row → links to profile page */}
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
                      {/* Logout row */}
                      <button
                        onClick={() => { setIsSheetOpen(false); signOut(); }}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm text-destructive hover:bg-destructive/10 transition-colors border-t"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          )}

          <Link href={getHomeHref()} className="flex items-center space-x-1.5 sm:space-x-2">
            <Logo className="h-5 w-5 sm:h-7 sm:w-7 md:h-8 md:w-8" showText={false} />
            <span className="text-sm sm:text-lg md:text-xl font-bold font-headline truncate max-w-[120px] sm:max-w-none">DermiAssist-AI</span>
          </Link>
        </div>

        {/* Center: Desktop Nav — absolutely centered */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center">
          {authenticated && (
            <nav className="flex items-center space-x-6 text-sm font-medium">
              {filteredNavLinks.map(link => (
                <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground/80 text-foreground/60">
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Right: Notifications + Theme toggle + UserNav (desktop) / Login buttons */}
        <div className="flex items-center justify-end gap-2 flex-1">
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
            /* UserNav is hidden on mobile (shown inside sheet), visible on desktop */
            <div className="hidden lg:block">
              <UserNav name={displayName} email={user.email || ''} role={role} />
            </div>
          ) : (
            <nav className="space-x-2 hidden sm:flex">
              <Button variant="ghost" size="sm" asChild className="text-xs sm:text-sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild className="text-xs sm:text-sm">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
