
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dermiAssistant } from '@/ai/flows/dermi-assistant';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { uploadFile } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

const SpeechRecognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceAssistantOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();

    const [status, setStatus] = useState<AssistantStatus>('idle');
    const conversationHistoryRef = useRef<string>('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioQueueRef = useRef<HTMLAudioElement[]>([]);
    const isPlayingRef = useRef(false);
    const audioCacheRef = useRef<Record<string, string>>({});
    const isMountedRef = useRef(true);


    const startListening = useCallback(() => {
        if (recognitionRef.current && status !== 'listening' && isMountedRef.current) {
             try {
                recognitionRef.current.start();
                setStatus('listening');
            } catch (e) {
                // Already started, this can happen in some edge cases
            }
        }
    }, [status]);
    
    const processAudioQueue = useCallback(() => {
        if (isPlayingRef.current || audioQueueRef.current.length === 0) {
            return;
        }
        isPlayingRef.current = true;
        setStatus('speaking');

        const audio = audioQueueRef.current.shift();
        if (audio) {
            audio.play().catch(e => {
                console.error("Audio playback failed:", e);
                isPlayingRef.current = false;
                startListening(); 
            });

            audio.onended = () => {
                isPlayingRef.current = false;
                if (audioQueueRef.current.length === 0) {
                    startListening();
                } else {
                    processAudioQueue();
                }
            };
        }
    }, [startListening]);

    const speak = useCallback(async (text: string) => {
        if (audioCacheRef.current[text]) {
            const audio = new Audio(audioCacheRef.current[text]);
            audioQueueRef.current.push(audio);
            processAudioQueue();
            return;
        }

        try {
            const { audioBase64 } = await textToSpeech({ text });
            const uploadResult = await uploadFile(null, audioBase64);
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.message || "Audio upload failed.");
            }
            
            audioCacheRef.current[text] = uploadResult.url;

            const audio = new Audio(uploadResult.url);
            audioQueueRef.current.push(audio);
            processAudioQueue();
        } catch (error) {
            console.error("TTS Error:", error);
            if (error instanceof Error && (error.message.includes('429') || error.message.includes('rate limit'))) {
                console.warn("TTS rate limit exceeded. Conversation will continue without audio for this turn.");
            } else {
                toast({ title: "Speech Error", description: "Could not generate audio response.", variant: "destructive" });
            }
            // Continue listening even if TTS fails
            startListening();
        }
    }, [processAudioQueue, toast, startListening]);
    
    // This effect runs ONLY ONCE when the component opens.
    // It sets up the speech recognition and speaks the initial greeting.
    useEffect(() => {
        if (!open) return;
        
        isMountedRef.current = true;

        if (!SpeechRecognition) {
            toast({ title: "Browser Not Supported", description: "Voice recognition is not available in your browser.", variant: "destructive" });
            onOpenChange(false);
            return;
        }

        speak("Hello! Dermi is here. How can I assist you?");

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = async (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0][0].transcript;
            setStatus('processing');

            const newUserTurn = `User: ${transcript}\n`;
            conversationHistoryRef.current += newUserTurn;

            if (!user) {
                toast({ title: "Please Log In", description: "You need to be logged in to use the voice assistant.", variant: "destructive"});
                await speak("I'm sorry, but you need to be logged in for me to help with that.");
                return;
            }

            try {
                const result = await dermiAssistant({
                    userId: user.uid,
                    command: transcript,
                    conversationHistory: conversationHistoryRef.current
                });
                
                const newBotTurn = `Assistant: ${result.response}\n`;
                conversationHistoryRef.current += newBotTurn;

                await speak(result.response);
                
                if(result.action === 'navigate' || result.action === 'startProforma') {
                    router.push(result.destination!);
                    onOpenChange(false);
                }

            } catch (err) {
                console.error("DermiAssistant Error:", err);
                await speak("I'm sorry, I encountered an error. Please try again.");
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.error('Speech recognition error:', event.error);
            }
             // Always try to restart listening unless the component is unmounting.
            if(isMountedRef.current) {
                startListening();
            }
        };
        
        recognition.onend = () => {
            // The 'onend' event can fire for many reasons. We only want to restart listening
            // if we are in the 'listening' state, meaning it ended naturally, not because we are processing.
            if (status === 'listening' && isMountedRef.current) {
                startListening();
            }
        };
        
        recognitionRef.current = recognition;
        // The initial `startListening` is now triggered by the `onended` of the initial greeting.

        // Cleanup function
        return () => {
            isMountedRef.current = false;
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
            }
            audioQueueRef.current.forEach(audio => {
                audio.pause();
                audio.onended = null;
            });
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            conversationHistoryRef.current = '';
        };
    // The dependency array is key. This effect only re-runs if `open` changes.
    // All other functions are stable thanks to useCallback.
    }, [open, user, toast, router, onOpenChange, speak, startListening, status]);


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
                        <AnimatedCharacter status={status} />
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

const AnimatedCharacter = ({ status }: { status: AssistantStatus }) => {
    const isListening = status === 'listening';
    const isSpeaking = status === 'speaking';

    const speakingAnimation = {
        y: ["0%", "-5%", "0%"],
        transition: {
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
        },
    };

    return (
        <motion.div
            className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden shadow-2xl border-4 border-white/20"
            animate={{ scale: isListening ? 1.05 : 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
            <motion.div
                className="w-full h-full"
                animate={isSpeaking ? speakingAnimation : { y: "0%" }}
            >
                <Image
                    src="/character.png"
                    alt="Voice Assistant Character"
                    width={320}
                    height={320}
                    className="w-full h-full object-cover"
                />
            </motion.div>
            <motion.div
                className="absolute inset-0 bg-primary/20"
                animate={{
                    opacity: isListening ? [0.1, 0.4, 0.1] : 0,
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
        </motion.div>
    );
};
