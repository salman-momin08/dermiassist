
import { StreamChat } from 'stream-chat';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

let chatClient: StreamChat | null = null;
let connectionPromise: Promise<StreamChat> | null = null;

export const getStreamClient = () => {
    if (!apiKey) {
        throw new Error('Chat service is not configured. Missing NEXT_PUBLIC_STREAM_API_KEY.');
    }

    if (!chatClient) {
        chatClient = StreamChat.getInstance(apiKey, { timeout: 15000 });
    }

    return chatClient;
};


export const connectStreamUser = async (user: { id: string; name: string; image?: string; role: string }) => {
    const client = getStreamClient();

    // If already connected to the SAME user, return early
    if (client.userID === user.id) {
        return client;
    }

    // If already connecting, wait for it
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = (async () => {
        let retries = 3;
        while (retries > 0) {
            try {
                // If connected to a DIFFERENT user, disconnect first
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
                    throw new Error(message || 'Failed to get chat token.');
                }

                const { token } = await response.json();

                // Increase timeout for slow networks
                client.options.timeout = 10000;

                // Connect the user
                await client.connectUser(
                    {
                        id: user.id,
                        name: user.name,
                        image: user.image,
                        ...(user.role && { role: user.role }),
                    },
                    token
                );

                connectionPromise = null; // Clear on success so it can be called again if needed
                return client;
            } catch (error: any) {
                console.warn(`Connection attempt failed (${retries} retries left):`, error);
                retries--;
                if (retries === 0) {
                    connectionPromise = null;
                    throw error;
                }
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
            }
        }
        connectionPromise = null;
        throw new Error('Failed to connect to chat after multiple attempts.');
    })();

    return connectionPromise;
};

export const disconnectStreamUser = async () => {
    if (chatClient) {
        await chatClient.disconnectUser();
        connectionPromise = null;
    }
};
