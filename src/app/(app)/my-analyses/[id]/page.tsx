
"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useAnalyses, type AnalysisReport } from '@/hooks/use-analyses';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileText, XCircle, ArrowLeft, Loader2, Upload, LineChart, Sparkles, Video, BrainCircuit } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { visualProgressAnalysis } from '@/ai/flows/visual-progress-analysis';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Logo } from '@/components/logo';
import { generateHealingVideo } from '@/ai/flows/generate-healing-video';


export default function AnalysisDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { getAnalysisById } = useAnalyses();
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

    useEffect(() => {
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
        
        if (!isAuthLoading && user) {
            fetchAnalysis();
        } else if (!isAuthLoading && !user) {
            router.push('/login');
        }
    }, [id, user, isAuthLoading, getAnalysisById, router]);


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

            // --- Header ---
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('SkinWise AI Skin Analysis Report', pageWidth / 2, margin + 5, { align: 'center' });
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Report ID: ${analysis.id}`, pageWidth / 2, margin + 10, { align: 'center' });


            pdf.setLineWidth(0.5);
            pdf.line(margin, margin + 15, pageWidth - margin, margin + 15);

            let yPos = margin + 25;

            // --- Patient Details ---
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

            // --- Analysis Details ---
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

            // --- Submitted Photo & Info ---
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
                        const question = pdf.splitTextToSize(`Q: ${qa.question}`, textMaxWidth);
                        pdf.text(question, textX, textY);
                        textY += question.length * 4 + 2;
                        
                        pdf.setFont('helvetica', 'normal');
                        const answer = pdf.splitTextToSize(`A: ${qa.answer}`, textMaxWidth);
                        pdf.text(answer, textX, textY);
                        textY += answer.length * 4 + 4;
                    });
                } else {
                     pdf.setFont('helvetica', 'normal');
                     pdf.text("No additional information was provided for this analysis.", textX, textY);
                     textY += 10;
                }
                
                // Determine the correct Y position for the next section
                // It should be below either the image or the text block, whichever is lower.
                let contentBottomY = Math.max(yPos + imgHeight, textY);
                yPos = contentBottomY + 10;

                const checkAndSwitchPage = (neededHeight: number) => {
                  if (yPos + neededHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                  }
                };

                // --- Recommendations ---
                checkAndSwitchPage(20);
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Recommendations', margin, yPos);
                yPos += 7;
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                const recommendationsText = pdf.splitTextToSize(analysis.recommendations, pageWidth - (margin * 2));
                pdf.text(recommendationsText, margin, yPos);
                yPos += recommendationsText.length * 4 + 5;

                // --- Do's and Don'ts ---
                checkAndSwitchPage(20);
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text("Do's:", margin, yPos);
                yPos += 6;
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                analysis.dos.forEach(item => {
                    checkAndSwitchPage(5);
                    const itemText = pdf.splitTextToSize(`- ${item}`, pageWidth - (margin * 2) - 5);
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
                    const itemText = pdf.splitTextToSize(`- ${item}`, pageWidth - (margin * 2) - 5);
                    pdf.text(itemText, margin + 5, yPos);
                    yPos += itemText.length * 4 + 2;
                });

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

    const resetDialog = () => {
        setProgressImage(null);
        setProgressSummary(null);
        setError(null);
        setVideoUri(null);
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!analysis) {
        // notFound() will be called by the useEffect hook if data is not found
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
                             <p className="text-muted-foreground leading-relaxed">{analysis.recommendations}</p>
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

                    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) resetDialog(); }}>
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
