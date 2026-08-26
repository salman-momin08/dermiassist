"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { 
  LayoutDashboard, 
  Activity, 
  Calendar, 
  Users, 
  MessageSquare, 
  FileCheck2,
  Settings,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ClipboardList,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const pathname = usePathname();
  const { role, user } = useAuth();

  if (!user) return null;

  const patientLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/my-analyses", label: "Analyses", icon: Activity },
    { href: "/appointments", label: "Appointments", icon: Calendar },
    { href: "/doctors", label: "Doctors", icon: Users },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/my-requests", label: "Requests", icon: FileCheck2 },
    { href: "/profile", label: "Settings", icon: Settings },
  ];

  const doctorLinks = [
    { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/doctor/review-queue", label: "Triage Queue", icon: ClipboardList },
    { href: "/doctor/appointments", label: "Appointments", icon: Calendar },
    { href: "/doctor/cases", label: "Patient Cases", icon: UserCheck },
    { href: "/chat", label: "Patients", icon: MessageSquare },
    { href: "/my-requests", label: "Requests", icon: FileCheck2 },
    { href: "/doctor/profile", label: "Settings", icon: Settings },
  ];

  const adminLinks = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/requests", label: "Requests", icon: FileCheck2 },
    { href: "/admin/ai-engineering", label: "AI Control Center", icon: Sparkles },
    { href: "/admin/profile", label: "Settings", icon: Settings },
  ];

  const links = role === 'doctor' ? doctorLinks : role === 'admin' ? adminLinks : patientLinks;

  return (
    <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-border/80 bg-card/50 backdrop-blur-xl p-4 h-[calc(100vh-4rem)] sticky top-16 self-start select-none">
      {/* Navigation Links */}
      <div className="space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && link.href !== '/dashboard' && link.href !== '/doctor/dashboard' && pathname?.startsWith(link.href));
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Need Help Card */}
      <div className="mt-auto pt-6">
        <div className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950/80 border border-indigo-500/20 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Need Help?</h4>
              <p className="text-[10px] text-muted-foreground">Our support team is here</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            Get instant clinical guidance or technical assistance anytime.
          </p>
          <Button asChild size="sm" className="w-full h-8 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-xs border border-white/10 gap-1">
            <Link href="/contact">
              <span>Contact Support</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
