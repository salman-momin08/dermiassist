"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Trash2, ShieldCheck, UserCheck } from 'lucide-react';
import { StreamChat } from 'stream-chat';
import {
    Chat,
    Channel,
    ChannelList,
    Window,
    MessageList,
    MessageInput,
    ChannelHeader,
    useChatContext,
    useChannelStateContext,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import { CustomMessage } from '@/components/chat/custom-message';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { connectStreamUser } from '@/lib/stream';

const ChatEventListeners = () => {
    const { client } = useChatContext();
    const [deletedMessages, setDeletedMessages] = useState<string[]>([]);

    const handleEvent = useCallback((event: any) => {
        if (event.type === 'message.deleted') {
            // Hard delete
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
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 flex-grow min-h-0 border rounded-xl shadow-md overflow-hidden">
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
        <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-card">
            <div className="rounded-full bg-primary/10 p-5 mb-4 border border-primary/20">
                <MessageSquare className="w-10 h-10 text-primary" />
            </div>
            <p className="text-xl font-bold text-foreground">Select a Doctor Conversation</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Choose a conversation from the sidebar to chat securely with your healthcare provider.
            </p>
        </div>
    );
};

const EmptyChannelList = () => {
    return (
        <div className="flex flex-col h-full items-center justify-center p-6 text-center bg-card">
            <div className="rounded-full bg-muted p-4 mb-4">
                <UserCheck className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No Doctor Connections</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                You have not connected with a doctor yet. Visit "Doctors" to book an appointment and start your consultation.
            </p>
            <Button asChild className="mt-5" size="sm" variant="default">
                <a href="/doctors">Find a Doctor</a>
            </Button>
        </div>
    );
};

const CustomChannelHeader = () => {
    const { channel } = useChannelStateContext();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await channel.delete();
            toast({
                title: "Chat Deleted",
                description: "Conversation history has been removed.",
            });
        } catch (error) {
            toast({
                title: "Deletion Failed",
                description: "Failed to delete conversation. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex justify-between items-center w-full px-4 py-3 bg-card border-b border-border">
            <div className="flex items-center gap-3">
                <ChannelHeader />
                <Badge variant="outline" className="hidden sm:inline-flex text-[11px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                    <ShieldCheck className="h-3 w-3" /> End-to-End Encrypted
                </Badge>
            </div>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1.5 h-8 px-2.5"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Delete Chat</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to permanently delete this chat history? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default function PatientChatView() {
    const { user, userData, loading: authLoading } = useAuth();
    const { resolvedTheme } = useTheme();
    const [chatClient, setChatClient] = useState<StreamChat | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
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
                // Sync channels with backend
                await fetch('/api/chat/sync', { method: 'POST' }).catch(() => {});

                const client = await connectStreamUser({
                    id: user.id,
                    name: userData.displayName || 'Patient',
                    image: userData.photoURL,
                    role: 'patient',
                });

                setChatClient(client);
            } catch (err: any) {
                console.error("Chat setup failed:", err);
                setError(err.message || "An error occurred while connecting to the chat service.");
            } finally {
                setIsConnecting(false);
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
            <div className="space-y-1.5 mb-6">
                <h1 className="text-3xl font-extrabold tracking-tight font-headline">Chat with Your Doctor</h1>
                <p className="text-sm text-muted-foreground">Communicate directly and securely with licensed healthcare providers.</p>
            </div>

            {error && (
                <div className="flex flex-col flex-grow items-center justify-center text-center p-6 bg-card rounded-xl border">
                    <div className="rounded-full bg-destructive/10 p-4 mb-4">
                        <MessageSquare className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-xl font-bold">Chat Unavailable</p>
                    <p className="text-muted-foreground mt-2 mb-6 max-w-sm text-sm">{error}</p>
                    <Button onClick={() => setRetryCount(prev => prev + 1)} variant="outline" className="flex gap-2">
                        <Loader2 className={cn("h-4 w-4", isConnecting && "animate-spin")} />
                        Try Again
                    </Button>
                </div>
            )}

            {!isConnecting && !error && chatClient && (
                <div className={cn("flex-grow min-h-0", resolvedTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light')}>
                    <Chat client={chatClient} theme={resolvedTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light'}>
                        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-0 h-full min-h-0 border rounded-2xl shadow-xl overflow-hidden bg-card">
                            <div className="md:col-span-1 h-full min-h-0 border-r border-border bg-card">
                                <ChannelList
                                    filters={filters}
                                    sort={sort}
                                    EmptyStateIndicator={EmptyChannelList}
                                />
                            </div>
                            <div className="md:col-span-1 h-full min-h-0 bg-card">
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
                </div>
            )}
        </div>
    );
}
