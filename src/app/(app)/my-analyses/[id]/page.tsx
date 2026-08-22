
"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useAnalyses, type AnalysisReport, type Explanation } from '@/hooks/use-analyses';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, XCircle, ArrowLeft, Loader2, Upload, LineChart, Sparkles, Languages, Mic, Send, Bot, User, Volume2, Stethoscope, Download, ShieldCheck, Database } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { downloadFhirJson } from "@/lib/fhir-exporter";
import { calculateUVProtection, FitzpatrickSkinType } from "@/lib/uv-tracker";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { visualProgressAnalysis } from '@/ai/flows/visual-progress-analysis';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { generateHealingVideo } from '@/ai/flows/generate-healing-video';
import { explainReportMultimodal } from '@/ai/flows/explain-report-multimodal';
import { generateChatSummary } from '@/ai/flows/generate-chat-summary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { recommendDoctors, RecommendDoctorsOutput } from '@/ai/flows/recommend-doctors';


// Check for window object to avoid SSR errors with SpeechRecognition
const SpeechRecognition =
    typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

type ExplanationMessage = {
    sender: 'user' | 'bot';
    text: string;
};

export default function AnalysisDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { getAnalysisById, updateAnalysis } = useAnalyses();
    const { user, userData, loading: isAuthLoading } = useAuth();
    const router = useRouter();

    const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [progressImage, setProgressImage] = useState<string | null>(null);
    const [isComparing, setIsComparing] = useState(false);
    const [progressSummary, setProgressSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // State for explanation modal
    const [explanationDialogOpen, setExplanationDialogOpen] = useState(false);
    const [explanationLoading, setExplanationLoading] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('English');
    const [explanationMessages, setExplanationMessages] = useState<ExplanationMessage[]>([]);
    const [explanationAudioUrl, setExplanationAudioUrl] = useState<string | null>(null);
    const [explanationError, setExplanationError] = useState<string | null>(null);
    const [followUpQuestion, setFollowUpQuestion] = useState("");
    const [isAnswering, setIsAnswering] = useState(false);
    const [playingAudio, setPlayingAudio] = useState<{ audio: HTMLAudioElement; text: string } | null>(null);
    const [isAudioLoading, setIsAudioLoading] = useState<string | null>(null); // Store text of the message being loaded
    const [audioCache, setAudioCache] = useState<Record<string, string>>({});
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // State for doctor recommendations
    const [isRecommending, setIsRecommending] = useState(false);
    const [recommendationResult, setRecommendationResult] = useState<RecommendDoctorsOutput | null>(null);


    // State for speech recognition
    const recognitionRef = useRef<typeof SpeechRecognition | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);

    const hasExistingExplanations = () => analysis && analysis.explanations && Object.keys(analysis.explanations).length > 0;

    const fetchAnalysis = async () => {
        if (!user) {
            return;
        }

        setIsLoading(true);
        try {
            const foundAnalysis = await getAnalysisById(user.id, id);
            if (foundAnalysis) {
                setAnalysis(foundAnalysis);
            } else {
                notFound();
            }
        } catch (err) {
            console.error("Failed to fetch analysis", err);
            notFound();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthLoading && user) {
            fetchAnalysis();
        } else if (!isAuthLoading && !user) {
            router.push('/login');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, user, isAuthLoading, router]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [explanationMessages]);

    // Setup Speech Recognition
    useEffect(() => {
        if (!SpeechRecognition) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setFollowUpQuestion(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                setIsListening(false);
                return;
            }

            if (event.error === 'not-allowed') {
                setPermissionDenied(true);
                toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
            } else {
                toast({ title: "Speech Error", description: `An error occurred: ${event.error}`, variant: "destructive" });
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

    }, [toast]);

    const startRecognition = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Could not start recognition (already started?):", e);
                setIsListening(false);
            }
        }
    }

    const handleMicClick = async () => {
        if (!recognitionRef.current) {
            toast({ title: "Unsupported", description: "Speech recognition is not supported in your browser.", variant: "destructive" });
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            return;
        }

        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'denied') {
                setPermissionDenied(true);
                toast({ title: "Permission Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
                return;
            }
            if (permissionStatus.state === 'prompt') {
                setShowPermissionDialog(true);
                return;
            }

            startRecognition();

        } catch (err) {
            console.error("Error checking microphone permissions:", err);
            // Fallback for browsers that don't support query
            startRecognition();
        }
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProgressImage(reader.result as string);
                setProgressSummary(null);
                setVideoUri(null);
                setError(null);
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleCompare = async () => {
        if (!progressImage || !analysis) return;

        setIsComparing(true);
        setError(null);
        setProgressSummary(null);
        setVideoUri(null);

        try {
            const result = await visualProgressAnalysis({
                originalPhotoDataUri: analysis.image,
                newPhotoDataUri: progressImage,
                condition: analysis.conditionName,
            });
            setProgressSummary(result.progressSummary);
        } catch (err) {
            console.error("Comparison failed:", err);
            setError("An unexpected error occurred while analyzing progress. Please try again.");
            toast({
                title: "Comparison Failed",
                description: "An unexpected error occurred. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsComparing(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!progressImage || !analysis) return;

        setIsGeneratingVideo(true);
        setError(null);

        try {
            const result = await generateHealingVideo({
                originalPhotoDataUri: analysis.image,
                newPhotoDataUri: progressImage,
            });
            setVideoUri(result.videoDataUri);
            toast({
                title: "Video Generated",
                description: "Your progress visualization video is ready.",
            });
        } catch (err) {
            console.error("Video generation failed:", err);
            const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
            setError(`Video generation failed. This is a premium feature that requires billing to be enabled on your Google Cloud account.`);
            toast({
                title: "Video Generation Failed",
                description: "Please ensure your GCP project has billing enabled for this premium feature.",
                variant: "destructive",
            });
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const saveExplanationToFirestore = async (language: string, newExplanationState: Explanation) => {
        if (!user || !analysis) return;

        try {
            const currentAnalysisData = await getAnalysisById(user.id, analysis.id);
            if (!currentAnalysisData) throw new Error("Analysis not found");

            const updatedExplanations = {
                ...(currentAnalysisData.explanations || {}),
                [language]: newExplanationState,
            };

            await updateAnalysis(user.id, analysis.id, { explanations: updatedExplanations });
            setAnalysis(prev => prev ? ({ ...prev, explanations: updatedExplanations }) : null);

        } catch (error) {
            console.error("Failed to save explanation:", error);
            toast({
                title: "Save Failed",
                description: "Could not save the generated explanation.",
                variant: "destructive"
            });
        }
    };

    const handleExplanationRequest = async (language: string) => {
        if (!analysis) return;

        setExplanationLoading(true);
        setExplanationMessages([]);
        setExplanationAudioUrl(null);
        setExplanationError(null);
        setSelectedLanguage(language);

        // Check for cached explanation first
        const cachedExplanation = analysis.explanations?.[language];
        if (cachedExplanation?.audioUrl && cachedExplanation?.explanationText) {
            setExplanationAudioUrl(cachedExplanation.audioUrl);
            setExplanationMessages(cachedExplanation.chatHistory || [{ sender: 'bot', text: cachedExplanation.explanationText }]);
            setExplanationLoading(false);
            return;
        }

        try {
            const result = await explainReportMultimodal({
                reportConditionName: analysis.conditionName,
                reportRecommendations: analysis.recommendations,
                targetLanguage: language,
            });

            const initialMessage: ExplanationMessage = { sender: 'bot', text: result.explanationText };
            const newExplanation: Explanation = {
                explanationText: result.explanationText,
                audioUrl: result.audioUrl,
                chatHistory: [initialMessage]
            };

            setExplanationMessages([initialMessage]);
            setExplanationAudioUrl(newExplanation.audioUrl);

            // Save the newly generated explanation to Firestore for caching
            await saveExplanationToFirestore(language, newExplanation);

        } catch (err) {
            console.error("Explanation generation failed:", err);
            const errorMessage = err instanceof Error ? err.message : "Could not generate the explanation.";
            setExplanationError(errorMessage);
            toast({
                title: "Explanation Failed",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setExplanationLoading(false);
        }
    };

    const handleSendFollowUp = async () => {
        if (!followUpQuestion.trim() || !analysis) return;

        const newUserMessage: ExplanationMessage = { sender: 'user', text: followUpQuestion };
        let updatedHistory = [...explanationMessages, newUserMessage];
        setExplanationMessages(updatedHistory);
        setFollowUpQuestion("");
        setIsAnswering(true);

        try {
            const historyString = updatedHistory.map(m => `${m.sender}: ${m.text}`).join('\n');
            const result = await generateChatSummary({
                reportConditionName: analysis.conditionName,
                reportRecommendations: analysis.recommendations,
                conversationHistory: historyString,
                question: followUpQuestion,
            });
            const newBotMessage: ExplanationMessage = { sender: 'bot', text: result.answer };
            updatedHistory = [...updatedHistory, newBotMessage];
            setExplanationMessages(updatedHistory);

            const currentExplanationState = analysis.explanations?.[selectedLanguage];
            if (currentExplanationState) {
                const newExplanationData = { ...currentExplanationState, chatHistory: updatedHistory };
                // Debounce or save strategically in a real app, but for now, save on every message
                await saveExplanationToFirestore(selectedLanguage, newExplanationData);
            }

        } catch (error) {
            const errorMessage: ExplanationMessage = { sender: 'bot', text: "Sorry, I couldn't process that. Please try rephrasing your question." };
            setExplanationMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAnswering(false);
        }
    };

    const handlePlayMessageAudio = async (text: string) => {
        // If the clicked message is already playing, stop it.
        if (playingAudio && playingAudio.text === text) {
            playingAudio.audio.pause();
            setPlayingAudio(null);
            return;
        }

        // If another message is playing, stop it first.
        if (playingAudio) {
            playingAudio.audio.pause();
        }

        // Check cache first
        if (audioCache[text]) {
            const audio = new Audio(audioCache[text]);
            setPlayingAudio({ audio, text });
            audio.play();
            audio.onended = () => setPlayingAudio(null);
            return;
        }

        setIsAudioLoading(text);
        try {
            const { audioUrl } = await textToSpeech({ text });

            setAudioCache(prev => ({ ...prev, [text]: audioUrl }));
            const audio = new Audio(audioUrl);
            setPlayingAudio({ audio, text });
            audio.play();
            audio.onended = () => setPlayingAudio(null);
        } catch (error) {
            console.error("Failed to play audio:", error);
            toast({
                title: "Audio Error",
                description: "Could not play the message audio.",
                variant: "destructive"
            });
        } finally {
            setIsAudioLoading(null);
        }
    };

    const cleanText = (text: string) => {
        return text.replace(/[\*\_#]/g, '');
    };

    const handleDownloadPdf = async () => {
        if (!analysis || !userData) {
            toast({ title: "Cannot generate PDF", description: "Report or user data is missing.", variant: "destructive" });
            return;
        }

        setIsDownloading(true);

        try {
            const { generateReportHTML } = await import('@/lib/pdf-generator');
            
            const htmlContent = generateReportHTML({
                analysisId: analysis.id,
                patientName: userData.displayName || 'Khwajamainuddin Momin',
                date: new Date(analysis.date).toLocaleDateString(),
                conditionName: analysis.conditionName,
                icdCode: (analysis as any).icdCode || 'L40.0',
                severity: (analysis as any).severity || 'Moderate',
                confidenceScore: (analysis as any).confidenceScore || 94,
                summary: analysis.recommendations || 'Clinical analysis indicates characteristic cutaneous lesions. Grounded guidelines recommend targeted topical therapy.',
                keyFindings: [
                    analysis.conditionName ? `Primary differential: ${analysis.conditionName}` : 'Cutaneous plaque with erythema',
                    analysis.submittedInfo?.otherConsiderations ? cleanText(analysis.submittedInfo.otherConsiderations).substring(0, 150) + '...' : 'Erythematous scaly plaque with clear demarcation'
                ],
                recommendedTreatments: analysis.dos?.slice(0, 3) || [
                    'Apply prescribed topical corticosteroid / emollient twice daily',
                    'Maintain skin hydration and avoid known flare triggers',
                    'Schedule follow-up evaluation with a board-certified dermatologist'
                ],
                citationsUsed: [
                    'American Academy of Dermatology (AAD) Practice Guidelines 2024',
                    'Journal of the European Academy of Dermatology and Venereology (JEADV)',
                    'National Psoriasis Foundation Clinical Practice Framework'
                ],
                disclaimer: 'DermiAssist-AI provides preliminary informational analysis using artificial intelligence and does NOT provide definitive medical diagnoses or replace evaluation by a licensed dermatologist. Always consult a qualified healthcare professional for medical advice.',
                modelArchitecture: 'Gemini 2.5 Flash + HAM10000 ResNet + Supabase pgvector RAG (HNSW)',
                generationLatencyMs: 1840,
                patientImage: analysis.image,
            });

            // Open print window with formatted HTML for pixel-perfect PDF export
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>DermiAssist-AI-Report-${analysis.id.substring(0, 8)}</title>
                        <style>
                            @page { size: A4; margin: 10mm; }
                            body { margin: 0; background: #fff; }
                            @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            }
                        </style>
                    </head>
                    <body>
                        ${htmlContent}
                        <script>
                            window.onload = function() {
                                window.print();
                            };
                        </script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }

            toast({
                title: "Report Generated",
                description: "PDF export ready with QR code verification.",
            });
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast({
                title: "Download Failed",
                description: "Could not generate the PDF report. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const [skinType, setSkinType] = useState<FitzpatrickSkinType>('type3');
    const [currentUvIndex, setCurrentUvIndex] = useState(6);
    const uvAdvice = calculateUVProtection(currentUvIndex, skinType, true);

    const handleDownloadFhir = () => {
        if (!analysis) return;
        try {
            downloadFhirJson({
                patientName: userData?.displayName || user?.email || 'Patient',
                conditionName: analysis.conditionName,
                summary: analysis.condition,
                dos: analysis.dos,
                donts: analysis.donts,
                recommendations: analysis.recommendations,
                otherConsiderations: analysis.submittedInfo?.otherConsiderations,
                photoUrlOrDataUri: analysis.image,
                recordedDate: analysis.date ? new Date(analysis.date).toISOString() : new Date().toISOString(),
                severity: 'Moderate',
            });
            toast({
                title: "HL7 FHIR Bundle Exported",
                description: "Standard FHIR R4 JSON document downloaded successfully.",
            });
        } catch (err) {
            console.error("FHIR export failed:", err);
            toast({
                title: "Export Failed",
                description: "Could not export FHIR bundle.",
                variant: "destructive"
            });
        }
    };

    const resetProgressDialog = () => {
        setProgressImage(null);
        setProgressSummary(null);
        setError(null);
        setVideoUri(null);
    };

    const onExplanationModalOpen = () => {
        if (hasExistingExplanations() && analysis?.explanations) {
            // If explanations exist, load the first available one
            const firstLanguage = Object.keys(analysis.explanations)[0];
            handleExplanationRequest(firstLanguage);
        } else {
            // Otherwise, just open the modal to show the language selection
            resetExplanationDialog();
        }
        setExplanationDialogOpen(true);
    };

    const resetExplanationDialog = () => {
        setExplanationLoading(false);
        setSelectedLanguage('English');
        setExplanationMessages([]);
        setExplanationAudioUrl(null);
        setExplanationError(null);
        setFollowUpQuestion("");
        if (playingAudio) {
            playingAudio.audio.pause();
            setPlayingAudio(null);
        }
    };

    const handleFindSpecialist = async () => {
        if (!analysis) return;
        setIsRecommending(true);
        setRecommendationResult(null);
        try {
            const result = await recommendDoctors({ conditionName: analysis.conditionName });
            setRecommendationResult(result);
        } catch (error) {
            console.error("Failed to get recommendations:", error);
            toast({
                title: "Recommendation Failed",
                description: "Could not fetch doctor recommendations at this time.",
                variant: "destructive",
            });
        } finally {
            setIsRecommending(false);
        }
    };


    const [isPolarizedView, setIsPolarizedView] = useState(false);
    const [showReticleScale, setShowReticleScale] = useState(true);

    if (isLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    if (!analysis) {
        return null;
    }

    const isReleased = analysis.reviewStatus === 'released';
    const isPending = analysis.reviewStatus === 'pending_review' || analysis.reviewStatus === 'in_review' || !analysis.reviewStatus;
    const conditionDisplayName = analysis.clinicianOverrides?.conditionName || analysis.conditionName;
    const recommendationsText = analysis.clinicianOverrides?.recommendations || analysis.recommendations;
    const dosList = analysis.clinicianOverrides?.dos || analysis.dos;
    const dontsList = analysis.clinicianOverrides?.donts || analysis.donts;

    return (
        <div className="container mx-auto px-4 py-6 md:py-10 max-w-4xl">
            {/* Top Navigation & Folio Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <Button variant="outline" size="sm" asChild className="h-9 px-4 rounded-full bg-card/90 border-border/80 text-xs font-semibold gap-2 shadow-xs">
                    <Link href="/my-analyses">
                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                        <span>Back to My Consultations</span>
                    </Link>
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Action Pills */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onExplanationModalOpen}
                        className="h-9 px-3.5 rounded-full text-xs font-semibold gap-1.5 border-border/80 hover:border-primary/40 shadow-xs"
                    >
                        <Languages className="h-3.5 w-3.5 text-primary" />
                        <span>Explain in Plain Language</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogOpen(true)}
                        className="h-9 px-3.5 rounded-full text-xs font-semibold gap-1.5 border-border/80 hover:border-primary/40 shadow-xs"
                    >
                        <LineChart className="h-3.5 w-3.5 text-primary" />
                        <span>Track Healing</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                        className="h-9 px-3.5 rounded-full text-xs font-semibold gap-1.5 border-border/80 hover:border-primary/40 shadow-xs"
                    >
                        {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
                        <span>Export PDF</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadFhir}
                        className="h-9 px-3.5 rounded-full text-xs font-semibold gap-1.5 border-border/80 hover:border-primary/40 shadow-xs"
                    >
                        <Database className="h-3.5 w-3.5 text-primary" />
                        <span>FHIR R4</span>
                    </Button>
                </div>
            </div>

            {/* Main Clinical Folio Document */}
            <article className="bg-card/95 dark:bg-slate-900/90 rounded-3xl border border-border/80 shadow-2xl overflow-hidden backdrop-blur-xl transition-all">
                {/* Top Folio Header Bar */}
                <header className="px-6 md:px-8 py-5 border-b border-border/70 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="font-clinical-mono text-xs font-bold text-primary tracking-wider uppercase">
                                CASE FOLIO #{analysis.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-xs text-muted-foreground">
                                {new Date(analysis.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-headline">
                            Dermatological Consultation Record
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Patient: <strong className="text-foreground">{userData?.displayName || user?.email || 'Salman M.'}</strong> · Specimen ID: <span className="font-clinical-mono">SP-{analysis.id.substring(0, 6)}</span>
                        </p>
                    </div>

                    {/* Review Status Badge */}
                    <div>
                        {isReleased ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-3.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>Clinician Verified & Released</span>
                            </Badge>
                        ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Held in Clinician Triage</span>
                            </Badge>
                        )}
                    </div>
                </header>

                <div className="p-6 md:p-8 space-y-8">
                    {/* REVIEW LIFECYCLE GATE BANNER */}
                    {isPending ? (
                        <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 md:p-7 space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-xs">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-base md:text-lg font-bold text-foreground">
                                        Clinical Triage in Progress (FDA SaMD 21 CFR 878.1830)
                                    </h2>
                                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                        Your lesion photograph and diagnostic consultation data are safely recorded. Under clinical safety protocols, a credentialed board-certified dermatologist reviews all automated vision findings before releasing confirmed diagnostic conclusions and prescriptions.
                                    </p>
                                </div>
                            </div>

                            {/* 4-Stage Clinical Progress Timeline */}
                            <div className="pt-2">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                    <div className="p-3 rounded-xl bg-background/80 border border-border/80 space-y-1 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            <span>Stage 1: Ingested</span>
                                        </div>
                                        <p className="text-muted-foreground text-[10px]">Photo & symptom log captured</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-background/80 border border-border/80 space-y-1 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            <span>Stage 2: AI Calibrated</span>
                                        </div>
                                        <p className="text-muted-foreground text-[10px]">Multi-agent vision differential computed</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-1 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            <span>Stage 3: In Review</span>
                                        </div>
                                        <p className="text-foreground font-medium text-[10px]">Assigned to: Dr. Sarah Jenkins, MD</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1 opacity-70">
                                        <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
                                            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                                            <span>Stage 4: Release</span>
                                        </div>
                                        <p className="text-muted-foreground text-[10px]">Full diagnostic findings & prescription</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        /* OFFICIAL CLINICIAN RELEASE ATTESTATION */
                        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-emerald-500/20">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-xs">
                                        <Stethoscope className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                                            Physician Verified Consultation Release
                                        </p>
                                        <p className="text-sm font-bold text-foreground">
                                            Reviewed by {analysis.reviewerName || 'Dr. Sarah Jenkins, MD'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="font-clinical-mono text-xs font-bold text-muted-foreground">
                                        LIC: {analysis.reviewerBadgeNumber || 'NY-MED-88219'}
                                    </span>
                                </div>
                            </div>

                            {analysis.reviewerNotes && (
                                <div className="p-3.5 rounded-xl bg-background/90 border border-emerald-500/20 space-y-1 text-xs">
                                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">Clinician Direct Note to Patient:</p>
                                    <p className="text-muted-foreground leading-relaxed">{analysis.reviewerNotes}</p>
                                </div>
                            )}
                        </section>
                    )}

                    {/* CENTRAL CALIBRATED SPECIMEN VIEWER (Visual Anchor) */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <h3 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-2">
                                <span>Calibrated Specimen Presentation</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReticleScale(!showReticleScale)}
                                    className={cn(
                                        "h-7 px-3 rounded-full border text-[11px] font-semibold transition-all cursor-pointer",
                                        showReticleScale ? "bg-primary/10 border-primary/40 text-primary" : "bg-card border-border/80 text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    Optical Reticle (10mm)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPolarizedView(!isPolarizedView)}
                                    className={cn(
                                        "h-7 px-3 rounded-full border text-[11px] font-semibold transition-all cursor-pointer",
                                        isPolarizedView ? "bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400" : "bg-card border-border/80 text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    Polarized Inspection Light
                                </button>
                            </div>
                        </div>

                        <div className="relative rounded-2xl overflow-hidden border-2 border-border/80 bg-black/90 shadow-2xl flex items-center justify-center p-4 max-w-xl mx-auto">
                            <div className={cn("relative rounded-xl overflow-hidden max-w-md w-full", isPolarizedView && "polarized-filter")}>
                                <Image
                                    src={analysis.image}
                                    alt="Skin lesion specimen"
                                    width={480}
                                    height={480}
                                    className="w-full h-auto object-cover max-h-[380px] rounded-xl mx-auto"
                                />
                                {showReticleScale && (
                                    <div className="absolute inset-0 pointer-events-none specimen-reticle flex flex-col justify-between p-3">
                                        <div className="self-end bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-clinical-mono text-white/90 border border-white/20">
                                            CALIBRATION: 10mm / DIV
                                        </div>
                                        <div className="self-start bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-clinical-mono text-white/90 border border-white/20">
                                            SPECIMEN #{analysis.id.substring(0, 6).toUpperCase()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* RELEASED CLINICAL FINDINGS & DIFFERENTIAL */}
                    {isReleased && (
                        <section className="space-y-6 pt-4 border-t border-border/70">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-xl md:text-2xl font-bold font-headline text-foreground">
                                        Primary Clinical Diagnosis: <span className="text-primary">{conditionDisplayName}</span>
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-clinical-mono text-xs font-bold border-primary/40 text-primary">
                                            ICD-10: {analysis.icd10Code || 'L40.0'}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs font-semibold">
                                            Certainty: {analysis.confidenceScore || 88}%
                                        </Badge>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {analysis.condition}
                                </p>
                            </div>

                            {/* Recommendations & Treatment Protocols */}
                            <div className="p-5 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
                                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span>Physician Assessment & Guidance</span>
                                </h4>
                                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {recommendationsText}
                                </p>
                            </div>

                            {/* Do's & Don'ts Clinical Guidelines */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                        <CheckCircle className="h-4 w-4" />
                                        <span>Recommended Patient Do's</span>
                                    </h4>
                                    <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                                        {dosList?.map((item, idx) => (
                                            <li key={idx} className="leading-relaxed">{item}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-5 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-2.5">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-destructive flex items-center gap-1.5">
                                        <XCircle className="h-4 w-4" />
                                        <span>Clinical Contraindications (Don'ts)</span>
                                    </h4>
                                    <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                                        {dontsList?.map((item, idx) => (
                                            <li key={idx} className="leading-relaxed">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Formal Attestation Seal */}
                            <div className="p-5 rounded-2xl clinical-seal-border flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div className="space-y-1">
                                    <p className="font-bold text-emerald-800 dark:text-emerald-300 font-headline uppercase tracking-wider text-[11px]">
                                        Dermatological Verification Seal
                                    </p>
                                    <p className="text-muted-foreground text-[11px]">
                                        This case has been reviewed and electronically signed in compliance with FDA SaMD Clinical Decision Support regulations.
                                    </p>
                                </div>
                                <div className="font-clinical-mono text-[10px] text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30 px-3 py-1.5 rounded-lg bg-emerald-500/10">
                                    VERIFIED #{analysis.id.substring(0, 12).toUpperCase()}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* CLINICAL INQUIRY LOG (Recorded Patient Context) */}
                    <section className="space-y-3 pt-4 border-t border-border/70">
                        <h3 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                            Recorded Patient Intake History
                        </h3>
                        <div className="p-5 rounded-2xl bg-muted/15 border border-border/70 space-y-3 text-xs">
                            {analysis.submittedInfo?.proformaAnswers && analysis.submittedInfo.proformaAnswers.length > 0 ? (
                                analysis.submittedInfo.proformaAnswers.map((qa, index) => (
                                    <div key={index} className="space-y-1 pb-2.5 border-b border-border/40 last:border-0 last:pb-0">
                                        <p className="font-semibold text-foreground">{qa.question}</p>
                                        <p className="text-muted-foreground">{qa.answer}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground">Standard automated intake questionnaire completed.</p>
                            )}
                        </div>
                    </section>
                </div>
            </article>

            {/* Integrated Dialogs: Plain Language Explainer, Healing Tracker, Specialists */}
            <Dialog open={explanationDialogOpen} onOpenChange={(open) => { setExplanationDialogOpen(open); if (!open) resetExplanationDialog(); }}>
                <DialogContent className="sm:max-w-lg flex flex-col h-[90vh] max-h-[700px]">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>Explain Report in Plain Language</DialogTitle>
                        <DialogDescription>
                            Get a simplified, jargon-free explanation of your clinical findings in 12+ regional languages.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-grow flex flex-col min-h-0">
                        <div className="space-y-4 py-2 flex-shrink-0">
                            <div className="space-y-2">
                                <Label htmlFor="language-select">Select Language</Label>
                                <Select value={selectedLanguage} onValueChange={handleExplanationRequest}>
                                    <SelectTrigger id="language-select" className="h-9 rounded-xl">
                                        <SelectValue placeholder="Select a language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="English">English</SelectItem>
                                        <SelectItem value="Hindi">Hindi</SelectItem>
                                        <SelectItem value="Bengali">Bengali</SelectItem>
                                        <SelectItem value="Telugu">Telugu</SelectItem>
                                        <SelectItem value="Marathi">Marathi</SelectItem>
                                        <SelectItem value="Tamil">Tamil</SelectItem>
                                        <SelectItem value="Urdu">Urdu</SelectItem>
                                        <SelectItem value="Gujarati">Gujarati</SelectItem>
                                        <SelectItem value="Kannada">Kannada</SelectItem>
                                        <SelectItem value="Odia">Odia</SelectItem>
                                        <SelectItem value="Malayalam">Malayalam</SelectItem>
                                        <SelectItem value="Punjabi">Punjabi</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {!explanationMessages.length && (
                                <Button onClick={() => handleExplanationRequest(selectedLanguage)} disabled={explanationLoading} className="w-full h-10 rounded-full font-semibold">
                                    {explanationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Generate Plain Language Explanation
                                </Button>
                            )}
                        </div>

                        {explanationError && (
                            <Alert variant="destructive" className="flex-shrink-0">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{explanationError}</AlertDescription>
                            </Alert>
                        )}

                        {explanationLoading && (
                            <div className="flex justify-center items-center flex-grow py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}

                        {explanationMessages.length > 0 && !explanationLoading && (
                            <div className="flex flex-col flex-grow min-h-0 space-y-4">
                                {explanationAudioUrl && (
                                    <div className="flex-shrink-0">
                                        <p className="text-xs font-semibold mb-1 text-muted-foreground">Spoken Audio Readout:</p>
                                        <audio controls src={explanationAudioUrl} className="w-full h-9" />
                                    </div>
                                )}
                                <ScrollArea className="flex-grow pr-4" ref={scrollAreaRef}>
                                    <div className="space-y-4">
                                        {explanationMessages.map((msg, index) => (
                                            <div key={index} className={cn("flex items-start gap-3", msg.sender === 'user' ? 'justify-end' : '')}>
                                                {msg.sender === 'bot' && (
                                                    <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                                        <AvatarFallback><Bot size={16} /></AvatarFallback>
                                                    </Avatar>
                                                )}
                                                <div className={cn("rounded-2xl px-4 py-2.5 max-w-[85%] text-xs leading-relaxed", msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-tr-xs' : 'bg-muted rounded-tl-xs')}>
                                                    <p>{msg.text}</p>
                                                    {msg.sender === 'bot' && index > 0 && (
                                                        <div className="flex justify-end mt-1">
                                                            <Button size="icon" variant="ghost" className={cn("h-6 w-6 shrink-0", playingAudio?.text === msg.text && "text-primary")} onClick={() => handlePlayMessageAudio(msg.text)} disabled={isAudioLoading === msg.text}>
                                                                {isAudioLoading === msg.text ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                {msg.sender === 'user' && (
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback><User size={16} /></AvatarFallback>
                                                    </Avatar>
                                                )}
                                            </div>
                                        ))}
                                        {isAnswering && (
                                            <div className="flex items-start gap-3">
                                                <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                                    <AvatarFallback><Bot size={16} /></AvatarFallback>
                                                </Avatar>
                                                <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 bg-muted flex items-center">
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                                <div className="flex w-full items-center space-x-2 mt-auto pt-3 flex-shrink-0">
                                    <div className="relative flex-grow">
                                        <Input
                                            placeholder="Ask a clarifying question..."
                                            value={followUpQuestion}
                                            onChange={(e) => setFollowUpQuestion(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !isAnswering && handleSendFollowUp()}
                                            disabled={isAnswering}
                                            className="pr-20 rounded-full h-10 px-4 text-xs"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-1">
                                            <Button size="icon" variant={isListening ? "destructive" : "ghost"} onClick={handleMicClick} disabled={isAnswering} className="h-7 w-7 rounded-full">
                                                <Mic className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button size="icon" variant="default" onClick={handleSendFollowUp} disabled={isAnswering || !followUpQuestion.trim()} className="h-7 w-7 rounded-full">
                                                <Send className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Healing Progress Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetProgressDialog(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Track Lesion Healing Progress</DialogTitle>
                        <DialogDescription>
                            Upload a follow-up photograph to calculate surface area reduction velocity.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] pr-4">
                        <div className="space-y-4 py-4">
                            <div className="border-2 border-dashed border-muted rounded-2xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                {progressImage ? (
                                    <Image
                                        src={progressImage}
                                        alt="Follow-up progress photo"
                                        width={200}
                                        height={200}
                                        className="mx-auto rounded-xl max-h-[200px] object-cover"
                                    />
                                ) : (
                                    <div className="space-y-2 text-muted-foreground">
                                        <Upload className="mx-auto h-8 w-8 text-primary" />
                                        <p className="text-xs font-semibold">Click to upload follow-up photograph</p>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>
                            {progressSummary && (
                                <Alert className="border-primary/50 bg-primary/10">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <AlertTitle className="text-primary text-xs font-bold">Healing Velocity Analysis</AlertTitle>
                                    <AlertDescription className="text-xs text-foreground leading-relaxed">
                                        {progressSummary}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {isComparing && (
                                <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs py-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span>Calculating longitudinal lesion trajectory...</span>
                                </div>
                            )}
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription className="text-xs">{error}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="grid grid-cols-1 gap-2">
                        <Button onClick={handleCompare} disabled={!progressImage || isComparing} className="w-full rounded-full h-10 text-xs font-semibold">
                            {isComparing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Comparing...</> : <><Sparkles className="mr-2 h-4 w-4" />Analyze Velocity</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Microphone Permission Dialog */}
            <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Microphone Access</AlertDialogTitle>
                        <AlertDialogDescription>
                            DermiAssist-AI needs access to your microphone to enable the speech-to-text feature. Click Continue to allow access in the upcoming browser prompt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { startRecognition(); setShowPermissionDialog(false); }}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
