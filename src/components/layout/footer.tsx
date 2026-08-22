import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="border-t bg-background/50 overflow-hidden">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-16 md:flex-row md:py-0 w-full px-4 sm:px-6 md:px-8 max-w-full">
        <p className="text-center text-xs sm:text-sm leading-loose text-muted-foreground md:text-left">
          © {new Date().getFullYear()} DermiAssist-AI. All Rights Reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground">
          <Link href="/project-details" className="hover:text-foreground transition-colors">Project Details</Link>
          <a href="https://www.salmanmomin.me" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Developer Details</a>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
