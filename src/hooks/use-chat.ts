
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { uploadFile } from '@/lib/actions'; // Assuming you have an uploadFile action

export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    text?: string;
    imageUrl?: string;
    timestamp: any;
}

export function useChat(user1Id: string | undefined, user2Id: string | undefined) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [chatId, setChatId] = useState<string | null>(null);

    useEffect(() => {
        if (!user1Id || !user2Id) {
            setMessages([]);
            setIsLoadingMessages(false);
            setChatId(null);
            return;
        }

        // Create a consistent chat ID by sorting participant IDs
        const newChatId = [user1Id, user2Id].sort().join('_');
        setChatId(newChatId);

    }, [user1Id, user2Id]);
    
    useEffect(() => {
        if (!chatId) return;

        setIsLoadingMessages(true);
        const messagesColRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesColRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const chatMessages = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Message));
            setMessages(chatMessages);
            setIsLoadingMessages(false);
        }, (error) => {
            console.error("Error fetching messages:", error);
            setIsLoadingMessages(false);
        });

        return () => unsubscribe();
    }, [chatId]);

    const sendMessage = useCallback(async (text: string, imageDataUri?: string | null) => {
        if (!chatId || !user1Id) { // user1Id is the sender in this hook's context
            console.error("Cannot send message: chat or user not initialized.");
            return;
        }
        
        let imageUrl: string | undefined = undefined;
        if (imageDataUri) {
            try {
                // Convert data URI to blob/file
                const response = await fetch(imageDataUri);
                const blob = await response.blob();
                const file = new File([blob], "chat-image.png", { type: blob.type });

                const formData = new FormData();
                formData.append('file', file);
                const uploadResult = await uploadFile(formData);

                if (uploadResult.success && uploadResult.url) {
                    imageUrl = uploadResult.url;
                } else {
                    throw new Error(uploadResult.message || 'Image upload failed');
                }
            } catch (error) {
                console.error("Failed to upload image:", error);
                // Optionally notify user
                return;
            }
        }
        
        const messagesColRef = collection(db, 'chats', chatId, 'messages');
        const chatDocRef = doc(db, 'chats', chatId);

        try {
            await addDoc(messagesColRef, {
                senderId: user1Id,
                text: text || null,
                imageUrl: imageUrl || null,
                timestamp: serverTimestamp(),
            });
            // Also set a document on the chat itself to ensure it exists for queries
             await addDoc(collection(db, 'chats'), {
                participants: [user1Id, user2Id],
                lastMessage: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error sending message:", error);
        }

    }, [chatId, user1Id, user2Id]);

    return { messages, sendMessage, isLoadingMessages, chatId };
}
