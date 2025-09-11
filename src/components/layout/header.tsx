
"use client"

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { UserNav } from './user-nav';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '../ui/sheet';
import { Menu, X } from 'lucide-react';
import React from 'react';

export function AppHeader() {
  const { user, role, loading } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  const authenticated = !!user;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", roles: ["patient"] },
    { href: "/my-analyses", label: "My Analyses", roles: ["patient"] },
    { href: "/appointments", label: "Appointments", roles: ["patient"] },
    { href: "/doctors", label: "Find a Doctor", roles: ["patient"] },
    { href: "/chat", label: "Chat", roles: ["patient", "doctor"] },
    { href: "/doctor/dashboard", label: "Dashboard", roles: ["doctor"] },
    { href: "/doctor/appointments", label: "Appointments", roles: ["doctor"] },
    { href: "/doctor/cases", label: "Patient Cases", roles: ["doctor"] },
    { href: "/admin/dashboard", label: "Dashboard", roles: ["admin"] },
  ];
  
  const getFilteredLinks = (userRole: typeof role) => {
    if (!userRole) return [];
    return navLinks.filter(link => link.roles.includes(userRole));
  };
  
  const filteredNavLinks = getFilteredLinks(role);

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
        <div className="flex-1 flex items-center">
          {/* Mobile Menu */}
          {authenticated && (
            <div className="md:hidden mr-2">
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                    <SheetHeader>
                        <SheetTitle className="sr-only">Main Menu</SheetTitle>
                    </SheetHeader>
                    <nav className="grid gap-6 text-lg font-medium pt-8">
                      <Link href={getHomeHref()} className="flex items-center gap-2 text-lg font-semibold" onClick={() => setIsSheetOpen(false)}>
                          <Logo />
                          <span className="sr-only">SkinWise</span>
                        </Link>
                        {filteredNavLinks.map(link => (
                          <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground" onClick={() => setIsSheetOpen(false)}>
                              {link.label}
                          </Link>
                        ))}
                    </nav>
                </SheetContent>
              </Sheet>
            </div>
          )}

          {/* Desktop Logo & Nav */}
          <div className="hidden md:flex items-center">
            <Link href={getHomeHref()} className="mr-6 flex items-center space-x-2">
              <Logo />
            </Link>
            {authenticated && (
              <nav className="items-center space-x-6 text-sm font-medium flex">
                {filteredNavLinks.map(link => (
                  <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground/80 text-foreground/60">
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          
          {/* Mobile Logo (visible when not authenticated) */}
           <div className="md:hidden">
              <Link href={getHomeHref()} className="flex items-center space-x-2">
                  <Logo />
              </Link>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <ThemeToggle />
          {loading ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : authenticated && user ? (
            <UserNav name={user.displayName || 'User'} email={user.email || ''} role={role} />
          ) : (
            <nav className="space-x-2 hidden sm:block">
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
