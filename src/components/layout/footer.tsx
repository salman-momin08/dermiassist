import Link from "next/link";
import { Logo } from "../logo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "../ui/button";

export function AppFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <Logo />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} SkinWise. All Rights Reserved.
          </p>
        </div>
        <nav className="flex gap-4 sm:gap-6 text-sm text-muted-foreground">
          <Link href="/project-details" className="hover:text-foreground">Project Details</Link>
          <a href="#" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Developer Details</a>

          <Link href="/terms" className="hover:text-foreground">Terms & Conditions</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
