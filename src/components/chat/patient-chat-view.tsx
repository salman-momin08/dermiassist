
"use client"

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import { StreamChat } from 'stream-chat';
import { Chat, Channel, ChannelList, Window, MessageList, MessageInput, ChannelHeader, LoadingIndicator, useChatContext, useChannelStateContext } from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import { CustomMessage } from '@/components/chat/custom-message';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

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

    return <MessageList Message={(props) => <CustomMessage {...props} deletedMessages={deletedMessages} />} />;
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
            <p className="text-sm text-muted-foreground">Choose a conversation from the list to start chatting.</p>
        </div>
    );
};

const EmptyChannelList = () => {
    return (
        <div className="flex flex-col h-full items-center justify-center p-4 text-center bg-background">
            <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-foreground">No connections yet</p>
            <p className="text-sm text-muted-foreground mt-2">
                You haven't connected with a doctor yet. Go to "Find a Doctor" to book an appointment and start your consultation.
            </p>
            <Button asChild className="mt-6" variant="outline">
                <a href="/doctors">Find a Doctor</a>
            </Button>
        </div>
    );
};

const CustomChannelHeader = () => {
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) return;

        setIsDeleting(true);
        try {
            await channel.delete();
            // Optional: You might want to refresh the list or handle navigation
        } catch (error) {
            toast({
                title: "Deletion Failed",
                description: "Failed to delete conversation. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="str-chat__header-livestream flex justify-between items-center w-full pr-4">
            <div className="flex items-center">
                <ChannelHeader />
            </div>
            <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
            >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Chat'}
            </Button>
        </div>
    );
};

export default function PatientChatView() {
    const { user, userData, loading: authLoading } = useAuth();
    const { theme } = useTheme();
    const [chatClient, setChatClient] = useState<StreamChat | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading || !user || !userData) {
            return;
        }

        if (!apiKey) {
            setError("Chat service is not configured. Please contact support.");
            setIsConnecting(false);
            return;
        }

        const client = StreamChat.getInstance(apiKey);

        const setupClient = async () => {
            try {
                // If already connected to the correct user, skip re-connection
                if (client.userID === user.id) {
                    setChatClient(client);
                    setIsConnecting(false);
                    return;
                }

                // Ensure any previous connection is closed if it was a different user
                if (client.userID) {
                    await client.disconnectUser();
                }

                const response = await fetch('/api/stream-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id }),
                });

                if (!response.ok) {
                    const { message } = await response.json();
                    throw new Error(message || "Failed to get chat token.");
                }

                const { token } = await response.json();

                await client.connectUser(
                    {
                        id: user.id,
                        name: userData.displayName || 'Anonymous User',
                        image: userData.photoURL,
                        role: 'patient',
                    },
                    token
                );

                setChatClient(client);
            } catch (err: any) {
                setError(err.message || "An error occurred while connecting to the chat service.");
            } finally {
                setIsConnecting(false);
            }
        };

        setupClient();

        return () => {
            if (client) {
                client.disconnectUser();
                setChatClient(null);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, userData, authLoading]);

    if (authLoading || !user || isConnecting) {
        return <ChatSkeleton />;
    }

    const filters = { type: 'consultation', members: { $in: [user.id] } };
    const sort = { last_message_at: -1 as const };

    return (
        <div className="container mx-auto p-4 md:p-8 h-[calc(100vh-128px)] flex flex-col relative">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Chat with Your Doctor</h1>
                <p className="text-muted-foreground">Communicate directly and securely with your healthcare providers.</p>
            </div>

            {!isConnecting && error && (
                <div className="flex flex-grow items-center justify-center text-center p-4">
                    <p className="text-destructive font-semibold">Chat Unavailable</p>
                    <p className="text-muted-foreground">{error}</p>
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
