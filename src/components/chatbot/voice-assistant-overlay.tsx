
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dermiAssistant } from '@/ai/flows/dermi-assistant';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { uploadFile } from '@/lib/actions';
import { Button } from '@/components/ui/button';

const SpeechRecognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceAssistantOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();

    const [status, setStatus] = useState<AssistantStatus>('idle');
    const [conversationHistory, setConversationHistory] = useState<string>('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioQueueRef = useRef<HTMLAudioElement[]>([]);
    const isPlayingRef = useRef(false);

    const processAudioQueue = useCallback(() => {
        if (isPlayingRef.current || audioQueueRef.current.length === 0) {
            return;
        }
        isPlayingRef.current = true;
        setStatus('speaking');
        const audio = audioQueueRef.current.shift();
        if (audio) {
            audio.play();
            audio.onended = () => {
                isPlayingRef.current = false;
                if (audioQueueRef.current.length === 0) {
                     // After speaking, go back to listening
                    startListening();
                } else {
                    processAudioQueue();
                }
            };
        }
    }, []);

    const speak = useCallback(async (text: string) => {
        try {
            const { audioBase64 } = await textToSpeech({ text });
            const uploadResult = await uploadFile(null, audioBase64);
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.message || "Audio upload failed.");
            }
            const audio = new Audio(uploadResult.url);
            audioQueueRef.current.push(audio);
            processAudioQueue();
        } catch (error) {
            console.error("TTS Error:", error);
            toast({ title: "Speech Error", description: "Could not generate audio response.", variant: "destructive" });
            // If TTS fails, go back to listening
            startListening();
        }
    }, [processAudioQueue, toast]);
    
    const startListening = useCallback(() => {
        if (recognitionRef.current && status !== 'listening') {
             try {
                recognitionRef.current.start();
                setStatus('listening');
            } catch (e) {
                // Already started
            }
        }
    }, [status]);


    useEffect(() => {
        if (!open) return;
        if (!SpeechRecognition) {
            toast({ title: "Browser Not Supported", description: "Voice recognition is not available in your browser.", variant: "destructive" });
            onOpenChange(false);
            return;
        }

        // Greet the user on open
        speak("Hello! Dermi is here. How can I assist you?");

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // We want to process after each phrase
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = async (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0][0].transcript;
            setStatus('processing');

            const newUserTurn = `User: ${transcript}\n`;
            setConversationHistory(prev => prev + newUserTurn);

            if (!user) {
                toast({ title: "Please Log In", description: "You need to be logged in to use the voice assistant.", variant: "destructive"});
                speak("I'm sorry, but you need to be logged in for me to help with that.");
                return;
            }

            try {
                const result = await dermiAssistant({
                    userId: user.uid,
                    command: transcript,
                    conversationHistory: conversationHistory + newUserTurn
                });
                
                const newBotTurn = `Assistant: ${result.response}\n`;
                setConversationHistory(prev => prev + newBotTurn);

                await speak(result.response);
                
                if(result.action === 'navigate' || result.action === 'startProforma') {
                    router.push(result.destination!);
                    onOpenChange(false); // Close the overlay on navigation
                }

            } catch (err) {
                console.error("DermiAssistant Error:", err);
                await speak("I'm sorry, I encountered an error. Please try again.");
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error !== 'no-speech') {
                console.error('Speech recognition error:', event.error);
            }
            // After an error, restart listening
            startListening();
        };
        
        recognition.onend = () => {
             if (status === 'listening') {
                // If it ends while still supposed to be listening, restart it
                startListening();
            }
        };
        
        recognitionRef.current = recognition;
        startListening();

        return () => {
            recognition.stop();
            audioQueueRef.current.forEach(audio => audio.pause());
            audioQueueRef.current = [];
        };
    }, [open, user, toast, router, onOpenChange, speak, conversationHistory, startListening, status]);


    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
                    style={{ backdropFilter: 'blur(8px)' }}
                >
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="relative"
                    >
                        <Blob status={status} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Mic className="h-16 w-16 text-white" />
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.5 } }}
                        className="absolute bottom-10 text-white/70 text-lg font-medium"
                    >
                        {status === 'listening' && "Listening..."}
                        {status === 'processing' && "Thinking..."}
                        {status === 'speaking' && "Speaking..."}
                        {status === 'idle' && "Initializing..."}
                    </motion.div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="absolute top-6 right-6 text-white/50 hover:text-white h-12 w-12 rounded-full"
                    >
                        <X className="h-8 w-8" />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}


function Blob({ status }: { status: AssistantStatus }) {
    const scale = status === 'listening' || status === 'speaking' ? 1.1 : 1;
    const opacity = status === 'listening' || status === 'speaking' ? 1 : 0.8;
    const duration = status === 'listening' ? 1.5 : 0.5;

    return (
        <motion.div
            animate={{ scale, opacity }}
            transition={{ type: 'spring', stiffness: 100, damping: 10 }}
        >
            <svg
                viewBox="0 0 400 400"
                className="h-64 w-64 md:h-80 md:w-80"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#c026d3', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#a855f7', stopOpacity: 1 }} />
                    </linearGradient>
                </defs>
                <motion.path
                    fill="url(#gradient)"
                    d="M 210.43,26.79 C 238.16,35.48 248.83,57.17 266.2,74.55 C 285.34,93.69 313.17,105.73 318.52,134.75 C 323.87,163.77 306.74,189.73 293.43,215.17 C 278.4,243.43 267.19,271.17 243.43,284.48 C 219.68,297.79 183.38,296.67 155.22,286.43 C 127.06,276.19 107.04,256.83 89.28,235.21 C 69.76,211.83 52.49,186.2 52.49,157.06 C 52.49,127.92 69.76,95.66 85.72,71.14 C 101.68,46.62 116.32,29.84 140.28,21.7 C 164.24,13.56 182.7,18.1 210.43,26.79 Z"
                >
                    <animate
                        attributeName="d"
                        dur={`${duration}s`}
                        repeatCount="indefinite"
                        values={
                            status === 'listening' ?
                            "M 210.43,26.79 C 238.16,35.48 248.83,57.17 266.2,74.55 C 285.34,93.69 313.17,105.73 318.52,134.75 C 323.87,163.77 306.74,189.73 293.43,215.17 C 278.4,243.43 267.19,271.17 243.43,284.48 C 219.68,297.79 183.38,296.67 155.22,286.43 C 127.06,276.19 107.04,256.83 89.28,235.21 C 69.76,211.83 52.49,186.2 52.49,157.06 C 52.49,127.92 69.76,95.66 85.72,71.14 C 101.68,46.62 116.32,29.84 140.28,21.7 C 164.24,13.56 182.7,18.1 210.43,26.79 Z;M 206.83,30.34 C 229.43,36.56 250.77,56.57 266.2,74.55 C 282.9,94.29 293.71,111.99 303.49,134.75 C 313.27,157.51 322.02,185.34 311.95,208.5 C 301.88,231.66 273.0,250.15 249.52,261.56 C 226.04,272.97 207.96,277.3 184.28,276.08 C 160.6,274.86 131.32,268.09 109.79,252.68 C 88.26,237.27 74.48,213.22 66.62,187.9 C 58.76,162.58 56.83,135.99 64.92,111.43 C 73.01,86.87 91.12,64.34 111.43,51.83 C 131.74,39.32 154.24,36.83 176.71,34.02 C 199.18,31.21 184.23,24.12 206.83,30.34 Z;M 210.43,26.79 C 238.16,35.48 248.83,57.17 266.2,74.55 C 285.34,93.69 313.17,105.73 318.52,134.75 C 323.87,163.77 306.74,189.73 293.43,215.17 C 278.4,243.43 267.19,271.17 243.43,284.48 C 219.68,297.79 183.38,296.67 155.22,286.43 C 127.06,276.19 107.04,256.83 89.28,235.21 C 69.76,211.83 52.49,186.2 52.49,157.06 C 52.49,127.92 69.76,95.66 85.72,71.14 C 101.68,46.62 116.32,29.84 140.28,21.7 C 164.24,13.56 182.7,18.1 210.43,26.79 Z"
                            : "M 210.43,26.79 C 238.16,35.48 248.83,57.17 266.2,74.55 C 285.34,93.69 313.17,105.73 318.52,134.75 C 323.87,163.77 306.74,189.73 293.43,215.17 C 278.4,243.43 267.19,271.17 243.43,284.48 C 219.68,297.79 183.38,296.67 155.22,286.43 C 127.06,276.19 107.04,256.83 89.28,235.21 C 69.76,211.83 52.49,186.2 52.49,157.06 C 52.49,127.92 69.76,95.66 85.72,71.14 C 101.68,46.62 116.32,29.84 140.28,21.7 C 164.24,13.56 182.7,18.1 210.43,26.79 Z"
                        }
                    />
                </motion.path>
            </svg>
        </motion.div>
    );
}
