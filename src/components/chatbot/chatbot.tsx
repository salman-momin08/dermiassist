
"use client";

import { useState, useRef, useEffect, useCallback, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Bot, Send, User, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { chatbotFAQ } from '@/ai/flows/chatbot-faq';
import { cn } from '@/lib/utils';

interface Message {
    sender: 'user' | 'bot';
    text: string;
}

export function Chatbot() {
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'bot', text: "Hello! I'm the SkinWise assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Draggable state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isMounted, setIsMounted] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const isDraggingRef = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
      setIsMounted(true);
      setPosition({ x: window.innerWidth - 88, y: window.innerHeight - 88 });
    }, []);

    const handleMouseDown = useCallback((e: MouseEvent<HTMLButtonElement>) => {
        if (triggerRef.current) {
            isDraggingRef.current = true;
            dragStartPos.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y
            };
            triggerRef.current.style.cursor = 'grabbing';
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
    }, [position]);

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (isDraggingRef.current) {
            setPosition({
                x: e.clientX - dragStartPos.current.x,
                y: e.clientY - dragStartPos.current.y
            });
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        if (triggerRef.current) {
            triggerRef.current.style.cursor = 'grab';
        }
        // Use a timeout to reset dragging state, allowing the click event to be suppressed
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 0);
    }, [handleMouseMove]);
    
    const handleClick = useCallback(() => {
        if (!isDraggingRef.current) {
            setIsOpen(true);
        }
    }, []);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await chatbotFAQ({ question: input });
            const botMessage: Message = { sender: 'bot', text: response.answer };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I'm having trouble connecting. Please try again later." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isMounted) {
        return null; // Don't render until the client has mounted and we know the window size
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    ref={triggerRef}
                    onMouseDown={handleMouseDown}
                    onClick={handleClick}
                    className="fixed h-16 w-16 rounded-full shadow-lg z-50"
                    style={{
                        top: 0,
                        left: 0,
                        transform: `translate(${position.x}px, ${position.y}px)`,
                        cursor: 'grab',
                    }}
                    size="icon"
                >
                    <Bot className="h-8 w-8" />
                    <span className="sr-only">Open Chatbot</span>
                </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 font-headline">
                        <Bot className="text-primary"/>
                        SkinWise Assistant
                    </SheetTitle>
                    <SheetDescription>
                        Ask me anything about skin conditions or how to use the platform.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-grow my-4 pr-4 -mr-6">
                    <div className="space-y-4">
                        {messages.map((message, index) => (
                             <div key={index} className={cn("flex items-start gap-3", message.sender === 'user' ? 'justify-end' : '')}>
                                {message.sender === 'bot' && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback><Bot /></AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn("rounded-lg px-4 py-2 max-w-[80%]", message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                    <p className="text-sm">{message.text}</p>
                                </div>
                                {message.sender === 'user' && (
                                     <Avatar className="h-8 w-8">
                                        <AvatarFallback><User /></AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                         {isLoading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><Bot /></AvatarFallback>
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
                            placeholder="Type your question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />
                        <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
