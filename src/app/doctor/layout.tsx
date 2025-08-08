import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader authenticated={true} role="doctor" />
      <main className="flex-1 bg-muted/40">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
