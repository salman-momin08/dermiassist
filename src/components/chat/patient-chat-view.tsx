"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Trash2, ShieldCheck, UserCheck, Video, Calendar, ArrowLeft } from 'lucide-react';
import { StreamChat } from 'stream-chat';
import {
    Chat,
    Channel,
    ChannelList,
    Window,
    MessageList,
    MessageInput,
    useChatContext,
    useChannelStateContext,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import { CustomMessage } from '@/components/chat/custom-message';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import Link from 'next/link';

const ChatEventListeners = () => {
    const { client } = useChatContext();
    const [deletedMessages, setDeletedMessages] = useState<string[]>([]);

    const handleEvent = useCallback((event: any) => {
        if (event.type === 'message.flagged' && event.message?.id) {
            if (event.message.user?.id === client.userID) {
                setDeletedMessages(prev => [...prev, event.message.id]);
            }
        }
    }, [client.userID]);

    useEffect(() => {
        client.on('message.flagged', handleEvent);
        return () => {
            client.off('message.flagged', handleEvent);
        };
    }, [client, handleEvent]);

    const MessageComponent = useCallback((props: any) => (
        <CustomMessage {...props} deletedMessages={deletedMessages} />
    ), [deletedMessages]);

    return <MessageList Message={MessageComponent} />;
};

const ChatSkeleton = () => (
    <div className="container mx-auto px-4 py-6 max-w-6xl h-[calc(100vh-160px)] min-h-[580px] flex flex-col">
        <div className="space-y-1.5 mb-5">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0 flex-grow min-h-0 border rounded-2xl shadow-xl overflow-hidden bg-card">
            <div className="md:col-span-1 border-r p-4 space-y-3 bg-muted/20">
                <Skeleton className="h-8 w-full rounded-lg mb-3" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center space-x-3 p-2 rounded-xl bg-card border border-border/40">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1.5 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="md:col-span-1 p-5 flex flex-col space-y-4 bg-background">
                <div className="flex-1 space-y-3">
                    <Skeleton className="h-12 w-2/3 rounded-2xl" />
                    <Skeleton className="h-12 w-1/2 rounded-2xl ml-auto" />
                    <Skeleton className="h-12 w-3/5 rounded-2xl" />
                </div>
                <Skeleton className="h-11 w-full rounded-full mt-auto" />
            </div>
        </div>
    </div>
);

const EmptyChat = () => {
    return (
        <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-background">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 border border-primary/20 shadow-xs">
                <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground font-headline">Select a Doctor Consultation</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Choose an active consultation channel from the left sidebar to communicate directly with your healthcare provider.
            </p>
        </div>
    );
};

const EmptyChannelList = () => {
    return (
        <div className="flex flex-col h-full items-center justify-center p-6 text-center bg-muted/10">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3 border border-border/60">
                <UserCheck className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-xs font-bold text-foreground">No Active Consultations</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                Book an appointment with a dermatologist to establish a secure direct consultation channel.
            </p>
            <Button asChild className="mt-4 h-8 px-3.5 rounded-full text-xs" size="sm">
                <Link href="/doctors">Find a Doctor</Link>
            </Button>
        </div>
    );
};

const CustomChannelHeader = () => {
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    // Find other member (Doctor)
    const members = Object.values(channel?.state?.members || {});
    const otherMember = members.find((m: any) => m.user?.id !== client.userID)?.user;
    const channelName = (channel?.data as any)?.name || otherMember?.name || 'Healthcare Provider';
    const otherMemberImage = otherMember?.image as string | undefined;

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
        <div className="flex items-center justify-between px-5 py-3.5 bg-card border-b border-border/80 shadow-2xs">
            {/* Left: Doctor Avatar & Information */}
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Avatar className="h-10 w-10 border border-border/80 shadow-xs">
                        <AvatarImage src={otherMemberImage} alt={channelName} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {channelName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-foreground leading-none">{channelName}</h2>
                        <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            <span>HIPAA Encrypted</span>
                        </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Licensed Healthcare Provider · Active Direct Line
                    </p>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 px-3 rounded-full text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-xs"
                >
                    <Link href="/appointments">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Appointments</span>
                    </Link>
                </Button>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-8 w-8 p-0 rounded-full"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Consultation History?</AlertDialogTitle>
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
        <div className="container mx-auto px-4 py-5 md:py-8 max-w-6xl flex flex-col h-[calc(100dvh-140px)] min-h-[580px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-0.5">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight font-headline text-foreground">
                        Doctor Consultations
                    </h1>
                    <p className="text-xs text-muted-foreground">Direct encrypted messaging with your licensed clinical care team.</p>
                </div>
            </div>

            {error && (
                <div className="flex flex-col flex-grow items-center justify-center text-center p-6 bg-card rounded-2xl border border-destructive/20 shadow-sm">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
                        <MessageSquare className="h-6 w-6" />
                    </div>
                    <p className="text-base font-bold text-foreground">Chat Channel Temporarily Unavailable</p>
                    <p className="text-muted-foreground mt-1 mb-4 max-w-sm text-xs leading-relaxed">{error}</p>
                    <Button onClick={() => setRetryCount(prev => prev + 1)} variant="outline" size="sm" className="gap-2 rounded-full h-8 px-4 text-xs font-semibold">
                        <Loader2 className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")} />
                        Try Again
                    </Button>
                </div>
            )}

            {!isConnecting && !error && chatClient && (
                <div className={cn("flex-grow min-h-0 rounded-2xl border border-border/80 shadow-xl overflow-hidden bg-card", resolvedTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light')}>
                    <Chat client={chatClient} theme={resolvedTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light'}>
                        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0 h-full min-h-0 bg-card">
                            {/* Left Sidebar: Channel List */}
                            <div className="md:col-span-1 h-full min-h-0 border-r border-border/80 bg-muted/15 flex flex-col">
                                <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Active Channels
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto min-h-0">
                                    <ChannelList
                                        filters={filters}
                                        sort={sort}
                                        EmptyStateIndicator={EmptyChannelList}
                                    />
                                </div>
                            </div>

                            {/* Right Workspace: Active Channel */}
                            <div className="md:col-span-1 h-full min-h-0 flex flex-col bg-background">
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

