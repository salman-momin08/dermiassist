
"use client"

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { StreamChat, Channel as StreamChannel } from 'stream-chat';
import { Chat, Channel, ChannelList, Window, MessageList, MessageInput, ChannelHeader, LoadingIndicator, useChatContext } from 'stream-chat-react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateChatReply } from '@/ai/flows/generate-chat-reply';
import 'stream-chat-react/dist/css/v2/index.css';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

const CustomMessageInput = () => {
    const { channel } = useChatContext();
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const handleGenerateReplies = async () => {
        if (!channel || !channel.state.messages.length) {
            toast({ title: "No messages to reply to.", variant: 'destructive'});
            return;
        }

        setIsGenerating(true);

        const patient = Object.values(channel.state.members).find(m => m.user?.role === 'patient');
        if (!patient || !patient.user) {
             toast({ title: "Could not identify patient in this channel.", variant: 'destructive'});
             setIsGenerating(false);
             return;
        }

        const conversationHistory = channel.state.messages.map(m => `${m.user?.name}: ${m.text}`).join('\n');
        const lastPatientMessage = channel.state.messages.filter(m => m.user?.id === patient.user?.id).pop()?.text;
        
        if (!lastPatientMessage) {
            toast({ title: "No message from patient found to reply to.", variant: 'destructive'});
            setIsGenerating(false);
            return;
        }

        try {
            const result = await generateChatReply({
                patientName: patient.user.name || 'the patient',
                conversationHistory,
                lastPatientMessage,
            });
            // In a real app, you would have a state to show these replies.
            // For now, we'll just show the first one as a toast.
            toast({
                title: "AI Suggested Reply",
                description: result.replies[0],
            });
        } catch (error) {
            console.error("Failed to generate replies:", error);
            toast({ title: "AI Error", description: "Could not generate suggestions.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="relative">
            <MessageInput />
            <Button
                size="icon"
                variant="ghost"
                className="absolute top-3 right-20"
                onClick={handleGenerateReplies}
                disabled={isGenerating}
                title="Generate AI Reply Suggestions"
            >
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            </Button>
        </div>
    );
};

export default function DoctorChatPage() {
  const { user, userData, loading } = useAuth();
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || !userData) {
      return;
    }

    if (!apiKey) {
      console.error("Stream API key is missing.");
      setError("Chat service is not configured. Please contact support.");
      return;
    }
    
    const client = StreamChat.getInstance(apiKey);

    const setupClient = async () => {
      try {
        const response = await fetch('/api/stream-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        });

        if (!response.ok) {
          const { message } = await response.json();
          throw new Error(message || "Failed to get chat token.");
        }

        const { token } = await response.json();

        await client.connectUser(
          {
            id: user.uid,
            name: userData.displayName || 'Doctor',
            image: userData.photoURL,
            role: 'doctor',
          },
          token
        );

        setChatClient(client);

      } catch (err: any) {
        console.error("Error setting up chat client:", err);
        setError(err.message || "An error occurred while connecting to the chat service.");
        if (chatClient?.user) {
          await chatClient.disconnectUser();
        }
      }
    };

    if (!chatClient?.user) {
        setupClient();
    }
    
    return () => {
      if (chatClient) {
        chatClient.disconnectUser();
        setChatClient(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData, loading]);

  if (loading || !chatClient) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Connecting to chat...</p>
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center text-center p-4">
        <p className="text-destructive font-semibold">Chat Unavailable</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const filters = { type: 'messaging', members: { $in: [user!.uid] } };
  const sort = { last_message_at: -1 };

  return (
    <div className="container mx-auto p-4 md:p-8 h-[calc(100vh-128px)] flex flex-col">
       <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Patient Chat</h1>
            <p className="text-muted-foreground">Communicate directly and securely with your patients.</p>
        </div>
      <Chat client={chatClient} theme="str-chat__theme-light">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8 flex-grow min-h-0">
             <div className="md:col-span-1 lg:col-span-1 h-full min-h-0">
                <ChannelList filters={filters} sort={sort} showChannelSearch />
            </div>
             <div className="md:col-span-2 lg:col-span-3 h-full min-h-0">
                <Channel>
                    <Window>
                        <ChannelHeader />
                        <MessageList />
                        <CustomMessageInput />
                    </Window>
                </Channel>
            </div>
        </div>
      </Chat>
    </div>
  );
}
