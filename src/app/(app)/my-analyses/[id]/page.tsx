
"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useAnalyses, type AnalysisReport, type Explanation } from '@/hooks/use-analyses';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileText, XCircle, ArrowLeft, Loader2, Upload, LineChart, Sparkles, Video, BrainCircuit, Languages, Mic, Send, Bot, User, Volume2, Stethoscope, MapPin, Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { visualProgressAnalysis } from '@/ai/flows/visual-progress-analysis';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generateHealingVideo } from '@/ai/flows/generate-healing-video';
import { explainReportMultimodal } from '@/ai/flows/explain-report-multimodal';
import { generateChatSummary } from '@/ai/flows/generate-chat-summary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { uploadFile } from '@/lib/actions';
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

            // Upload audio to Cloudinary
            const uploadResult = await uploadFile(null, result.audioBase64);
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.message || "Audio upload failed.");
            }

            const initialMessage: ExplanationMessage = { sender: 'bot', text: result.explanationText };
            const newExplanation: Explanation = {
                explanationText: result.explanationText,
                audioUrl: uploadResult.url,
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
            const { audioBase64 } = await textToSpeech({ text });
            const uploadResult = await uploadFile(null, audioBase64);
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.message || "Audio upload failed.");
            }

            setAudioCache(prev => ({ ...prev, [text]: uploadResult.url! }));
            const audio = new Audio(uploadResult.url);
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
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;

            // Load logo
            const logoImg = new window.Image();
            logoImg.src = '/dermilogo.png';
            logoImg.crossOrigin = "Anonymous";

            logoImg.onload = () => {
                pdf.addImage(logoImg, 'PNG', margin, margin, 12, 12);
                pdf.setFontSize(18);
                pdf.setFont('helvetica', 'bold');
                pdf.text('DermiAssist-AI Report', margin + 15, margin + 9);

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Report ID: ${analysis.id}`, pageWidth - margin, margin + 9, { align: 'right' });

                pdf.setLineWidth(0.5);
                pdf.line(margin, margin + 15, pageWidth - margin, margin + 15);

                let yPos = margin + 25;

                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Patient Information', margin, yPos);
                yPos += 7;

                pdf.setFont('helvetica', 'normal');
                pdf.text(`Name: ${userData.displayName || 'N/A'}`, margin, yPos);
                yPos += 7;
                pdf.text(`Date of Birth: ${userData.dob ? new Date(userData.dob).toLocaleDateString() : 'N/A'}`, margin, yPos);
                yPos += 7;
                pdf.text(`Address: ${userData.address || 'N/A'}`, margin, yPos);
                yPos += 10;

                pdf.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
                yPos += 7;

                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Analysis Details', margin, yPos);
                yPos += 7;

                pdf.setFont('helvetica', 'normal');
                pdf.text(`Analysis Date: ${new Date(analysis.date).toLocaleString()}`, margin, yPos);
                yPos += 7;
                pdf.text(`Condition Identified:`, margin, yPos);
                yPos += 5;
                pdf.setFont('helvetica', 'bold');
                const conditionNameText = pdf.splitTextToSize(analysis.conditionName, pageWidth - (margin * 2) - 5);
                pdf.text(conditionNameText, margin + 5, yPos);
                yPos += conditionNameText.length * 5 + 5;

                pdf.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
                yPos += 7;

                pdf.setFont('helvetica', 'bold');
                pdf.text('Submitted Information', margin, yPos);
                yPos += 7;

                const submittedImg = new window.Image();
                submittedImg.src = analysis.image;
                submittedImg.crossOrigin = "Anonymous";
                submittedImg.onload = () => {
                    const imgProps = pdf.getImageProperties(submittedImg);
                    const imgRatio = imgProps.width / imgProps.height;
                    const imgWidth = 60;
                    const imgHeight = imgWidth / imgRatio;

                    pdf.addImage(submittedImg, 'JPEG', margin, yPos, imgWidth, imgHeight);

                    let textX = margin + imgWidth + 10;
                    let textY = yPos + 5;
                    const textMaxWidth = pageWidth - textX - margin;

                    if (analysis.submittedInfo?.proformaAnswers && analysis.submittedInfo.proformaAnswers.length > 0) {
                        analysis.submittedInfo.proformaAnswers.forEach(qa => {
                            pdf.setFont('helvetica', 'bold');
                            const question = pdf.splitTextToSize(`Q: ${cleanText(qa.question)}`, textMaxWidth);
                            pdf.text(question, textX, textY);
                            textY += question.length * 4 + 2;

                            pdf.setFont('helvetica', 'normal');
                            const answer = pdf.splitTextToSize(`A: ${cleanText(qa.answer)}`, textMaxWidth);
                            pdf.text(answer, textX, textY);
                            textY += answer.length * 4 + 4;
                        });
                    } else {
                        pdf.setFont('helvetica', 'normal');
                        pdf.text("No additional information was provided for this analysis.", textX, textY);
                        textY += 10;
                    }

                    let contentBottomY = Math.max(yPos + imgHeight, textY);
                    yPos = contentBottomY + 10;

                    const checkAndSwitchPage = (neededHeight: number) => {
                        if (yPos + neededHeight > pageHeight - margin) {
                            pdf.addPage();
                            yPos = margin;
                        }
                    };

                    checkAndSwitchPage(20);
                    pdf.setFontSize(14);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Expert Recommendations', margin, yPos);
                    yPos += 7;
                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    const recommendationsText = pdf.splitTextToSize(cleanText(analysis.recommendations), pageWidth - (margin * 2));
                    pdf.text(recommendationsText, margin, yPos);
                    yPos += recommendationsText.length * 4 + 5;

                    checkAndSwitchPage(20);
                    pdf.setFontSize(12);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text("Do's:", margin, yPos);
                    yPos += 6;
                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    analysis.dos.forEach(item => {
                        checkAndSwitchPage(5);
                        const itemText = pdf.splitTextToSize(`- ${cleanText(item)}`, pageWidth - (margin * 2) - 5);
                        pdf.text(itemText, margin + 5, yPos);
                        yPos += itemText.length * 4 + 2;
                    });

                    yPos += 5;
                    checkAndSwitchPage(20);
                    pdf.setFontSize(12);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text("Don'ts:", margin, yPos);
                    yPos += 6;
                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    analysis.donts.forEach(item => {
                        checkAndSwitchPage(5);
                        const itemText = pdf.splitTextToSize(`- ${cleanText(item)}`, pageWidth - (margin * 2) - 5);
                        pdf.text(itemText, margin + 5, yPos);
                        yPos += itemText.length * 4 + 2;
                    });

                    if (analysis.submittedInfo?.otherConsiderations) {
                        yPos += 5;
                        checkAndSwitchPage(20);
                        pdf.setFontSize(14);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text('Deeper Analysis & Other Considerations', margin, yPos);
                        yPos += 7;
                        pdf.setFontSize(10);
                        pdf.setFont('helvetica', 'normal');
                        const otherConsiderationsText = pdf.splitTextToSize(cleanText(analysis.submittedInfo.otherConsiderations), pageWidth - (margin * 2));
                        pdf.text(otherConsiderationsText, margin, yPos);
                        yPos += otherConsiderationsText.length * 4 + 5;
                    }

                    pdf.save(`DermiAssist-AI-Report-${analysis.id}.pdf`);
                };
            };

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

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/my-analyses">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to My Analyses
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-3xl font-headline">Analysis Report: {analysis.conditionName}</CardTitle>
                            <CardDescription>Generated on {new Date(analysis.date).toLocaleDateString()}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <h3 className="font-semibold text-lg mb-2">About {analysis.conditionName}</h3>
                            <p className="text-muted-foreground leading-relaxed mb-4">{analysis.condition}</p>
                            <h3 className="font-semibold text-xl mb-4 text-primary">Expert Recommendations</h3>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{analysis.recommendations}</p>
                        </CardContent>
                    </Card>

                    {analysis.submittedInfo?.otherConsiderations && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BrainCircuit className="h-6 w-6 text-primary" />
                                    Deeper Analysis & Other Considerations
                                </CardTitle>
                                <CardDescription>
                                    Based on your answers, the AI has provided further insights.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {analysis.submittedInfo.otherConsiderations}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-green-500/50 dark:border-green-500/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <CheckCircle size={24} />
                                    Do's
                                </CardTitle>
                                <CardDescription>Recommended actions to take.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                                    {analysis.dos.map((item, index) => <li key={index}>{item}</li>)}
                                </ul>
                            </CardContent>
                        </Card>
                        <Card className="border-red-500/50 dark:border-red-500/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                    <XCircle size={24} />
                                    Don'ts
                                </CardTitle>
                                <CardDescription>Things you should avoid.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                                    {analysis.donts.map((item, index) => <li key={index}>{item}</li>)}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Submitted Photo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Image src={analysis.image} alt="Skin condition" width={400} height={400} className="rounded-lg max-w-sm mx-auto aspect-square object-cover" style={{ height: 'auto' }} data-ai-hint="skin condition" />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Information Provided</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            {analysis.submittedInfo?.proformaAnswers && analysis.submittedInfo.proformaAnswers.length > 0 ? (
                                analysis.submittedInfo.proformaAnswers.map((qa, index) => (
                                    <div key={index}>
                                        <p className="font-semibold">{qa.question}</p>
                                        <p className="text-muted-foreground">{qa.answer}</p>
                                        {index < analysis.submittedInfo.proformaAnswers!.length - 1 && <Separator className="my-2" />}
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground">No additional information was provided.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                            <CardDescription>Use these tools to manage your report and track progress.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="w-full" onClick={handleFindSpecialist}>
                                            {isRecommending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
                                            Find a Specialist
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Recommended Doctors</DialogTitle>
                                            <DialogDescription>
                                                Based on your analysis for {analysis.conditionName}, here are some recommended specialists.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            {isRecommending ? (
                                                <div className="flex justify-center items-center h-24">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                </div>
                                            ) : recommendationResult ? (
                                                <div className="space-y-4">
                                                    <Alert>
                                                        <Sparkles className="h-4 w-4" />
                                                        <AlertTitle>Recommendation</AlertTitle>
                                                        <AlertDescription>
                                                            {recommendationResult.recommendationReason}
                                                        </AlertDescription>
                                                    </Alert>
                                                    {recommendationResult.doctors.length > 0 ? (
                                                        <ul className="space-y-3">
                                                            {recommendationResult.doctors.map(doc => (
                                                                <li key={doc.id} className="flex items-center justify-between p-2 rounded-md border hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar>
                                                                            <AvatarImage src={doc.avatar} alt={doc.name} data-ai-hint="doctor portrait" />
                                                                            <AvatarFallback>{doc.name.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div>
                                                                            <p className="font-semibold">{doc.name}</p>
                                                                            <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {doc.location}</p>
                                                                        </div>
                                                                    </div>
                                                                    <Button size="sm" asChild><Link href={`/doctors`}>Book</Link></Button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-center text-muted-foreground py-4">No doctors found matching the recommended specialization.</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-center text-muted-foreground py-4">Click "Find a Specialist" to get recommendations.</p>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <Dialog open={explanationDialogOpen} onOpenChange={(open) => { setExplanationDialogOpen(open); if (!open) resetExplanationDialog(); }}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full" onClick={onExplanationModalOpen}>
                                            <Languages className="mr-2 h-4 w-4" />
                                            Explain Report
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-lg flex flex-col h-[90vh] max-h-[700px]">
                                        <DialogHeader className="flex-shrink-0">
                                            <DialogTitle>Explain Report</DialogTitle>
                                            <DialogDescription>
                                                Get a simplified explanation of your report and ask follow-up questions.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="flex-grow flex flex-col min-h-0">
                                            {(<div className="space-y-4 py-2 flex-shrink-0">
                                                <div className="space-y-2">
                                                    <Label htmlFor="language-select">Select Language</Label>
                                                    <Select value={selectedLanguage} onValueChange={handleExplanationRequest}>
                                                        <SelectTrigger id="language-select">
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
                                                    <Button onClick={() => handleExplanationRequest(selectedLanguage)} disabled={explanationLoading} className="w-full">
                                                        {explanationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                        Generate Explanation
                                                    </Button>
                                                )}
                                            </div>
                                            )}

                                            {explanationError && (
                                                <Alert variant="destructive" className="flex-shrink-0">
                                                    <AlertTitle>Error</AlertTitle>
                                                    <AlertDescription>{explanationError}</AlertDescription>
                                                </Alert>
                                            )}

                                            {explanationLoading && (
                                                <div className="flex justify-center items-center flex-grow py-8">
                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                </div>
                                            )}

                                            {explanationMessages.length > 0 && !explanationLoading && (
                                                <div className="flex flex-col flex-grow min-h-0 space-y-4">
                                                    {explanationAudioUrl && (
                                                        <div className="flex-shrink-0">
                                                            <p className="text-sm font-medium mb-2">Main Explanation Audio</p>
                                                            <audio controls src={explanationAudioUrl} className="w-full h-10" />
                                                        </div>
                                                    )}
                                                    <ScrollArea className="flex-grow pr-4" ref={scrollAreaRef}>
                                                        <div className="space-y-4">
                                                            {explanationMessages.map((msg, index) => (
                                                                <div key={index} className={cn("flex items-start gap-3", msg.sender === 'user' ? 'justify-end' : '')}>
                                                                    {msg.sender === 'bot' && (
                                                                        <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                                                            <AvatarFallback><Bot size={18} /></AvatarFallback>
                                                                        </Avatar>
                                                                    )}
                                                                    <div className={cn("rounded-lg px-3 py-2 max-w-[85%]", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                                                        <p className="text-sm">{msg.text}</p>
                                                                        {msg.sender === 'bot' && index > 0 && (
                                                                            <div className="flex justify-end mt-1">
                                                                                <Button size="icon" variant="ghost" className={cn("h-6 w-6 shrink-0", playingAudio?.text === msg.text && "text-primary")} onClick={() => handlePlayMessageAudio(msg.text)} disabled={isAudioLoading === msg.text}>
                                                                                    {isAudioLoading === msg.text ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
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
                                                            {isAnswering && (
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
                                                    <div className="flex w-full items-center space-x-2 mt-auto pt-4 flex-shrink-0">
                                                        <div className="relative flex-grow">
                                                            <Input
                                                                placeholder="Have a doubt? Ask here..."
                                                                value={followUpQuestion}
                                                                onChange={(e) => setFollowUpQuestion(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && !isAnswering && handleSendFollowUp()}
                                                                disabled={isAnswering}
                                                                className="pr-20"
                                                            />
                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                                                                <Button size="icon" variant={isListening ? "destructive" : "ghost"} onClick={handleMicClick} disabled={isAnswering}>
                                                                    <Mic className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="icon" variant="ghost" onClick={handleSendFollowUp} disabled={isAnswering || !followUpQuestion.trim()}>
                                                                    <Send className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetProgressDialog(); }}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full">
                                            <LineChart className="mr-2 h-4 w-4" />
                                            Track Progress
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Track Your Progress</DialogTitle>
                                            <DialogDescription>
                                                Upload a new photo to get an AI-powered comparison and see how your skin is changing.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                                {progressImage ? (
                                                    <Image
                                                        src={progressImage}
                                                        alt="New progress photo"
                                                        width={200}
                                                        height={200}
                                                        className="mx-auto rounded-lg"
                                                    />
                                                ) : (
                                                    <div className="space-y-2 text-muted-foreground">
                                                        <Upload className="mx-auto h-10 w-10" />
                                                        <p className="text-sm">Click to upload a new photo</p>
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
                                                    <AlertTitle className="text-primary">AI Progress Report</AlertTitle>
                                                    <AlertDescription className="text-primary/90">
                                                        {progressSummary}
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            {videoUri && (
                                                <div className="mt-4">
                                                    <video src={videoUri} controls className="w-full rounded-lg" />
                                                </div>
                                            )}
                                            {isComparing && !progressSummary && (
                                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Analyzing progress...</span>
                                                </div>
                                            )}
                                            {isGeneratingVideo && (
                                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Generating video... This may take a moment.</span>
                                                </div>
                                            )}
                                            {error && (
                                                <Alert variant="destructive">
                                                    <AlertTitle>Error</AlertTitle>
                                                    <AlertDescription>{error}</AlertDescription>
                                                </Alert>
                                            )}
                                        </div>
                                        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <Button onClick={handleCompare} disabled={!progressImage || isComparing || isGeneratingVideo} className="w-full">
                                                {isComparing ? (
                                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Comparing...</>
                                                ) : (
                                                    <><Sparkles className="mr-2 h-4 w-4" />Analyze Progress</>
                                                )}
                                            </Button>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="w-full">
                                                            <Button variant="default" onClick={handleGenerateVideo} disabled={!progressImage || isComparing || isGeneratingVideo} className="w-full">
                                                                {isGeneratingVideo ? (
                                                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                                                                ) : (
                                                                    <><Video className="mr-2 h-4 w-4" />Generate Healing Video</>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Premium feature. Requires GCP billing to be enabled.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Button className="w-full" onClick={handleDownloadPdf} disabled={isDownloading}>
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="mr-2 h-4 w-4" />
                                            Download Report
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

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
