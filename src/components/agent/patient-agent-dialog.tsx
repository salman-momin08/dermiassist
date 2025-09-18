
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { WandSparkles, Loader2, Mic, Upload, User, Bot } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { patientAgent, PatientAgentOutput } from "@/ai/flows/patient-agent";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback } from "../ui/avatar";

const SpeechRecognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

type AgentMessage = {
    sender: 'agent' | 'user';
    text: string;
    action?: PatientAgentOutput['action'];
    data?: any;
    destination?: string;
};

export function PatientAgentDialog() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [awaitingPhoto, setAwaitingPhoto] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    { sender: 'agent', text: "Hello! I'm your patient assistant. You can ask me to start an analysis, show your reports, or take you to any page."}
  ]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      handleCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
       if (event.error === 'not-allowed') {
         toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [toast]);

  const handleMicClick = async () => {
     if (!recognitionRef.current) {
        toast({ title: "Unsupported", description: "Speech recognition is not supported in this browser.", variant: "destructive"});
        return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'prompt' || permissionStatus.state === 'granted') {
                recognitionRef.current.start();
                setIsListening(true);
            } else {
                toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
            }
        } catch (e) {
            recognitionRef.current.start();
            setIsListening(true);
        }
    }
  };


  const handleCommand = async (commandText: string, photoDataUri?: string) => {
    if ((!commandText.trim() && !photoDataUri) || !user) return;
    
    const userMessage: AgentMessage = { sender: 'user', text: commandText || "Sent an image for analysis" };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setAwaitingPhoto(false);

    try {
        const historyString = messages.map(m => `${m.sender === 'agent' ? 'Agent' : 'User'}: ${m.text}`).join('\n');
      
        const result = await patientAgent({ 
            userId: user.uid, 
            command: commandText,
            conversationHistory: historyString,
            photoDataUri: photoDataUri 
        });
      
        const agentMessage: AgentMessage = {
            sender: 'agent',
            text: result.response,
            action: result.action,
            data: result.data,
            destination: result.destination,
        };
        setMessages(prev => [...prev, agentMessage]);
        
        // Handle direct actions
        if (result.action === 'navigate' || result.action === 'startProforma') {
            router.push(result.destination!);
            setOpen(false);
        } else if (result.action === 'awaiting_photo') {
            setAwaitingPhoto(true);
        }

    } catch (error) {
      console.error("Agent failed:", error);
      const errorMessage: AgentMessage = { sender: 'agent', text: "Sorry, I encountered an error. Please try again."};
      setMessages(prev => [...prev, errorMessage]);
      toast({
        title: "Agent Error",
        description: "The AI agent failed to process your command.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectAction = (cb: () => void) => {
      cb();
      setOpen(false);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        // The user sent a photo, so the command is implicit
        handleCommand("Here is the photo for the analysis.", dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <WandSparkles className="mr-2 h-4 w-4" />
          Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg flex flex-col h-[70vh]">
         <DialogHeader>
            <DialogTitle>Patient Agent</DialogTitle>
            <DialogDescription>Use text or voice to command the AI agent to navigate the app or retrieve information for you.</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow pr-4 -mr-6" viewportRef={scrollAreaRef}>
             <div className="space-y-4">
                {messages.map((msg, index) => (
                    <div key={index}>
                         <div className={cn("flex items-start gap-3", msg.sender === 'user' ? 'justify-end' : '')}>
                            {msg.sender === 'agent' && (
                                <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                    <AvatarFallback><Bot size={18} /></AvatarFallback>
                                </Avatar>
                            )}
                            <div className={cn("rounded-lg px-4 py-2 max-w-[80%]", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                <p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                            </div>
                            {msg.sender === 'user' && (
                                    <Avatar className="h-8 w-8">
                                    <AvatarFallback><User size={18} /></AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                        {msg.action === 'showAnalyses' && msg.data && (
                            <div className="space-y-2 mt-2 ml-11">
                                {msg.data.map((report: any) => (
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
        
        <div className="mt-auto pt-4">
            <div className="relative">
                <Input
                    placeholder={isListening ? "Listening..." : "Ask the agent to do something..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommand(inputValue)}
                    disabled={isLoading || isListening}
                    className="pr-20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                    {awaitingPhoto && (
                        <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                            <Upload className="h-4 w-4" />
                        </Button>
                    )}
                    <Button size="icon" variant={isListening ? "destructive" : "ghost"} onClick={handleMicClick} disabled={isLoading}>
                        <Mic className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      </DialogContent>
    </Dialog>
  );
}

    