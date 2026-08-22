
"use client";

import dynamic from 'next/dynamic';
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// The Agora SDK (~360kB) is only ever needed once a call actually starts,
// so it's split into its own client-only chunk instead of shipping on
// every visit to this route.
const AgoraConference = dynamic(() => import('./agora-conference'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading Video Call...</p>
    </div>
  ),
});

// This is the main page component. It handles auth/config gating before
// loading the (heavy) Agora conference chunk.
export default function VideoCallPage() {
  const { loading: authLoading } = useAuth();
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

  if (authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (!appId) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>The video service is not configured. Please set NEXT_PUBLIC_AGORA_APP_ID in your environment.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return <AgoraConference />;
}
