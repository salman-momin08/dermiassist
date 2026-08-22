
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
import { compressImage } from "@/lib/image-compressor";
import { SUPPORTED_LANGUAGES, getLocalizedText, SupportedLanguage } from "@/lib/translation-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";

type Step = 'upload' | 'proforma' | 'analyzing' | 'error';
type ChatMessage = { sender: 'ai' | 'user'; text: string; timestamp?: string };

const MAX_SAFETY_QUESTIONS = 12; // Generous runaway safeguard allowing 10+ questions as needed
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
  const [confidenceScore, setConfidenceScore] = useState(40);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { toast } = useToast();
  const { addAnalysis } = useAnalyses();
  const { user, userData } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Language & Localization state
  const [currentLang, setCurrentLang] = useState<string>('en');

  // Speech & Audio state
  const recognitionRef = useRef<typeof SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechMode, setSpeechMode] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<{ audio: HTMLAudioElement; text: string } | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!SpeechRecognition) {
      toast({
        title: "Voice Dictation Not Supported",
        description: "Your browser does not support Web Speech Recognition. Please type your response.",
        variant: "destructive"
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = currentLang === 'en' ? 'en-US' : currentLang;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e: any) => {
        console.warn("Speech error:", e);
        setIsListening(false);
      };
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setUserResponse(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Speech recognition initialization error:", err);
      setIsListening(false);
    }
  };

  // Auto-scroll down smoothly to latest message
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'nearest' });
    }
  }, []);

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

  const getNextQuestion = async (
    conditionName: string,
    historyString: string,
    currentHistory: ChatMessage[]
  ) => {
    setIsLoading(true);
    try {
      const { nextQuestion, isComplete, confidenceScore: modelConfidence } = await proformaChat({
        conditionName: conditionName,
        conversationHistory: historyString,
      });

      if (modelConfidence && typeof modelConfidence === 'number') {
        setConfidenceScore(Math.max(40, Math.min(98, modelConfidence)));
      } else {
        setConfidenceScore(prev => Math.min(96, prev + 10));
      }

      // Check if the AI model reached diagnostic closure after adequate context
      if (isComplete && questionCount >= 3) {
        toast({
          title: "Diagnostic Confidence Reached",
          description: "The AI diagnostician has gathered thorough clinical context to generate your comprehensive report.",
        });
        handleFinalEvaluation(currentHistory);
        return;
      }

      const newAiMsg: ChatMessage = {
        sender: 'ai',
        text: nextQuestion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatHistory(prev => [...prev, newAiMsg]);
      setQuestionCount(prev => prev + 1);
    } catch (err: any) {
      console.error("AI question generation failed:", err);
      toast({
        title: "Connection issue",
        description: "The AI diagnostician encountered a network delay. You can continue typing your response or complete the assessment.",
        variant: "destructive"
      });
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

    if (newCount >= MAX_SAFETY_QUESTIONS) {
      handleFinalEvaluation(newHistory);
    } else {
      const historyString = newHistory.map(m => `${m.sender === 'ai' ? 'AI' : 'User'}: ${m.text}`).join('\n');
      getNextQuestion(detectedCondition, historyString, newHistory);
    }
  };

  const startProforma = (conditionName: string) => {
    const welcomeMsg: ChatMessage = {
      sender: 'ai',
      text: `I've analyzed your image and identified the primary differential as **${conditionName}**. To generate your personalized clinical report, I'll ask a few targeted diagnostic questions to calibrate accuracy.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory([welcomeMsg]);
    setQuestionCount(0);
    setConfidenceScore(45);
    getNextQuestion(conditionName, `AI: Initial detection is ${conditionName}.`, [welcomeMsg]);
  };

  const processFile = async (fileToProcess: File) => {
    setFile(fileToProcess);
    try {
      const optimizedDataUri = await compressImage(fileToProcess, 1024, 1024, 0.85);
      setPreview(optimizedDataUri);
    } catch (err) {
      console.warn("Client compression fallback:", err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(fileToProcess);
    }
  };

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

  // --- EFFECTS ---

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Stable handler ref for speech recognition
  const handleUserResponseRef = useRef(handleUserResponse);
  handleUserResponseRef.current = handleUserResponse;

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
        handleUserResponseRef.current(transcript);
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
  }, [chatHistory, speechMode, isLoading, handlePlayMessageAudio]);

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl pt-6 sm:pt-8">
      {/* Navigation & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={resetState}
          className="gap-2 rounded-xl bg-card/80 backdrop-blur-md border-border/80 hover:bg-accent/80 hover:border-primary/40 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          <span>{step === 'upload' ? 'Back to Dashboard' : 'Start New Analysis'}</span>
        </Button>

        {/* Global Multi-Language & Telehealth Controls */}
        <div className="flex items-center gap-2.5">
          {/* 12+ Language Selector */}
          <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-border/80 shadow-sm">
            <Globe className="h-3.5 w-3.5 text-primary" />
            <Select value={currentLang} onValueChange={setCurrentLang}>
              <SelectTrigger className="h-7 border-none bg-transparent text-xs font-semibold px-1 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="max-h-72">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code} className="text-xs">
                    <span className="mr-2">{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                    <span className="text-muted-foreground ml-1.5 text-[10px]">({lang.name})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {step === 'proforma' && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 bg-card/80 backdrop-blur-md px-3 py-1 rounded-xl border border-border/80 shadow-sm transition-all hover:border-primary/40">
                      <Volume2 className="h-3.5 w-3.5 text-primary animate-pulse" />
                      <Label htmlFor="speech-mode" className="text-xs font-semibold cursor-pointer select-none hidden sm:inline">
                        {getLocalizedText(currentLang, 'voiceReadout')}
                      </Label>
                      <Switch
                        id="speech-mode"
                        checked={speechMode}
                        onCheckedChange={setSpeechMode}
                        className="data-[state=checked]:bg-primary h-4 w-8"
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
                  variant="gradient"
                  size="sm"
                  onClick={() => handleFinalEvaluation()}
                  disabled={isLoading}
                  className="gap-1.5 text-xs font-semibold rounded-xl shadow-sm hover:shadow-md"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{getLocalizedText(currentLang, 'completeAssessment')}</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Analysis Card */}
      <Card className="shadow-2xl border-border/80 overflow-hidden backdrop-blur-xl bg-card/90 rounded-2xl relative">
        {/* Subtle decorative gradient glow at the top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-teal-400" />

        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4 pt-5 px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="font-headline text-xl md:text-2xl flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span>{getLocalizedText(currentLang, 'title')}</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm text-muted-foreground">
                {step === 'upload' && getLocalizedText(currentLang, 'subtitle')}
                {step === 'proforma' && "Answer follow-up diagnostic questions to calibrate accuracy and evaluate potential root causes."}
                {step === 'analyzing' && "Generating clinical synthesis with ICD-10 coding and medical guidelines..."}
                {step === 'error' && "An error occurred during evaluation."}
              </CardDescription>
            </div>

            {step === 'proforma' && detectedCondition && (
              <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-xl px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm shadow-sm">
                <span className="text-muted-foreground font-normal">{getLocalizedText(currentLang, 'primaryDiff')}:</span>
                <span className="font-bold underline decoration-primary/40 underline-offset-2">{detectedCondition}</span>
              </div>
            )}
          </div>

          {/* Dynamic Diagnostic Confidence Progress Bar */}
          {step === 'proforma' && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Clinical Calibration (Question {questionCount + 1})</span>
                </span>
                <span className="text-primary font-bold">
                  Diagnostic Certainty: {confidenceScore}%
                </span>
              </div>
              <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden border border-border/40 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${confidenceScore}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <>
            <CardContent className="p-6 md:p-8">
              <div className="space-y-6">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 md:p-10 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden",
                    isDragOver
                      ? "border-primary bg-primary/5 scale-[1.01] shadow-xl shadow-primary/10"
                      : "border-border/80 hover:border-primary/60 bg-muted/15 hover:bg-muted/30 shadow-inner",
                    preview ? "border-solid border-border/80 bg-background/50 p-6" : ""
                  )}
                >
                  {preview ? (
                    <div className="relative group flex flex-col items-center gap-4">
                      <div className="relative rounded-2xl overflow-hidden border-2 border-border/80 shadow-2xl shadow-black/20 group-hover:scale-[1.02] transition-transform duration-300">
                        <Image
                          src={preview}
                          alt="Skin condition specimen"
                          width={320}
                          height={320}
                          className="object-cover rounded-2xl max-h-[280px] w-auto"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/20">
                            Click Remove to change photo
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-xl shadow-md gap-1.5 text-xs font-semibold px-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setPreview(null);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        Remove Photo
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor="picture" className="cursor-pointer w-full flex flex-col items-center justify-center space-y-4 py-6">
                      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center text-primary group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300">
                        <Upload className="h-9 w-9" />
                      </div>
                      <div className="space-y-1.5 text-center max-w-sm">
                        <p className="text-base font-bold text-foreground">
                          Drag & drop your skin photo here, or <span className="text-primary underline decoration-primary/40 underline-offset-2">browse files</span>
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Supports JPEG, PNG, WEBP. High-resolution, well-lit photographs deliver maximum clinical accuracy.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <Badge variant="secondary" className="text-[11px] font-medium rounded-lg px-2.5 py-1 bg-muted/60 border border-border/60">
                          Auto Image Optimization
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] font-medium rounded-lg px-2.5 py-1 bg-muted/60 border border-border/60">
                          End-to-End Encrypted
                        </Badge>
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
            <CardFooter className="border-t border-border/60 bg-muted/10 p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>HIPAA / ISO 27001 compliant vision pipeline</span>
              </div>
              <Button
                variant="default"
                size="lg"
                onClick={handleImageSubmit}
                disabled={isLoading || !file || !preview}
                className="gap-2 font-bold px-8 rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{loadingMessage}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Begin Guided Consultation</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </>
        )}

        {/* STEP 2: PROFORMA CONSULTATION CHAT */}
        {step === 'proforma' && (
          <div className="flex flex-col h-[65vh] min-h-[520px]">
            {/* Specimen Banner */}
            {preview && (
              <div className="bg-muted/30 px-5 py-3 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="relative rounded-lg overflow-hidden border border-border/80 shadow-sm">
                    <Image
                      src={preview}
                      alt="Specimen thumbnail"
                      width={36}
                      height={36}
                      className="h-9 w-9 object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-xs">Active Dermatological Case</p>
                    <p className="text-[10px] text-muted-foreground">Specimen loaded & verified</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] font-semibold border-primary/40 bg-primary/5 text-primary rounded-lg px-2.5 py-0.5">
                  AI Active Triage
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
                        "flex items-start gap-3 transition-all duration-300",
                        isAi ? "justify-start" : "justify-end"
                      )}
                    >
                      {isAi && (
                        <Avatar className="h-9 w-9 border-2 border-primary/30 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shrink-0 mt-0.5 rounded-xl">
                          <AvatarFallback className="bg-transparent text-white font-bold">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      {/* Message Content & Discreet Metadata */}
                      {isAi ? (
                        <div className="flex flex-col items-start max-w-[85%] md:max-w-[78%]">
                          <div className="rounded-2xl rounded-tl-sm px-4.5 py-3 bg-card/95 text-foreground border border-border/80 shadow-sm text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={i} className="text-primary font-bold">{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            })}
                          </div>
                          <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-muted-foreground/70">
                            <span>{msg.timestamp || 'Just now'}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-5 w-5 rounded-md hover:bg-muted/80 transition-colors p-0.5",
                                playingAudio?.text === msg.text && "text-primary animate-pulse bg-primary/10"
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
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end max-w-[85%] md:max-w-[75%]">
                          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-md shadow-blue-500/20 text-sm leading-relaxed whitespace-pre-wrap font-normal">
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-muted-foreground/70 mt-1 px-1">{msg.timestamp || 'Just now'}</span>
                        </div>
                      )}

                      {!isAi && (
                        <Avatar className="h-9 w-9 border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shrink-0 mt-0.5 rounded-xl">
                          <AvatarFallback className="bg-transparent text-white font-bold">
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
                    <Avatar className="h-9 w-9 border-2 border-primary/30 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shrink-0 rounded-xl">
                      <AvatarFallback className="bg-transparent text-white font-bold">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-2xl rounded-tl-sm px-4.5 py-3 bg-card border border-border/80 flex items-center gap-2.5 text-xs text-muted-foreground shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="font-medium">Synthesizing clinical follow-up question...</span>
                    </div>
                  </div>
                )}

                {/* Bottom scroll sentinel */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            </ScrollArea>

            {/* Quick Answer Suggestion Pills */}
            {!isLoading && (
              <div className="px-5 py-2.5 border-t border-border/60 bg-muted/20 flex gap-2 overflow-x-auto scrollbar-none items-center">
                <span className="text-[11px] text-muted-foreground font-semibold shrink-0 mr-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  {getLocalizedText(currentLang, 'quickAnswers')}
                </span>
                {QUICK_SUGGESTIONS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleUserResponse(chip)}
                    className="text-xs shrink-0 bg-card hover:bg-primary/10 hover:border-primary/50 hover:text-primary border border-border/80 rounded-xl px-3.5 py-1.5 font-medium transition-all shadow-sm active:scale-95 text-foreground cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input Bar */}
            <div className="p-4 border-t border-border/60 bg-card/90 backdrop-blur-md">
              <div className="relative flex items-center max-w-3xl mx-auto">
                <Input
                  ref={inputRef}
                  placeholder={isListening ? "Listening to your voice... (Speak now)" : getLocalizedText(currentLang, 'placeholder')}
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
                    "pr-28 py-6 rounded-2xl bg-muted/30 focus-visible:ring-primary text-sm shadow-inner transition-all",
                    isListening && "border-red-500 bg-red-500/10 placeholder:text-red-500 ring-2 ring-red-500/30"
                  )}
                />
                <div className="absolute right-2 flex items-center gap-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={isListening ? 'destructive' : 'ghost'}
                          onClick={toggleListening}
                          disabled={isLoading}
                          className={cn(
                            "h-9 w-9 rounded-xl transition-all",
                            isListening && "animate-bounce shadow-lg shadow-red-500/30"
                          )}
                        >
                          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isListening ? 'Stop voice recording' : 'Speak your answer'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    size="icon"
                    variant="default"
                    onClick={() => handleUserResponse()}
                    disabled={isLoading || !userResponse.trim()}
                    className="h-9 w-9 rounded-xl shadow-md hover:shadow-lg transition-all"
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
          <CardContent className="flex flex-col items-center justify-center min-h-[360px] p-8 text-center">
            {step === 'analyzing' && (
              <div className="space-y-5 max-w-md flex flex-col items-center">
                <div className="relative">
                  <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-600/20 via-indigo-600/20 to-teal-400/20 border border-primary/30 flex items-center justify-center text-primary shadow-xl shadow-primary/10">
                    <WandSparkles className="h-12 w-12 text-primary animate-pulse" />
                  </div>
                  <div className="absolute -inset-1 rounded-2xl border-2 border-primary/40 border-t-transparent animate-spin" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-headline font-bold text-xl text-foreground">
                    {loadingMessage || "Generating Clinical Synthesis"}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Executing multi-agent vision verification, Supabase vector retrieval, and grounded medical guideline synthesis.
                  </p>
                </div>
              </div>
            )}

            {step === 'error' && error && (
              <div className="space-y-4 max-w-md flex flex-col items-center text-destructive">
                <div className="h-20 w-20 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shadow-lg shadow-destructive/10">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <div className="space-y-1.5 text-center">
                  <h3 className="font-headline font-bold text-lg text-foreground">Consultation Interrupted</h3>
                  <p className="text-xs text-muted-foreground break-words">{error}</p>
                </div>
                <Button
                  variant="default"
                  size="default"
                  onClick={resetState}
                  className="gap-2 mt-3 rounded-xl font-bold shadow-md"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Restart Consultation</span>
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
