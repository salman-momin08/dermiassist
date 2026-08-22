"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Bot, Send, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { dermiAssistant, DermiAssistantOutput } from '@/ai/flows/dermi-assistant';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

interface Message {
    id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: string;
    action?: DermiAssistantOutput['action'];
    destination?: string;
}

const QUICK_SUGGESTIONS = [
    { label: "🔍 Check skin rash symptoms", prompt: "I have an itchy red rash with dry peeling skin. Can you help triage this?" },
    { label: "👨‍⚕️ Book a dermatologist", prompt: "How do I book an appointment with a board-certified dermatologist?" },
    { label: "🚨 Emergency red-flag signs", prompt: "What are the emergency red-flag skin symptoms that require immediate ER care?" },
    { label: "⚡ Understand AI confidence", prompt: "How does DermiAssist-AI calibrate confidence scores and citation grounding?" },
];

export function Chatbot() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init-1',
            sender: 'bot',
            text: "Hello! I'm **Dermi**, your clinical AI assistant. How can I assist with your skin health inquiries or platform navigation today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Dedicated autoscroll ref to guarantee bottom alignment
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { toast } = useToast();
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 150);
        }
    }, [isOpen]);

    const handleSend = async (messageToSend?: string) => {
        const currentInput = (messageToSend || input).trim();
        if (!currentInput || !user) {
            if (!user && !authLoading) {
                toast({
                    title: "Authentication Required",
                    description: "Please log in to consult DermiAssistant.",
                    variant: "destructive"
                });
                setIsOpen(false);
                router.push('/login');
            }
            return;
        }

        const userMessage: Message = {
            id: `usr-${Date.now()}`,
            sender: 'user',
            text: currentInput,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const historyString = newMessages
                .map(m => `${m.sender === 'bot' ? 'Assistant' : 'User'}: ${m.text}`)
                .join('\n');

            const result = await dermiAssistant({
                userId: user.id,
                userRole: role,
                command: currentInput,
                conversationHistory: historyString,
            });

            const botMessage: Message = {
                id: `bot-${Date.now()}`,
                sender: 'bot',
                text: result.response,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                action: result.action,
                destination: result.destination,
            };

            setMessages(prev => [...prev, botMessage]);

            if (result.action === 'navigate' && result.destination) {
                router.push(result.destination);
                setIsOpen(false);
            }
        } catch {
            const errorMessage: Message = {
                id: `err-${Date.now()}`,
                sender: 'bot',
                text: "I encountered a network timeout communicating with the clinical reasoning engine. Please try again.",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user && !authLoading) {
        return null;
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-105 active:scale-95"
                    size="icon"
                    aria-label="Open DermiAssistant AI Chatbot"
                >
                    <Bot className="h-7 w-7" />
                    <span className="sr-only">Open Assistant</span>
                </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col w-full sm:max-w-md p-0 h-[100dvh] border-l shadow-2xl">
                
                {/* Header */}
                <SheetHeader className="p-4 border-b bg-card flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Avatar className="h-9 w-9 border border-primary/20 bg-primary/10 text-primary">
                                <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                        </div>
                        <div>
                            <SheetTitle className="text-base font-bold font-headline leading-none">
                                DermiAssistant AI
                            </SheetTitle>
                            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                                Real-time clinical navigation & triage
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {/* Messages Scroll Area */}
                <ScrollArea className="flex-1 p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {messages.map((message) => {
                            const isUser = message.sender === 'user';
                            return (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "flex gap-3 items-end",
                                        isUser ? "justify-end" : "justify-start"
                                    )}
                                >
                                    {!isUser && (
                                        <Avatar className="h-7 w-7 bg-primary/10 text-primary flex-shrink-0 mb-1">
                                            <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div
                                        className={cn(
                                            "flex flex-col space-y-1 max-w-[82%]",
                                            isUser ? "items-end" : "items-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed",
                                                isUser
                                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                                    : "bg-muted/80 text-foreground border rounded-bl-none"
                                            )}
                                        >
                                            {message.text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                                                if (part.startsWith('**') && part.endsWith('**')) {
                                                    return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
                                                }
                                                return part;
                                            })}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground/70 px-1">
                                            {message.timestamp}
                                        </span>
                                    </div>
                                    {isUser && (
                                        <Avatar className="h-7 w-7 bg-muted flex-shrink-0 mb-1">
                                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            );
                        })}

                        {/* Loading Typing Indicator */}
                        {isLoading && (
                            <div className="flex items-center gap-3">
                                <Avatar className="h-7 w-7 bg-primary/10 text-primary flex-shrink-0">
                                    <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                <div className="rounded-2xl px-4 py-2.5 bg-muted/80 border rounded-bl-none flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span className="text-xs text-muted-foreground font-medium">Synthesizing clinical response...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Quick Suggestion Chips (when messages count is low) */}
                {messages.length <= 3 && !isLoading && (
                    <div className="px-4 py-2 border-t bg-muted/30">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium mb-1.5">
                            <Sparkles className="h-3 w-3 text-primary" />
                            Suggested Inquiries:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_SUGGESTIONS.map((chip, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSend(chip.prompt)}
                                    className="text-xs bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground border rounded-full px-2.5 py-1 transition-colors text-left"
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Input Area */}
                <SheetFooter className="p-3 border-t bg-card">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="flex w-full items-center gap-2"
                    >
                        <Input
                            ref={inputRef}
                            placeholder="Type a clinical symptom or question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading}
                            className="flex-1 rounded-full bg-muted/50 border-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-primary px-4 py-2 text-sm"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={isLoading || !input.trim()}
                            className="h-10 w-10 rounded-full flex-shrink-0 bg-primary text-primary-foreground shadow-md transition-all disabled:opacity-40"
                            aria-label="Send Message"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
