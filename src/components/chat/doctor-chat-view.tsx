
"use client"

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import { StreamChat } from 'stream-chat';
import { Chat, Channel, ChannelList, Window, MessageList, MessageInput, ChannelHeader, LoadingIndicator, useChatContext, useChannelStateContext } from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import { CustomMessage } from '@/components/chat/custom-message';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

const ChatEventListeners = () => {
    const { client } = useChatContext();
    const [deletedMessages, setDeletedMessages] = useState<string[]>([]);

    const handleEvent = useCallback((event: any) => {
        if (event.type === 'message.deleted') {
            // This is a hard delete, it will be removed automatically
        }
        if (event.type === 'message.flagged' && event.message?.id) {
            if (event.message.user?.id === client.userID) {
                setDeletedMessages(prev => [...prev, event.message.id]);
            }
        }
    }, [client.userID]);

    useEffect(() => {
        client.on('message.deleted', handleEvent);
        client.on('message.flagged', handleEvent);
        return () => {
            client.off('message.deleted', handleEvent);
            client.off('message.flagged', handleEvent);
        };
    }, [client, handleEvent]);

    const MessageComponent = useCallback((props: any) => (
        <CustomMessage {...props} deletedMessages={deletedMessages} />
    ), [deletedMessages]);

    return <MessageList Message={MessageComponent} />;
};

const ChatSkeleton = () => (
    <div className="container mx-auto p-4 md:p-8 h-[calc(100vh-128px)] flex flex-col">
        <div className="space-y-2 mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 flex-grow min-h-0 border rounded-lg shadow-sm">
            <div className="md:col-span-1 border-r p-4 space-y-4">
                <Skeleton className="h-10 w-full mb-4" />
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="md:col-span-1 p-4 flex flex-col space-y-4">
                <div className="flex-1 space-y-4">
                    <Skeleton className="h-16 w-3/4 rounded-lg" />
                    <Skeleton className="h-16 w-1/2 rounded-lg ml-auto" />
                    <Skeleton className="h-16 w-2/3 rounded-lg" />
                </div>
                <Skeleton className="h-12 w-full rounded-lg mt-auto" />
            </div>
        </div>
    </div>
);

const EmptyChat = () => {
    return (
        <div className="flex flex-col h-full items-center justify-center bg-background">
            <MessageSquare className="w-16 h-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg text-muted-foreground">Select a conversation</p>
            <p className="text-sm text-muted-foreground">Choose a patient conversation from the list to start.</p>
        </div>
    );
};

const EmptyChannelList = () => {
    return (
        <div className="flex flex-col h-full items-center justify-center p-4 text-center bg-background">
            <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-foreground">No active patients</p>
            <p className="text-sm text-muted-foreground mt-2">
                You don't have any active patient consultations at the moment. When a patient books an appointment with you, their chat will appear here.
            </p>
        </div>
    );
};

const CustomChannelHeader = () => {
    const { channel } = useChannelStateContext();

    return (
        <div className="str-chat__header-livestream">
            <div className="flex items-center">
                <ChannelHeader />
            </div>
        </div>
    );
};

import { getStreamClient, connectStreamUser } from '@/lib/stream';

// ... (skipping some lines) ...

export default function DoctorChatView() {
    const { user, userData, loading: authLoading } = useAuth();
    const { theme } = useTheme();
    const [chatClient, setChatClient] = useState<StreamChat | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (authLoading || !user || !userData) {
            return;
        }

        const setupClient = async () => {
            setIsConnecting(true);
            setError(null);
            try {
                // First, ensure all channels are synced with the database
                setIsSyncing(true);
                await fetch('/api/chat/sync', { method: 'POST' }).catch(err => {
                    console.error("Failed to sync chat channels:", err);
                });
                setIsSyncing(false);

                const client = await connectStreamUser({
                    id: user.id,
                    name: userData.displayName || 'Doctor',
                    image: userData.photoURL,
                    role: 'doctor',
                });

                setChatClient(client);
            } catch (err: any) {
                console.error("Chat setup failed:", err);
                setError(err.message || "An error occurred while connecting to the chat service.");
            } finally {
                setIsConnecting(false);
                setIsSyncing(false);
            }
        };

        setupClient();
    }, [user, userData, authLoading, retryCount]);

    const filters = useMemo(() => ({ type: 'messaging', members: { $in: [user?.id || ''] } }), [user?.id]);
    const sort = useMemo(() => ({ last_message_at: -1 as const }), []);

    if (authLoading || !user || isConnecting) {
        return <ChatSkeleton />;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 h-[calc(100vh-128px)] flex flex-col relative">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Patient Chat</h1>
                <p className="text-muted-foreground">Communicate directly and securely with your patients.</p>
            </div>

            {error && (
                <div className="flex flex-col flex-grow items-center justify-center text-center p-4">
                    <div className="rounded-full bg-destructive/10 p-4 mb-4">
                        <MessageSquare className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-xl font-semibold">Chat Unavailable</p>
                    <p className="text-muted-foreground mt-2 mb-6 max-w-sm">{error}</p>
                    <Button onClick={() => setRetryCount(prev => prev + 1)} variant="outline" className="flex gap-2">
                        <Loader2 className={cn("h-4 w-4", isConnecting && "animate-spin")} />
                        Try Again
                    </Button>
                </div>
            )}

            {!isConnecting && !error && chatClient && (
                <Chat client={chatClient} theme={`str-chat__theme-${theme === 'dark' ? 'dark' : 'light'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 flex-grow min-h-0 border rounded-lg shadow-sm">
                        <div className="md:col-span-1 h-full min-h-0 rounded-l-lg">
                            <ChannelList
                                filters={filters}
                                sort={sort}
                                EmptyStateIndicator={EmptyChannelList}
                            />
                        </div>
                        <div className="md:col-span-1 h-full min-h-0 border-l">
                            <Channel EmptyStateIndicator={EmptyChat}>
                                <Window>
                                    <CustomChannelHeader />
                                    <ChatEventListeners />
                                    <MessageInput />
                                </Window>
                            </Channel>
                        </div>
                    </div>
                </Chat>
            )}
        </div>
    );
}
