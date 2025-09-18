
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { WandSparkles, Loader2, Mic } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { patientAgent, PatientAgentOutput } from "@/ai/flows/patient-agent";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

const SpeechRecognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export function PatientAgentDialog() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [results, setResults] = useState<PatientAgentOutput | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setValue(transcript);
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


  const handleCommand = async (commandText: string) => {
    if (!commandText.trim() || !user) return;
    setIsLoading(true);
    setResults(null);

    try {
      const result = await patientAgent({ userId: user.uid, command: commandText });
      setResults(result);
    } catch (error) {
      console.error("Agent failed:", error);
      toast({
        title: "Agent Error",
        description: "The AI agent failed to process your command.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelect = (cb: () => void) => {
      cb();
      setOpen(false);
  }

  const renderResults = () => {
    if (!results) return null;

    if (results.action === 'unsupported') {
        return <CommandItem disabled>{results.response}</CommandItem>;
    }
    if (results.action === 'navigate') {
        return <CommandItem onSelect={() => handleSelect(() => router.push(results.destination!))}>{results.response}</CommandItem>;
    }
    if (results.action === 'showAnalyses' && Array.isArray(results.data)) {
        return (
            <>
                <CommandItem disabled>{results.response}</CommandItem>
                {results.data.map((report: any) => (
                    <CommandItem key={report.id} onSelect={() => handleSelect(() => router.push(`/my-analyses/${report.id}`))}>
                        View report for {report.conditionName} from {format(new Date(report.date), "MMM d, yyyy")}
                    </CommandItem>
                ))}
            </>
        )
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <WandSparkles className="mr-2 h-4 w-4" />
          Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
             <WandSparkles className="mr-2 h-4 w-4 shrink-0 opacity-50" />
             <CommandInput
                placeholder="Ask the agent to do something... (e.g., 'start a new analysis')"
                value={value}
                onValueChange={setValue}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleCommand(value);
                    }
                }}
              />
              <Button size="icon" variant={isListening ? "destructive" : "ghost"} onClick={handleMicClick} className="flex-shrink-0">
                <Mic className="h-4 w-4" />
              </Button>
          </div>
          <CommandList>
            {isLoading && (
              <div className="p-4 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {!isLoading && !results && (
                 <CommandEmpty>No results found.</CommandEmpty>
            )}
            {!isLoading && results && (
                renderResults()
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
