
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Loader2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  WandSparkles,
  Bot,
  User,
  Send,
  Mic,
  Volume2,
  VolumeX,
} from "lucide-react";
import Image from "next/image";
import { detectDiseaseNameCached as detectDiseaseName } from "@/ai/flows/cached";
import { finalEvaluationCached as finalEvaluation } from "@/ai/flows/cached";
import { proformaChat } from "@/ai/flows/proforma-chat";
import { useToast } from "@/hooks/use-toast";
import { useAnalyses } from "@/hooks/use-analyses";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { textToSpeech } from "@/ai/flows/text-to-speech";
import { uploadFile } from "@/lib/actions";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


type Step = 'upload' | 'proforma' | 'analyzing' | 'error';
type ChatMessage = { sender: 'ai' | 'user'; text: string };

const MAX_QUESTIONS = 5;
const SpeechRecognition = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;


export default function AnalyzeClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [detectedCondition, setDetectedCondition] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userResponse, setUserResponse] = useState("");
  const [questionCount, setQuestionCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { addAnalysis } = useAnalyses();
  const { user, userData } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Speech & Audio state
  const recognitionRef = useRef<typeof SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechMode, setSpeechMode] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<{ audio: HTMLAudioElement; text: string } | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});


  useEffect(() => {
    const prefilledCondition = searchParams.get('condition');
    const prefilledImage = searchParams.get('image');

    if (prefilledCondition && prefilledImage) {
      setDetectedCondition(prefilledCondition);
      setPreview(prefilledImage);
      setStep('proforma');
      startProforma(prefilledCondition);
    }
  }, [searchParams]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Setup Speech Recognition
  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setUserResponse(transcript);
      // Automatically send the response when speech is recognized
      handleUserResponse(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [toast]);

  // Effect to automatically play new AI messages in speech mode
  useEffect(() => {
    if (speechMode && chatHistory.length > 0) {
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (lastMessage.sender === 'ai' && !isLoading) {
        handlePlayMessageAudio(lastMessage.text);
      }
    }
  }, [chatHistory, speechMode, isLoading]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleImageSubmit = async () => {
    if (!file || !preview) {
      toast({ title: "No image selected", description: "Please upload an image.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Detecting condition...");
    setError(null);

    try {
      const { conditionName } = await detectDiseaseName({ photoDataUri: preview }, user?.id);
      setDetectedCondition(conditionName);
      setStep('proforma');
      startProforma(conditionName);
    } catch (err: any) {
      console.error("Initial analysis failed:", err);
      const errorMessage = err.message || "Failed to analyze the image. The AI may be unable to identify a condition. Please try another photo.";
      setError(errorMessage);
      setStep('error');
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const startProforma = (conditionName: string) => {
    setChatHistory([{
      sender: 'ai',
      text: `I've identified the condition as likely being **${conditionName}**. To give you a more detailed report, I need to ask a few questions. Let's start with this:`
    }]);
    getNextQuestion(conditionName, 'AI: Hello!');
  };

  const getNextQuestion = async (conditionName: string, history: string) => {
    setIsLoading(true);
    try {
      const { nextQuestion } = await proformaChat({
        conditionName: conditionName,
        conversationHistory: history,
      });
      setChatHistory(prev => [...prev, { sender: 'ai', text: nextQuestion }]);
      setQuestionCount(prev => prev + 1);
    } catch (err) {
      console.error("Failed to get next question:", err);
      setChatHistory(prev => [...prev, { sender: 'ai', text: "I'm having trouble thinking of the next question. Let's proceed with the final analysis." }]);
      handleFinalEvaluation();
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserResponse = (responseText?: string) => {
    const textToSend = responseText || userResponse;
    if (!textToSend.trim() || !detectedCondition) return;

    const newHistory = [...chatHistory, { sender: 'user' as const, text: textToSend }];
    setChatHistory(newHistory);
    setUserResponse("");

    if (questionCount >= MAX_QUESTIONS) {
      handleFinalEvaluation();
    } else {
      const historyString = newHistory.map(m => `${m.sender === 'ai' ? 'AI' : 'User'}: ${m.text}`).join('\n');
      getNextQuestion(detectedCondition, historyString);
    }
  };

  const handleFinalEvaluation = async () => {
    if (!user || !userData) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!preview || !detectedCondition) {
      toast({ title: "Missing Information", description: "Critical analysis data is missing.", variant: "destructive" });
      return;
    }

    setStep('analyzing');
    setIsLoading(true);
    setLoadingMessage("Performing final evaluation...");
    setError(null);

    try {
      const answersString = chatHistory.map(a => `${a.sender === 'ai' ? 'Q' : 'A'}: ${a.text}`).join('\n\n');
      const proformaAnswers = chatHistory.reduce((acc, curr, index) => {
        if (curr.sender === 'ai' && index > 0) {
          const nextMessage = chatHistory[index + 1];
          if (nextMessage && nextMessage.sender === 'user') {
            acc.push({ question: curr.text, answer: nextMessage.text });
          }
        }
        return acc;
      }, [] as { question: string; answer: string }[]);

      const result = await finalEvaluation({
        photoDataUri: preview,
        initialCondition: detectedCondition,
        userAnswers: answersString,
      }, user?.id);

      const newReport = await addAnalysis(user.id, userData.displayName || "Anonymous", {
        condition: result.condition,
        conditionName: result.conditionName,
        image: preview,
        recommendations: result.recommendations + "\n\n**Note:** Such AI-generated reports may have flaws. Please consult an actual dermatologist for better results.",
        dos: result.dos,
        donts: result.donts,
        submittedInfo: {
          initialCondition: detectedCondition,
          otherConsiderations: result.otherConsiderations,
          proformaAnswers: proformaAnswers,
        },
      });

      toast({ title: "Analysis Complete", description: "Your detailed report is ready.", duration: 3000 });
      router.push(`/my-analyses/${newReport.id}`);

    } catch (err) {
      console.error("Final evaluation failed:", err);
      setError("An unexpected error occurred during the final analysis. Please try again.");
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }

  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setSpeechMode(true); // Activate speech mode on first mic use
      setIsListening(true);
    }
  };

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
      setAudioCache(prev => ({ ...prev, [text]: uploadResult.url! }));
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


  const resetState = () => {
    if (searchParams.get('condition')) {
      router.push('/dashboard');
    } else {
      setStep('upload');
      setFile(null);
      setPreview(null);
      setDetectedCondition(null);
      setChatHistory([]);
      setQuestionCount(0);
      setError(null);
      setLoadingMessage("");
    }
  };

  const renderBackButton = () => (
    <div className="mb-6">
      <Button variant="outline" onClick={resetState}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {searchParams.get('condition') ? "Back to Dashboard" : "Start Over"}
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      {step !== 'upload' && renderBackButton()}
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">New Skin Analysis</CardTitle>
            <CardDescription>
              {step === 'upload' && "Upload a photo to get started. Our AI will identify the condition and begin a guided consultation."}
              {step === 'proforma' && "Please answer the AI's questions for a more accurate report."}
              {step === 'analyzing' && "Hang tight! Our AI is preparing your detailed analysis."}
              {step === 'error' && "An error occurred. Please try again."}
            </CardDescription>
          </CardHeader>

          {step === 'upload' && (
            <>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="picture">Skin Condition Photo</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center cursor-pointer">
                    {preview ? (
                      <div className="relative inline-block">
                        <Image src={preview} alt="Preview" width={200} height={200} className="mx-auto rounded-lg" />
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 bg-background/50 hover:bg-background/80 rounded-full h-7 w-7" onClick={() => { setFile(null); setPreview(null); }}>
                          <XCircle className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <label htmlFor="picture" className="cursor-pointer">
                        <div className="space-y-2">
                          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Drag & drop an image here, or click to select one</p>
                          <Input id="picture" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
                          <Button size="sm" asChild className="mt-2"><span>Upload Image</span></Button>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleImageSubmit} disabled={isLoading || !file} className="w-full">
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loadingMessage}</> : "Start Analysis"}
                </Button>
              </CardFooter>
            </>
          )}

          {step === 'proforma' && (
            <>
              <CardContent className="h-[50vh] flex flex-col p-0">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Label htmlFor="speech-mode" className="flex items-center gap-2 cursor-pointer">
                            <Volume2 className="h-4 w-4" />
                            Speech Mode
                          </Label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Automatically play AI responses aloud.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Switch
                      id="speech-mode"
                      checked={speechMode}
                      onCheckedChange={setSpeechMode}
                    />
                  </div>
                </div>
                <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {chatHistory.map((msg, index) => (
                      <div key={index} className={cn("flex items-start gap-3", msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                        {msg.sender === 'ai' && (
                          <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                            <AvatarFallback><Bot size={18} /></AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("rounded-lg px-4 py-2 max-w-[80%]", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                          <p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          {msg.sender === 'ai' && index > 0 && (
                            <div className="flex justify-end mt-1">
                              <Button size="icon" variant="ghost" className={cn("h-6 w-6 shrink-0", playingAudio?.text === msg.text && "text-primary")} onClick={() => handlePlayMessageAudio(msg.text)} disabled={isAudioLoading === msg.text}>
                                {isAudioLoading === msg.text ? <Loader2 className="h-4 w-4 animate-spin" /> : playingAudio?.text === msg.text ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          )}
                        </div>
                        {msg.sender === 'user' && (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback><User size={18} /></AvatarFallback>
                          </Avatar>
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
                <div className="p-4 border-t">
                  <div className="relative">
                    <Input
                      placeholder={isListening ? "Listening..." : "Type your answer..."}
                      value={userResponse}
                      onChange={(e) => setUserResponse(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleUserResponse()}
                      disabled={isLoading}
                      className="pr-20"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                      <Button size="icon" variant={isListening ? 'destructive' : 'ghost'} onClick={handleMicClick} disabled={isLoading}>
                        <Mic className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleUserResponse()} disabled={isLoading || !userResponse.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {(step === 'analyzing' || step === 'error') && (
            <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
              {step === 'analyzing' && (
                <>
                  <WandSparkles className="h-12 w-12 animate-pulse text-primary" />
                  <p className="text-muted-foreground">{loadingMessage || "Generating your final report..."}</p>
                  <p className="text-xs text-muted-foreground">This can take up to a minute.</p>
                </>
              )}
              {step === 'error' && error && (
                <div className="flex flex-col items-center justify-center text-center text-destructive space-y-4 px-4 w-full">
                  <AlertTriangle className="h-12 w-12 mx-auto flex-shrink-0" />
                  <p className="text-sm break-words w-full">{error}</p>
                  <Button onClick={resetState} className="w-full sm:w-auto">Try Again</Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
