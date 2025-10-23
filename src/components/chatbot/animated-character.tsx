
"use client";

import { motion } from 'framer-motion';

type AnimatedCharacterProps = {
  status: 'idle' | 'listening' | 'processing' | 'speaking';
};

export function AnimatedCharacter({ status }: AnimatedCharacterProps) {
  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';
  const isProcessing = status === 'processing';

  return (
    <div className="w-full h-full flex items-center justify-center">
      <motion.div
        className="w-48 h-48 rounded-full bg-primary/10 flex items-center justify-center"
        animate={{
          scale: isListening ? [1, 1.05, 1] : 1,
        }}
        transition={{
          duration: isListening ? 1.5 : 0.5,
          repeat: isListening ? Infinity : 0,
        }}
      >
        <motion.div
          className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center"
          animate={{
            scale: isListening ? [1, 1.1, 1] : 1,
          }}
          transition={{
            duration: isListening ? 1.5 : 0.5,
            delay: 0.1,
            repeat: isListening ? Infinity : 0,
          }}
        >
          <motion.div className="w-24 h-24 rounded-full bg-primary/90 relative overflow-hidden flex flex-col items-center justify-end p-4">
             {/* Eyes */}
             <div className="flex gap-4">
                <motion.div
                    className="w-4 h-4 bg-primary-foreground rounded-full"
                    animate={{
                        scaleY: isSpeaking ? [1, 0.2, 1] : 1,
                        y: isListening ? -2 : 0,
                    }}
                    transition={{
                        duration: isSpeaking ? 0.3 : 0.5,
                        repeat: isSpeaking ? Infinity : 0,
                        repeatType: 'mirror'
                    }}
                />
                 <motion.div
                    className="w-4 h-4 bg-primary-foreground rounded-full"
                    animate={{
                        scaleY: isSpeaking ? [1, 0.2, 1] : 1,
                        y: isListening ? -2 : 0,
                    }}
                    transition={{
                        duration: isSpeaking ? 0.3 : 0.5,
                        delay: 0.05,
                        repeat: isSpeaking ? Infinity : 0,
                        repeatType: 'mirror'
                    }}
                />
            </div>
            {/* Mouth */}
             <motion.div
                className="w-10 h-5 bg-primary-foreground/20 rounded-b-full mt-3"
                initial={{ scaleY: 0 }}
                animate={{
                    scaleY: isSpeaking ? [0.8, 0.2, 0.8] : 0.1,
                }}
                transition={{
                    duration: isSpeaking ? 0.3 : 0.5,
                    repeat: isSpeaking ? Infinity : 0,
                    repeatType: 'mirror'
                }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
