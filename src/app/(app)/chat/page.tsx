
"use client"

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { StreamChat } from 'stream-chat';
import { Chat, Channel, ChannelList, Window, MessageList, MessageInput, ChannelHeader, LoadingIndicator } from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

export default function ChatPage() {
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
            name: userData.displayName || 'Anonymous User',
            image: userData.photoURL,
            role: 'patient',
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
    <div className="h-[calc(100vh-128px)] container mx-auto p-4 md:p-8">
       <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Chat with Your Doctor</h1>
            <p className="text-muted-foreground">Communicate directly and securely with your healthcare providers.</p>
        </div>
      <Chat client={chatClient} theme="str-chat__theme-light">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <ChannelList filters={filters} sort={sort} showChannelSearch />
            </div>
            <div className="lg:col-span-2">
                <Channel>
                    <Window>
                        <ChannelHeader />
                        <MessageList />
                        <MessageInput />
                    </Window>
                </Channel>
            </div>
        </div>
      </Chat>
    </div>
  );
}
