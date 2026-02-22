'use client';
import { Inbox } from '@novu/nextjs';

export default function NotificationInbox({ subscriberId }: { subscriberId: string }) {
    const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
    const backendUrl = process.env.NEXT_PUBLIC_NOVU_BACKEND_URL;
    const socketUrl = process.env.NEXT_PUBLIC_NOVU_SOCKET_URL;

    return (
        <Inbox
            applicationIdentifier={applicationIdentifier}
            subscriberId={subscriberId}
            backendUrl={backendUrl}
            socketUrl={socketUrl}
            appearance={{
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
            }}
        />
    );
}
