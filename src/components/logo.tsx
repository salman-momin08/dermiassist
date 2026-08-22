import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({ className, showText = true }: { className?: string, showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/dermilogo.png"
        alt="DermiAssist-AI Logo"
        width={32}
        height={32}
        className="rounded-md"
      />
      {showText && <span className="font-bold text-lg font-headline">DermiAssist-AI</span>}
    </div>
  );
}
