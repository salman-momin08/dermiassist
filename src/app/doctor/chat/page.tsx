
"use client"

import nextDynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const DoctorChatView = nextDynamic(() => import('@/components/chat/doctor-chat-view'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

export default function DoctorChatPage() {
  return <DoctorChatView />;
}
