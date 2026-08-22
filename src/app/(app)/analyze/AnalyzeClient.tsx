
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  FileText,
  RotateCcw,
} from "lucide-react";
import Image from "next/image";
import { detectDiseaseNameCached as detectDiseaseName } from "@/ai/flows/cached";
import { finalEvaluationCached as finalEvaluation } from "@/ai/flows/cached";
import { proformaChat } from "@/ai/flows/proforma-chat";
import { useToast } from "@/hooks/use-toast";
import { useAnalyses } from "@/hooks/use-analyses";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { textToSpeech } from "@/ai/flows/text-to-speech";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sanitizeConditionName } from "@/ai/guards/condition-guard";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type Step = 'upload' | 'proforma' | 'analyzing' | 'error';
type ChatMessage = { sender: 'ai' | 'user'; text: string; timestamp?: string };

const MAX_QUESTIONS = 5;
const SpeechRecognition = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

const QUICK_SUGGESTIONS = [
  "Severe itching & redness",
  "Mild discomfort, no pain",
  "Started 2-3 days ago",
  "No known allergies",
  "Spreading gradually",
  "No previous history"
];

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
  const [isDragOver, setIsDragOver] = useState(false);

  const { toast } = useToast();
  const { addAnalysis } = useAnalyses();
  const { user, userData } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Speech & Audio state
  const recognitionRef = useRef<typeof SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechMode, setSpeechMode] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<{ audio: HTMLAudioElement; text: string } | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Auto-scroll down smoothly to latest message
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'nearest' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [chatHistory, isLoading, isListening, scrollToBottom]);

  // Handle URL query parameters for prefilled conditions
  useEffect(() => {
    const prefilledCondition = searchParams.get('condition');
    const prefilledImage = searchParams.get('image');

    if (prefilledCondition && prefilledImage) {
      const sanitizedCondition = sanitizeConditionName(prefilledCondition);
      setDetectedCondition(sanitizedCondition);
      setPreview(prefilledImage);
      setStep('proforma');
      startProforma(sanitizedCondition);
    }
  }, [searchParams]);

  // Setup Web Speech Recognition
  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setUserResponse(transcript);
        handleUserResponse(transcript);
      }
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast({
          title: "Permission Denied",
          description: "Please enable microphone access in your browser.",
          variant: "destructive"
        });
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [toast]);

  // Automatically play AI voice if speech mode is enabled
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
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      processFile(droppedFile);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (PNG, JPG, JPEG, WEBP).",
        variant: "destructive"
      });
    }
  };

  const processFile = (fileToProcess: File) => {
    setFile(fileToProcess);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(fileToProcess);
  };

  const handleImageSubmit = async () => {
    if (!file || !preview) {
      toast({ title: "No image selected", description: "Please upload a photo of the skin lesion.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Analyzing image & detecting condition...");
    setError(null);

    try {
      const { conditionName } = await detectDiseaseName({ photoDataUri: preview }, user?.id);
      const sanitizedName = sanitizeConditionName(conditionName);
      setDetectedCondition(sanitizedName);
      setStep('proforma');
      startProforma(sanitizedName);
    } catch (err: any) {
      console.error("Initial analysis failed:", err);
      const errorMessage = err.message || "Failed to analyze the image. The AI may be unable to identify a condition. Please try another clear photo.";
      setError(errorMessage);
      setStep('error');
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const startProforma = (conditionName: string) => {
    const welcomeMsg: ChatMessage = {
      sender: 'ai',
      text: `I've analyzed your image and identified the primary differential as **${conditionName}**. To generate your personalized clinical report, I'll ask a few quick questions regarding your symptoms and health context.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory([welcomeMsg]);
    setQuestionCount(0);
    getNextQuestion(conditionName, `AI: Initial detection is ${conditionName}.`, [welcomeMsg]);
  };

  const getNextQuestion = async (
    conditionName: string,
    historyString: string,
    currentHistory: ChatMessage[]
  ) => {
    setIsLoading(true);
    try {
      const { nextQuestion } = await proformaChat({
        conditionName: conditionName,
        conversationHistory: historyString,
      });

      const newAiMsg: ChatMessage = {
        sender: 'ai',
        text: nextQuestion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatHistory(prev => [...prev, newAiMsg]);
      setQuestionCount(prev => prev + 1);
    } catch (err) {
      console.error("Failed to get next question:", err);
      const fallbackMsg: ChatMessage = {
        sender: 'ai',
        text: "I have gathered enough clinical context. Let's proceed to generate your comprehensive medical assessment.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updatedHistory = [...currentHistory, fallbackMsg];
      setChatHistory(updatedHistory);
      handleFinalEvaluation(updatedHistory);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleUserResponse = (responseText?: string) => {
    const textToSend = (responseText ?? userResponse).trim();
    if (!textToSend || !detectedCondition || isLoading) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setUserResponse("");

    const newCount = questionCount + 1;

    if (newCount >= MAX_QUESTIONS) {
      handleFinalEvaluation(newHistory);
    } else {
      const historyString = newHistory.map(m => `${m.sender === 'ai' ? 'AI' : 'User'}: ${m.text}`).join('\n');
      getNextQuestion(detectedCondition, historyString, newHistory);
    }
  };

  const handleFinalEvaluation = async (historyToEvaluate?: ChatMessage[]) => {
    if (!user || !userData) {
      toast({ title: "Authentication Required", description: "Please sign in to save your report.", variant: "destructive" });
      return;
    }
    if (!preview || !detectedCondition) {
      toast({ title: "Missing Information", description: "Analysis specimen or condition name is missing.", variant: "destructive" });
      return;
    }

    const evaluationHistory = historyToEvaluate || chatHistory;

    setStep('analyzing');
    setIsLoading(true);
    setLoadingMessage("Synthesizing clinical findings & guidelines...");
    setError(null);

    try {
      const answersString = evaluationHistory.map(a => `${a.sender === 'ai' ? 'Doctor/AI' : 'Patient'}: ${a.text}`).join('\n\n');
      
      const proformaAnswers: { question: string; answer: string }[] = [];
      for (let i = 0; i < evaluationHistory.length; i++) {
        if (evaluationHistory[i].sender === 'ai' && i > 0) {
          const nextMessage = evaluationHistory[i + 1];
          if (nextMessage && nextMessage.sender === 'user') {
            proformaAnswers.push({
              question: evaluationHistory[i].text,
              answer: nextMessage.text
            });
          }
        }
      }

      const result = await finalEvaluation({
        photoDataUri: preview,
        initialCondition: detectedCondition,
        userAnswers: answersString,
      }, user?.id);

      const newReport = await addAnalysis(user.id, userData.displayName || "Patient", {
        condition: result.condition,
        conditionName: result.conditionName,
        image: preview,
        recommendations: result.recommendations + "\n\n**Notice:** This AI clinical synthesis provides decision support and triage insights. Please consult a board-certified dermatologist for definitive histological verification.",
        dos: result.dos,
        donts: result.donts,
        submittedInfo: {
          initialCondition: detectedCondition,
          otherConsiderations: result.otherConsiderations,
          proformaAnswers: proformaAnswers,
        },
      });

      toast({ title: "Analysis Complete", description: "Your comprehensive clinical assessment is ready.", duration: 3000 });
      router.push(`/my-analyses/${newReport.id}`);

    } catch (err: any) {
      console.error("Final evaluation failed:", err);
      setError(err?.message || "An unexpected error occurred during report synthesis. Please try again.");
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      toast({ title: "Speech Recognition Unavailable", description: "Speech recognition is not supported in this browser.", variant: "destructive" });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setSpeechMode(true);
        setIsListening(true);
      } catch (err) {
        console.error("Speech start error:", err);
        setIsListening(false);
      }
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
      const { audioUrl } = await textToSpeech({ text });
      setAudioCache(prev => ({ ...prev, [text]: audioUrl }));
      const audio = new Audio(audioUrl);
      setPlayingAudio({ audio, text });
      audio.play();
      audio.onended = onEnded;
    } catch (err) {
      console.error("Failed to play audio:", err);
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
      if (playingAudio) {
        playingAudio.audio.pause();
        setPlayingAudio(null);
      }
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={resetState}
          className="gap-2 hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 'upload' ? 'Back' : 'Start New Analysis'}
        </Button>

        {step === 'proforma' && (
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-full border border-border/60">
                    <Volume2 className="h-4 w-4 text-primary" />
                    <Label htmlFor="speech-mode" className="text-xs font-medium cursor-pointer">
                      Voice Mode
                    </Label>
                    <Switch
                      id="speech-mode"
                      checked={speechMode}
                      onCheckedChange={setSpeechMode}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Read AI questions aloud automatically</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {questionCount >= 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleFinalEvaluation()}
                disabled={isLoading}
                className="gap-1.5 font-medium text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-none"
              >
                <FileText className="h-3.5 w-3.5" />
                Finish & View Report
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Analysis Card */}
      <Card className="shadow-lg border-border/80 overflow-hidden backdrop-blur-sm bg-card/95">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-headline text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Dermatological Consultation & Analysis
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                {step === 'upload' && "Upload a clear photo to initiate AI condition detection and guided diagnostic triage."}
                {step === 'proforma' && "Answer follow-up diagnostic questions to calibrate accuracy and rule out differential diagnoses."}
                {step === 'analyzing' && "Generating clinical synthesis with ICD-10 coding and medical guidelines..."}
                {step === 'error' && "An error occurred during evaluation."}
              </CardDescription>
            </div>

            {step === 'proforma' && detectedCondition && (
              <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-semibold">
                <span>Detected:</span>
                <span className="underline">{detectedCondition}</span>
              </div>
            )}
          </div>

          {/* Progress bar during proforma */}
          {step === 'proforma' && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Consultation Progress</span>
                <span>Question {Math.min(questionCount + 1, MAX_QUESTIONS)} of {MAX_QUESTIONS}</span>
              </div>
              <Progress value={(Math.min(questionCount, MAX_QUESTIONS) / MAX_QUESTIONS) * 100} className="h-1.5" />
            </div>
          )}
        </CardHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[260px]",
                    isDragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/20",
                    preview ? "border-solid border-border/80 p-4" : ""
                  )}
                >
                  {preview ? (
                    <div className="relative group flex flex-col items-center">
                      <div className="relative rounded-lg overflow-hidden border border-border shadow-md">
                        <Image
                          src={preview}
                          alt="Skin condition specimen"
                          width={280}
                          height={280}
                          className="object-cover rounded-lg max-h-[260px] w-auto"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-3 gap-1 text-xs shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setPreview(null);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        Remove Image
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor="picture" className="cursor-pointer w-full flex flex-col items-center justify-center space-y-3 py-6">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8" />
                      </div>
                      <div className="space-y-1 text-center">
                        <p className="text-sm font-semibold text-foreground">
                          Drag & drop your skin photo here, or <span className="text-primary underline">browse</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports JPEG, PNG, WEBP (High-resolution, well-lit photos give highest diagnostic accuracy)
                        </p>
                      </div>
                      <Input
                        id="picture"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isLoading}
                      />
                    </label>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/10 p-4 flex justify-between">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                HIPAA & ISO 27001 compliant encrypted pipeline
              </div>
              <Button
                onClick={handleImageSubmit}
                disabled={isLoading || !file || !preview}
                className="gap-2 font-semibold shadow-md px-6"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {loadingMessage}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Start Guided Analysis
                  </>
                )}
              </Button>
            </CardFooter>
          </>
        )}

        {/* STEP 2: PROFORMA CONSULTATION CHAT */}
        {step === 'proforma' && (
          <div className="flex flex-col h-[65vh] min-h-[500px]">
            {/* Specimen Banner */}
            {preview && (
              <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Image
                    src={preview}
                    alt="Specimen thumbnail"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-md object-cover border border-border"
                  />
                  <span>Active Specimen Analysis</span>
                </div>
                <Badge variant="outline" className="text-[11px] font-normal border-primary/30 text-primary">
                  Interactive Triage Mode
                </Badge>
              </div>
            )}

            {/* Chat message viewport with guaranteed auto-scroll */}
            <ScrollArea className="flex-1 p-4 md:p-6 overflow-y-auto">
              <div className="space-y-4 max-w-3xl mx-auto">
                {chatHistory.map((msg, index) => {
                  const isAi = msg.sender === 'ai';
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-3 transition-opacity duration-300",
                        isAi ? "justify-start" : "justify-end"
                      )}
                    >
                      {isAi && (
                        <Avatar className="h-8 w-8 border border-primary/20 bg-primary/10 text-primary shrink-0 mt-0.5">
                          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 max-w-[85%] md:max-w-[75%] shadow-sm relative group",
                          isAi
                            ? "bg-muted/90 text-foreground border border-border/60 rounded-tl-sm"
                            : "bg-primary text-primary-foreground rounded-tr-sm"
                        )}
                      >
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={i} className={isAi ? "text-primary font-semibold" : "font-bold"}>{part.slice(2, -2)}</strong>;
                            }
                            return part;
                          })}
                        </div>

                        {/* Message Meta & Audio Trigger */}
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/20 text-[10px] opacity-75 gap-3">
                          <span>{msg.timestamp || 'Just now'}</span>
                          {isAi && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-5 w-5 rounded-full hover:bg-background/50",
                                playingAudio?.text === msg.text && "text-primary animate-pulse"
                              )}
                              onClick={() => handlePlayMessageAudio(msg.text)}
                              disabled={isAudioLoading === msg.text}
                            >
                              {isAudioLoading === msg.text ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : playingAudio?.text === msg.text ? (
                                <VolumeX className="h-3 w-3" />
                              ) : (
                                <Volume2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {!isAi && (
                        <Avatar className="h-8 w-8 border border-border shrink-0 mt-0.5">
                          <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}

                {/* AI Thinking Animation */}
                {isLoading && (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border border-primary/20 bg-primary/10 text-primary shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-muted/80 border border-border/60 flex items-center gap-2 text-xs text-muted-foreground shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Formulating clinical inquiry...</span>
                    </div>
                  </div>
                )}

                {/* Bottom scroll sentinel */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            </ScrollArea>

            {/* Quick Answer Chips */}
            {!isLoading && (
              <div className="px-4 py-2 border-t bg-muted/20 flex gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-[11px] text-muted-foreground self-center shrink-0 mr-1 font-medium">Suggestions:</span>
                {QUICK_SUGGESTIONS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleUserResponse(chip)}
                    className="text-xs shrink-0 bg-background hover:bg-primary/10 hover:text-primary border border-border/80 rounded-full px-3 py-1 transition-colors text-muted-foreground cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input Bar */}
            <div className="p-3 md:p-4 border-t bg-card">
              <div className="relative flex items-center">
                <Input
                  ref={inputRef}
                  placeholder={isListening ? "Listening to your voice..." : "Type your clinical answer or symptoms..."}
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                      e.preventDefault();
                      handleUserResponse();
                    }
                  }}
                  disabled={isLoading}
                  className={cn(
                    "pr-24 py-6 bg-muted/30 focus-visible:ring-primary text-sm",
                    isListening && "border-red-500 bg-red-50/10 placeholder:text-red-500 animate-pulse"
                  )}
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={isListening ? 'destructive' : 'ghost'}
                          onClick={handleMicClick}
                          disabled={isLoading}
                          className="h-8 w-8 rounded-full"
                        >
                          {isListening ? <MicOff className="h-4 w-4 animate-bounce" /> : <Mic className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isListening ? 'Stop listening' : 'Speak your answer'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    size="icon"
                    onClick={() => handleUserResponse()}
                    disabled={isLoading || !userResponse.trim()}
                    className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 & 4: ANALYZING / ERROR STATES */}
        {(step === 'analyzing' || step === 'error') && (
          <CardContent className="flex flex-col items-center justify-center min-h-[340px] p-8 text-center">
            {step === 'analyzing' && (
              <div className="space-y-4 max-w-md flex flex-col items-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                    <WandSparkles className="h-10 w-10 text-primary" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-primary/40 border-t-transparent animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">
                    {loadingMessage || "Generating Clinical Synthesis"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Performing multimodal RAG cross-referencing, ICD-10 differential mapping, and clinical guideline synthesis.
                  </p>
                </div>
              </div>
            )}

            {step === 'error' && error && (
              <div className="space-y-4 max-w-md flex flex-col items-center text-destructive">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-1 text-center">
                  <h3 className="font-semibold text-base">Analysis Error</h3>
                  <p className="text-xs text-muted-foreground break-words">{error}</p>
                </div>
                <Button onClick={resetState} variant="outline" className="gap-2 mt-2">
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
