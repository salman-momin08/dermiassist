
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Bot, Send, User, Loader2, Upload } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { dermiAssistant, DermiAssistantOutput } from '@/ai/flows/dermi-assistant';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';


interface Message {
    sender: 'user' | 'bot';
    text: string;
    action?: DermiAssistantOutput['action'];
    destination?: string;
}



export function Chatbot() {
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'bot', text: "Hello! I'm Dermi, your personal AI assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);




    const scrollViewportRef = useRef<HTMLDivElement>(null);

    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();



    useEffect(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTo({
                top: scrollViewportRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);




    const handleSend = async (messageToSend?: string) => {
        const currentInput = messageToSend || input;
        if (!currentInput.trim() || !user) {
            if (!user && !authLoading) {
                toast({ title: "Not logged in", description: "Please log in to use the assistant.", variant: "destructive" });
                setIsOpen(false);
                router.push('/login');
            }
            return;
        }

        const userMessage: Message = { sender: 'user', text: currentInput };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const historyString = newMessages.map(m => `${m.sender === 'bot' ? 'Assistant' : 'User'}: ${m.text}`).join('\n');

            const result = await dermiAssistant({
                userId: user.id,
                command: currentInput,
                conversationHistory: historyString,
            });

            const botMessage: Message = {
                sender: 'bot',
                text: result.response,
                action: result.action,
                destination: result.destination,
            };
            setMessages(prev => [...prev, botMessage]);

            if (result.action === 'navigate') {
                router.push(result.destination!);
                setIsOpen(false);
            }

        } catch (error) {
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I'm having trouble connecting. Please try again later." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };








    const handleSelectAction = (cb: () => void) => {
        cb();
        setIsOpen(false);
    }

    if (!user && !authLoading) {
        return null;
    }

    return (

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg z-50"
                    size="icon"
                >
                    <Bot className="h-8 w-8" />
                    <span className="sr-only">Open Assistant</span>
                </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
                <SheetHeader>
                    <SheetTitle className="flex items-center justify-between font-headline">
                        <div className="flex items-center gap-2">
                            <Bot className="text-primary" />
                            DermiAssistant
                        </div>

                    </SheetTitle>
                    <SheetDescription>
                        Your personal AI assistant.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-grow my-4 pr-4 -mr-6" viewportRef={scrollViewportRef}>
                    <div className="space-y-4">
                        {messages.map((message, index) => (
                            <div key={index}>
                                <div className={cn("flex items-start gap-3", message.sender === 'user' ? 'justify-end' : '')}>
                                    {message.sender === 'bot' && (
                                        <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                            <AvatarFallback><Bot size={18} /></AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={cn("rounded-lg px-4 py-2 max-w-[80%]", message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                        <p className="text-sm" dangerouslySetInnerHTML={{ __html: message.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                    </div>
                                    {message.sender === 'user' && (
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback><User size={18} /></AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>

                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                    <AvatarFallback><Bot size={18} /></AvatarFallback>
                                </Avatar>
                                <div className="rounded-lg px-4 py-2 bg-muted flex items-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <SheetFooter>
                    <div className="flex w-full items-center space-x-2">
                        <Input
                            placeholder={"Type a message or command..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />


                        <Button size="icon" onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </div>
                </SheetFooter>

            </SheetContent>
        </Sheet>
    );
}
