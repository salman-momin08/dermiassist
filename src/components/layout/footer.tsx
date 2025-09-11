
import Link from "next/link";
import { Logo } from "../logo";

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
          <Link href="/developer-details" className="hover:text-foreground">Developer Details</Link>
          <Link href="#" className="hover:text-foreground">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
