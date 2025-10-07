
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Bot, Send, User, Loader2, Mic, Upload, Volume2, VolumeX } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { dermiAssistant, DermiAssistantOutput } from '@/ai/flows/dermi-assistant';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { uploadFile } from '@/lib/actions';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


interface Message {
    sender: 'user' | 'bot';
    text: string;
    action?: DermiAssistantOutput['action'];
    data?: any;
    destination?: string;
}

const SpeechRecognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;


export function Chatbot() {
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'bot', text: "Hello! I'm Dermi, your personal AI assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [awaitingPhoto, setAwaitingPhoto] = useState(false);
    
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // Speech Recognition state
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [isListening, setIsListening] = useState(false);
    const finalTranscriptRef = useRef('');

    // Text-to-Speech & Speech Mode state
    const [speechMode, setSpeechMode] = useState(false);
    const [playingAudio, setPlayingAudio] = useState<{ audio: HTMLAudioElement; text: string } | null>(null);
    const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
    const [audioCache, setAudioCache] = useState<Record<string, string>>({});


    useEffect(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTo({
                top: scrollViewportRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);
    
    useEffect(() => {
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = '';
            finalTranscriptRef.current = '';
            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscriptRef.current += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setInput(finalTranscriptRef.current + interimTranscript);
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                 toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
            }
            setIsListening(false);
        };
        
        recognition.onend = () => {
            setIsListening(false);
            // Automatically send the message when the user stops talking
            if (finalTranscriptRef.current.trim()) {
                handleSend(finalTranscriptRef.current.trim());
            }
        };

        recognitionRef.current = recognition;
    }, [toast]);
    
    // Effect to automatically play new bot messages in speech mode
    useEffect(() => {
        if (speechMode && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.sender === 'bot' && !isLoading) {
                handlePlayMessageAudio(lastMessage.text);
            }
        }
    }, [messages, speechMode, isLoading]);

    const handleSend = async (messageToSend?: string, photoDataUri?: string) => {
        const currentInput = messageToSend || input;
        if ((!currentInput.trim() && !photoDataUri) || !user) {
            if (!user && !authLoading) {
                toast({ title: "Not logged in", description: "Please log in to use the assistant.", variant: "destructive"});
                setIsOpen(false);
                router.push('/login');
            }
            return;
        }

        const userMessage: Message = { sender: 'user', text: currentInput || "Sent an image for analysis" };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);
        setAwaitingPhoto(false);

        try {
            const historyString = newMessages.map(m => `${m.sender === 'bot' ? 'Assistant' : 'User'}: ${m.text}`).join('\n');
            
            const result = await dermiAssistant({ 
                userId: user.uid, 
                command: currentInput,
                conversationHistory: historyString,
                photoDataUri: photoDataUri 
            });

            const botMessage: Message = {
                sender: 'bot',
                text: result.response,
                action: result.action,
                data: result.data,
                destination: result.destination,
            };
            setMessages(prev => [...prev, botMessage]);

             if (result.action === 'navigate' || result.action === 'startProforma') {
                router.push(result.destination!);
                setIsOpen(false);
            } else if (result.action === 'awaiting_photo') {
                setAwaitingPhoto(true);
            }

        } catch (error) {
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I'm having trouble connecting. Please try again later." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleMicClick = useCallback(async () => {
        if (!SpeechRecognition) {
             toast({ title: "Unsupported", description: "Speech recognition is not supported in your browser.", variant: "destructive" });
             return;
        }
        
        // Turn on speech mode when mic is used for the first time
        if (!speechMode) setSpeechMode(true);

        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }
        
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'denied') {
                toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
                return;
            }
            
            // If we have permission or it's prompt, we can just start. The browser will handle the prompt.
            setInput('');
            finalTranscriptRef.current = '';
            recognitionRef.current?.start();
            setIsListening(true);
            
        } catch (err) {
            // Fallback for browsers that don't support permissions.query
            console.error("Permission query failed, falling back to direct start:", err);
            setInput('');
            finalTranscriptRef.current = '';
            recognitionRef.current?.start();
            setIsListening(true);
        }
    }, [isListening, toast, speechMode]);
    
     const handleOpenAndListen = useCallback(() => {
        setIsOpen(true);
        // We need a slight delay to allow the sheet to animate open before starting recognition
        setTimeout(() => {
            handleMicClick();
        }, 300);
    }, [handleMicClick]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
                event.preventDefault();
                if (isOpen) {
                    setIsOpen(false);
                } else {
                    handleOpenAndListen();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleOpenAndListen]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUri = reader.result as string;
            handleSend("Here is the photo for the analysis.", dataUri);
          };
          reader.readAsDataURL(file);
        }
    };

    const handleSelectAction = (cb: () => void) => {
      cb();
      setIsOpen(false);
    }
    
    const handlePlayMessageAudio = useCallback(async (text: string) => {
        if (playingAudio && playingAudio.text === text) {
            playingAudio.audio.pause();
            setPlayingAudio(null);
            return;
        }
        if (playingAudio) {
            playingAudio.audio.pause();
        }

        const onEnded = () => setPlayingAudio(null);

        if (audioCache[text]) {
            const audio = new Audio(audioCache[text]);
            setPlayingAudio({ audio, text });
            audio.play();
            audio.onended = onEnded;
            return;
        }

        setIsAudioLoading(text);
        try {
            const { audioBase64 } = await textToSpeech({ text });
            const uploadResult = await uploadFile(null, audioBase64);
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.message || "Audio upload failed.");
            }
            setAudioCache(prev => ({...prev, [text]: uploadResult.url!}));
            const audio = new Audio(uploadResult.url);
            setPlayingAudio({ audio, text });
            audio.play();
            audio.onended = onEnded;
        } catch (error) {
            console.error("Failed to play audio:", error);
            toast({ title: "Audio Error", description: "Could not play the message audio.", variant: "destructive" });
        } finally {
            setIsAudioLoading(null);
        }
    }, [audioCache, playingAudio, toast]);

    // Hide chatbot if user is not logged in.
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
                             <Bot className="text-primary"/>
                             DermiAssistant
                         </div>
                         <div className="flex items-center space-x-2">
                            <TooltipProvider>
                               <Tooltip>
                                  <TooltipTrigger asChild>
                                     <Label htmlFor="speech-mode" className="flex items-center gap-2 cursor-pointer">
                                        <Volume2 className="h-4 w-4" />
                                     </Label>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                     <p>Enable Speech Mode to hear AI responses automatically.</p>
                                  </TooltipContent>
                               </Tooltip>
                            </TooltipProvider>
                            <Switch
                               id="speech-mode"
                               checked={speechMode}
                               onCheckedChange={setSpeechMode}
                            />
                         </div>
                    </SheetTitle>
                    <SheetDescription>
                        Your personal AI assistant. Press Ctrl+M to toggle.
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
                                         {message.sender === 'bot' && (
                                          <div className="flex justify-end mt-1">
                                              <Button size="icon" variant="ghost" className={cn("h-6 w-6 shrink-0", playingAudio?.text === message.text && "text-primary")} onClick={() => handlePlayMessageAudio(message.text)} disabled={isAudioLoading === message.text}>
                                                  {isAudioLoading === message.text ? <Loader2 className="h-4 w-4 animate-spin"/> : playingAudio?.text === message.text ? <VolumeX className="h-4 w-4"/> : <Volume2 className="h-4 w-4" />}
                                              </Button>
                                          </div>
                                        )}
                                    </div>
                                    {message.sender === 'user' && (
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback><User size={18} /></AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                                {message.action === 'showAnalyses' && message.data && (
                                    <div className="space-y-2 mt-2 ml-11">
                                        {message.data.map((report: any) => (
                                            <Button key={report.id} variant="outline" size="sm" className="w-full justify-start" onClick={() => handleSelectAction(() => router.push(`/my-analyses/${report.id}`))}>
                                                View report for {report.conditionName} from {format(new Date(report.date), "MMM d, yyyy")}
                                            </Button>
                                        ))}
                                    </div>
                                )}
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
                            placeholder={isListening ? "Listening..." : "Type a message or command..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />
                         {awaitingPhoto && (
                            <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                                <Upload className="h-4 w-4" />
                            </Button>
                         )}
                         <Button size="icon" variant={isListening ? 'destructive' : 'outline'} onClick={handleMicClick} disabled={isLoading}>
                            <Mic className="h-4 w-4" />
                            <span className="sr-only">Use Microphone</span>
                        </Button>
                        <Button size="icon" onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </div>
                </SheetFooter>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </SheetContent>
        </Sheet>
    );
}

    
