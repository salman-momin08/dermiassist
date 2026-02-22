import Link from "next/link";
import { Logo } from "../logo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "../ui/button";

export function AppFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-16 md:flex-row md:py-0 w-full">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          © {new Date().getFullYear()} DermiAssist-AI. All Rights Reserved.
        </p>
        <nav className="flex gap-4 sm:gap-6 text-sm text-muted-foreground">
          <Link href="/project-details" className="hover:text-foreground">Project Details</Link>
          <a href="https://www.salmanmomin.me" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Developer Details</a>

          <Link href="/terms" className="hover:text-foreground">Terms & Conditions</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        </nav>
      </div>
    </footer >
  );
}
