
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Mic, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dermiAssistant } from '@/ai/flows/dermi-assistant';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { uploadFile } from '@/lib/actions';
import { AnimatedCharacter } from './animated-character';
import { Button } from '../ui/button';

type VoiceAssistantStatus = 'idle' | 'listening' | 'processing' | 'speaking';
type ConversationTurn = {
    speaker: 'user' | 'bot';
    text: string;
};

interface VoiceAssistantOverlayProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const SpeechRecognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export function VoiceAssistantOverlay({ open, onOpenChange }: VoiceAssistantOverlayProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [status, setStatus] = useState<VoiceAssistantStatus>('idle');
    const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioQueueRef = useRef<HTMLAudioElement[]>([]);
    const isMountedRef = useRef(false);

    const speak = useCallback(async (text: string) => {
        if (!text) return;
        try {
            setStatus('speaking');
            const { audioBase64 } = await textToSpeech({ text });
            const uploadResult = await uploadFile(null, audioBase64);

            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.message || "Audio upload failed.");
            }

            return new Promise<void>((resolve, reject) => {
                if (!isMountedRef.current) return reject(new Error("Component unmounted"));

                const audio = new Audio(uploadResult.url);
                audio.onended = () => {
                     if (isMountedRef.current) {
                        resolve();
                    }
                };
                audio.onerror = (e) => {
                    console.error("Audio playback error:", e);
                    if (isMountedRef.current) {
                        // Don't reject, just resolve to continue the loop
                        resolve();
                    }
                }
                audio.play();
            });
        } catch (error) {
            console.error("TTS or upload error:", error);
            // Don't reject, just resolve to continue the loop
            setStatus('idle');
            return Promise.resolve();
        }
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && status !== 'listening' && isMountedRef.current) {
            try {
                recognitionRef.current.start();
                setStatus('listening');
                setTranscript('');
            } catch (e) {
                console.error("Recognition start error:", e);
                // If it fails to start, go back to idle.
                if (isMountedRef.current) setStatus('idle');
            }
        }
    }, [status]);


    useEffect(() => {
        isMountedRef.current = true;
        if (!open) return;

        if (!SpeechRecognition) {
            toast({ title: "Unsupported", description: "Your browser does not support speech recognition.", variant: "destructive" });
            onOpenChange(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognitionRef.current = recognition;
        
        let initialGreetingSaid = false;

        const handleOpen = async () => {
            if (initialGreetingSaid || !isMountedRef.current) return;
            initialGreetingSaid = true;
            
            await speak("Hello! I'm Dermi, your personal voice assistant. How can I help you?");
            
            if(isMountedRef.current) {
                startListening();
            }
        };

        handleOpen();
        
        recognition.onresult = (event) => {
            let interim = '';
            let final = '';
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            if (isMountedRef.current) setTranscript(interim);
             if (final && isMountedRef.current) {
                processCommand(final);
            }
        };

        recognition.onend = () => {
            if (isMountedRef.current && status === 'listening') {
                 // If recognition ends prematurely and we were still listening, go back to idle.
                setStatus('idle');
            }
        };
        
        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
             if (isMountedRef.current) setStatus('idle');
        };

        return () => {
             isMountedRef.current = false;
             if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
             }
        };

    }, [open, onOpenChange, toast, speak, startListening]);


    const processCommand = async (command: string) => {
        if (!user || !command.trim()) {
            startListening();
            return;
        }

        setStatus('processing');
        const newUserTurn: ConversationTurn = { speaker: 'user', text: command };
        setConversationHistory(prev => [...prev, newUserTurn]);

        try {
            const historyString = [...conversationHistory, newUserTurn].map(t => `${t.speaker}: ${t.text}`).join('\n');
            const result = await dermiAssistant({
                userId: user.uid,
                command: command,
                conversationHistory: historyString,
            });

            if (!isMountedRef.current) return;

            const newBotTurn: ConversationTurn = { speaker: 'bot', text: result.response };
            setConversationHistory(prev => [...prev, newBotTurn]);

            await speak(result.response);
            
            if (!isMountedRef.current) return;
            
            if (result.action === 'navigate' || result.action === 'startProforma') {
                router.push(result.destination!);
                onOpenChange(false);
            } else {
                startListening();
            }

        } catch (error) {
            console.error("Assistant error:", error);
            if (!isMountedRef.current) return;
            
            const errorResponse = "I'm sorry, I encountered an error. Please try again.";
            setConversationHistory(prev => [...prev, { speaker: 'bot', text: errorResponse }]);
            await speak(errorResponse);

            if (isMountedRef.current) startListening();
        }
    };


    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-lg flex flex-col"
                >
                    <div className="absolute top-4 right-4">
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                        <div className="w-48 h-48">
                           <AnimatedCharacter status={status} />
                        </div>
                        <div className="text-center mt-8 space-y-2">
                             <p className="text-2xl font-medium">
          ===================================
          ;.                      {status === 'listening' && (transcript || 'Listening...')}
                                {status === 'processing' && 'Thinking...'}
                                {status === 'speaking' && 'Speaking...'}
                                {status === 'idle' && 'Click the mic to start'}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {status === 'listening' ? 'I am ready for your command.' : '...'}
                            </p>
                        </div>
                    </div>

                     <div className="flex-shrink-0 h-48 p-4 overflow-hidden">
                        <div className="h-full w-full max-w-2xl mx-auto flex flex-col-reverse gap-4">
                             {conversationHistory.slice(-3).reverse().map((turn, index) => (
                                <motion.div
                                    key={conversationHistory.length - index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-start gap-3 ${turn.speaker === 'user' ? 'justify-end' : ''}`}
                                >
                                     {turn.speaker === 'bot' && (
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                                            <Bot size={18} />
                                        </div>
                                    )}
                                    <div className={`rounded-lg px-4 py-2 max-w-[80%] ${turn.speaker === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        <p className="text-sm">{turn.text}</p>
                                    </div>
                                    {turn.speaker === 'user' && (
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                            <User size={18} />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </motion.div>
            )}
        </AnimatePresence>
    );
}

