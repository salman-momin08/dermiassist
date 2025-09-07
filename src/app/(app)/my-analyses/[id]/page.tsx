
"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useAnalyses, type AnalysisReport, type Explanation } from '@/hooks/use-analyses';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileText, XCircle, ArrowLeft, Loader2, Upload, LineChart, Sparkles, Video, BrainCircuit, Languages, Mic, Send, Bot, User, Volume2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { visualProgressAnalysis } from '@/ai/flows/visual-progress-analysis';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { uploadFile } from '@/lib/actions';


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
    const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);


    // State for speech recognition
    const recognitionRef = useRef<SpeechRecognition | null>(null);
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
            const foundAnalysis = await getAnalysisById(user.uid, id);
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

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0][0].transcript;
            setFollowUpQuestion(transcript);
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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
            const currentAnalysisData = await getAnalysisById(user.uid, analysis.id);
            if (!currentAnalysisData) throw new Error("Analysis not found");

            const updatedExplanations = {
                ...(currentAnalysisData.explanations || {}),
                [language]: newExplanationState,
            };

            await updateAnalysis(user.uid, analysis.id, { explanations: updatedExplanations });
            setAnalysis(prev => prev ? { ...prev, explanations: updatedExplanations } : null);

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

        const cachedExplanation = analysis.explanations?.[language];
        if (cachedExplanation) {
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
             if(currentExplanationState) {
                await saveExplanationToFirestore(selectedLanguage, {
                    ...currentExplanationState,
                    chatHistory: updatedHistory,
                });
            }

        } catch (error) {
            const errorMessage: ExplanationMessage = { sender: 'bot', text: "Sorry, I couldn't process that. Please try rephrasing your question."};
            setExplanationMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAnswering(false);
        }
    };

     const handlePlayMessageAudio = async (text: string) => {
        if (playingAudio) {
            playingAudio.pause();
            setPlayingAudio(null);
        }
        
        try {
            const { audioBase64 } = await textToSpeech({ text });
            const audioDataUri = `data:audio/wav;base64,${audioBase64}`;
            const audio = new Audio(audioDataUri);
            setPlayingAudio(audio);
            audio.play();
            audio.onended = () => setPlayingAudio(null);
        } catch (error) {
            console.error("Failed to play audio:", error);
            toast({
                title: "Audio Error",
                description: "Could not play the message audio.",
                variant: "destructive"
            });
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
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;

            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('SkinWise AI Skin Analysis Report', pageWidth / 2, margin + 5, { align: 'center' });
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Report ID: ${analysis.id}`, pageWidth / 2, margin + 10, { align: 'center' });


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
            
            pdf.line(margin, yPos-3, pageWidth - margin, yPos-3);
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
            
            pdf.line(margin, yPos-3, pageWidth - margin, yPos-3);
            yPos += 7;

            pdf.setFont('helvetica', 'bold');
            pdf.text('Submitted Information', margin, yPos);
            yPos += 7;

            const img = new window.Image();
            img.src = analysis.image;
            img.crossOrigin = "Anonymous"; 
            img.onload = () => {
                const imgProps = pdf.getImageProperties(img);
                const imgRatio = imgProps.width / imgProps.height;
                const imgWidth = 60;
                const imgHeight = imgWidth / imgRatio;

                pdf.addImage(img, 'JPEG', margin, yPos, imgWidth, imgHeight);
                
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

                pdf.save(`SkinWise-Report-${analysis.id}.pdf`);
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
            playingAudio.pause();
            setPlayingAudio(null);
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
                             <Image src={analysis.image} alt="Skin condition" width={400} height={400} className="rounded-lg max-w-sm mx-auto aspect-square object-cover" data-ai-hint="skin condition" />
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
                    
                     <Dialog open={explanationDialogOpen} onOpenChange={(open) => { setExplanationDialogOpen(open); if(!open) resetExplanationDialog(); }}>
                        <DialogTrigger asChild>
                            <Button className="w-full" onClick={onExplanationModalOpen}>
                                <Languages className="mr-2 h-4 w-4" />
                                Explain My Report
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
                            <DialogHeader>
                                <DialogTitle>Explain Report</DialogTitle>
                                <DialogDescription>
                                    Get a simplified explanation of your report and ask follow-up questions.
                                </DialogDescription>
                            </DialogHeader>
                            
                            {!hasExistingExplanations() && !explanationLoading && (
                                <div className="space-y-4 py-2 flex-shrink-0">
                                    <div className="space-y-2">
                                        <Label htmlFor="language-select">Select Language</Label>
                                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                                            <SelectTrigger id="language-select">
                                                <SelectValue placeholder="Select a language" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Language List */}
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
                                    <Button onClick={() => handleExplanationRequest(selectedLanguage)} disabled={explanationLoading} className="w-full">
                                        {explanationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Generate Explanation
                                    </Button>
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
                                <div className="flex flex-col flex-grow min-h-0">
                                     <div className="space-y-2 flex-shrink-0">
                                        <Label htmlFor="language-select-active">Language</Label>
                                        <Select value={selectedLanguage} onValueChange={handleExplanationRequest}>
                                            <SelectTrigger id="language-select-active">
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
                                    <Separator className="my-4 flex-shrink-0" />
                                    {explanationAudioUrl && (
                                        <div className="flex-shrink-0">
                                            <p className="text-sm font-medium mb-2">Main Explanation Audio</p>
                                            <audio controls src={explanationAudioUrl} className="w-full h-10" />
                                            <Separator className="my-4"/>
                                        </div>
                                    )}
                                    <ScrollArea className="flex-grow pr-4 -mr-4" ref={scrollAreaRef}>
                                        <div className="space-y-4">
                                            {explanationMessages.map((msg, index) => (
                                                <div key={index} className={cn("flex items-start gap-3", msg.sender === 'user' ? 'justify-end' : '')}>
                                                    {msg.sender === 'bot' && (
                                                        <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                                            <AvatarFallback><Bot size={18} /></AvatarFallback>
                                                        </Avatar>
                                                    )}
                                                    <div className={cn("rounded-lg px-3 py-2 max-w-[85%] flex items-center gap-2", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                                        <p className="text-sm">{msg.text}</p>
                                                        {msg.sender === 'bot' && index > 0 && (
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handlePlayMessageAudio(msg.text)}>
                                                                <Volume2 className="h-4 w-4" />
                                                            </Button>
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
                                    <div className="relative mt-4 flex-shrink-0">
                                        <Input 
                                            placeholder="Have a doubt? Ask here..." 
                                            value={followUpQuestion}
                                            onChange={(e) => setFollowUpQuestion(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !isAnswering && handleSendFollowUp()}
                                            disabled={isAnswering}
                                        />
                                        <Button size="icon" variant="ghost" className={cn("absolute right-10 top-1/2 -translate-y-1/2 h-8 w-8", isListening && "text-destructive animate-pulse")} onClick={handleMicClick} disabled={isAnswering}>
                                            <Mic className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleSendFollowUp} disabled={isAnswering || !followUpQuestion.trim()}>
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                    
                    <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Microphone Access</AlertDialogTitle>
                                <AlertDialogDescription>
                                    SkinWise needs access to your microphone to enable the speech-to-text feature. Click Continue to allow access in the upcoming browser prompt.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { startRecognition(); setShowPermissionDialog(false); }}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) resetProgressDialog(); }}>
                        <DialogTrigger asChild>
                            <Button className="w-full" variant="secondary">
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
                                            <Button onClick={handleGenerateVideo} disabled={!progressImage || isComparing || isGeneratingVideo} className="w-full" variant="secondary">
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
                                <FileText className="mr-2 h-4 w-4" />
                                Download Report (PDF)
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

