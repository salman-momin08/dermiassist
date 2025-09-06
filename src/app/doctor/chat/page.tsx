
"use client"

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { StreamChat } from 'stream-chat';
import { Chat, Channel, ChannelList, Window, MessageList, MessageInput, ChannelHeader, LoadingIndicator, useChatContext } from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import { CustomMessage } from '@/components/chat/custom-message';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

const ChatEventListeners = () => {
    const { client } = useChatContext();
    const [deletedMessages, setDeletedMessages] = useState<string[]>([]);

    const handleEvent = useCallback((event: any) => {
        if (event.type === 'message.deleted') {
            // This is a hard delete, it will be removed automatically
        }
        if (event.type === 'message.flagged' && event.message?.id) {
            // A flagged message is our way of implementing "delete for me"
            // We only hide it if the current user is the one who flagged it
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
      <Chat client={chatClient} theme="whatsapp-clone">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-0 flex-grow min-h-0 border rounded-lg shadow-sm">
            <div className="md:col-span-1 h-full min-h-0 bg-[var(--str-chat__channel-list-bg-color)] rounded-l-lg">
                <ChannelList filters={filters} sort={sort} showChannelSearch />
            </div>
            <div className="md:col-span-1 h-full min-h-0 border-l">
                <Channel>
                    <Window>
                        <ChannelHeader />
                        <ChatEventListeners />
                        <MessageInput />
                    </Window>
                </Channel>
            </div>
        </div>
      </Chat>
    </div>
  );
}
