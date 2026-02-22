
"use client"

import nextDynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PatientChatView = nextDynamic(() => import('@/components/chat/patient-chat-view'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

export default function ChatPage() {
  return <PatientChatView />;
}
