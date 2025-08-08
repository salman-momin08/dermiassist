import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader authenticated={true} role="patient" />
      <main className="flex-1">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
