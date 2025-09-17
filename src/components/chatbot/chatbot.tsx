
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Bot, Send, User, Loader2, Mic } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { chatbotFAQ } from '@/ai/flows/chatbot-faq';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';


interface Message {
    sender: 'user' | 'bot';
    text: string;
}

// Check for window object to avoid SSR errors with SpeechRecognition
const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;


export function Chatbot() {
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'bot', text: "Hello! I'm the DermiAssist-AI assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // State for speech recognition
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);


    useEffect(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTo({
                top: scrollViewportRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);
    
    // Setup Speech Recognition
    useEffect(() => {
        if (!SpeechRecognition) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // We want it to stop when the user pauses
        recognition.interimResults = true; // Show results as they are being recognized
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            setInput(transcript);
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                setIsListening(false);
                return;
            }

            if (event.error === 'not-allowed') {
                 setPermissionDenied(true);
                 toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
            } else {
                toast({ title: "Speech Error", description: `An error occurred: ${event.error}`, variant: "destructive" });
            }
            setIsListening(false);
        };
        
        recognition.onend = () => {
            setIsListening(false);
            // Auto-send the message once recognition ends, if there's content
            if (input.trim()) {
                handleSend();
            }
        };

        recognitionRef.current = recognition;

    }, [toast, input]); // Add input to dependency array to re-create `onend` with the latest `input` value


    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = { sender: 'user', text: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const history = newMessages.map(m => `${m.sender === 'bot' ? 'AI' : 'User'}: ${m.text}`).join('\n');
            const response = await chatbotFAQ({ 
                question: input,
                conversationHistory: history,
            });
            const botMessage: Message = { sender: 'bot', text: response.answer };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I'm having trouble connecting. Please try again later." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const startRecognition = () => {
        if (recognitionRef.current) {
            try {
                setInput(''); // Clear input before starting
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Could not start recognition (already started?):", e);
                setIsListening(false);
            }
        }
    }

    const handleMicClick = async () => {
        if (!recognitionRef.current) {
            toast({ title: "Unsupported", description: "Speech recognition is not supported in your browser.", variant: "destructive" });
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            return;
        }
        
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'denied') {
                setPermissionDenied(true);
                toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
                return;
            }
            if (permissionStatus.state === 'prompt') {
                setShowPermissionDialog(true);
                return;
            }
            
            startRecognition();

        } catch (err) {
            console.error("Error checking microphone permissions:", err);
            // Fallback for browsers that don't support query
            startRecognition();
        }
    };
    
    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg z-50"
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
                        DermiAssist-AI Assistant
                    </SheetTitle>
                    <SheetDescription>
                        Ask me anything about skin conditions or how to use the platform.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-grow my-4 pr-4 -mr-6" viewportRef={scrollViewportRef}>
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
                            placeholder="Type or click the mic to talk..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />
                         <Button size="icon" variant={isListening ? 'destructive' : 'outline'} onClick={handleMicClick} disabled={isLoading}>
                            <Mic className="h-4 w-4" />
                            <span className="sr-only">Use Microphone</span>
                        </Button>
                        <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </div>
                </SheetFooter>
                
                 <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Microphone Access</AlertDialogTitle>
                            <AlertDialogDescription>
                                DermiAssist-AI needs access to your microphone to enable the speech-to-text feature. Click Continue to allow access in the upcoming browser prompt.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { startRecognition(); setShowPermissionDialog(false); }}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </SheetContent>
        </Sheet>
    );
}
