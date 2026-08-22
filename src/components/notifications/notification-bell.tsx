'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';

// Lazy-load the Novu Inbox so it never runs during SSR
const NovuInbox = React.lazy(() =>
  import('@novu/nextjs').then((mod) => ({ default: mod.Inbox }))
);

/**
 * Error boundary that catches Novu render / WebSocket crashes and
 * shows a silent fallback bell icon instead of breaking the whole header.
 */
class InboxErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[NotificationInbox] Novu error caught by boundary:', error.message);
  }

  render() {
    if (this.state.hasError) {
      // Fallback: plain bell icon so the header stays intact
      return (
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          title="Notifications unavailable"
          onClick={() => this.setState({ hasError: false })}
        >
          <Bell className="h-[1.2rem] w-[1.2rem]" />
        </button>
      );
    }
    return this.props.children;
  }
}

// Appearance config extracted as a stable constant to avoid re-renders
const INBOX_APPEARANCE = {
  variables: {
    colorPrimary: 'hsl(215.9, 76.5%, 46.9%)',
    colorPrimaryForeground: 'hsl(0, 0%, 98%)',
    colorSecondary: 'hsl(220, 13%, 91%)',
    colorSecondaryForeground: 'hsl(222.9, 84%, 4.9%)',
    colorBackground: 'hsl(var(--background))',
    colorForeground: 'hsl(var(--foreground))',
    colorNeutral: 'hsl(var(--border))',
    colorRing: 'hsl(217.2, 91.2%, 59.8%)',
    colorShadow: 'hsl(var(--border))',
    fontSize: '14px',
  },
  elements: {
    bellIcon: {
      color: 'hsl(var(--foreground))',
      width: '20px',
      height: '20px',
    },
  },
} as const;

// Simple loading fallback
function BellSkeleton() {
  return (
    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground">
      <Bell className="h-[1.2rem] w-[1.2rem] animate-pulse" />
    </div>
  );
}

export default function NotificationInbox({ subscriberId }: { subscriberId: string }) {
  const [mounted, setMounted] = useState(false);

  const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
  const backendUrl = process.env.NEXT_PUBLIC_NOVU_BACKEND_URL;
  const socketUrl = process.env.NEXT_PUBLIC_NOVU_SOCKET_URL;

  // Only mount after a short delay to let the page settle and avoid
  // race conditions with auth hydration / WebSocket setup.
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || !applicationIdentifier || !subscriberId) {
    return <BellSkeleton />;
  }

  return (
    <InboxErrorBoundary>
      <React.Suspense fallback={<BellSkeleton />}>
        <NovuInbox
          applicationIdentifier={applicationIdentifier}
          subscriberId={subscriberId}
          backendUrl={backendUrl}
          socketUrl={socketUrl}
          appearance={INBOX_APPEARANCE}
        />
      </React.Suspense>
    </InboxErrorBoundary>
  );
}
