
"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useAnalyses, type AnalysisReport } from '@/hooks/use-analyses';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileText, XCircle, ArrowLeft, Loader2, Upload, LineChart, Sparkles, Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { visualProgressAnalysis } from '@/ai/flows/visual-progress-analysis';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Logo } from '@/components/logo';

export default function AnalysisDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { getAnalysisById, isLoading: isAnalysisLoading } = useAnalyses();
    const { user, userData } = useAuth();

    const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
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

    const fetchAnalysis = useCallback(async () => {
        if (user && id) {
            const foundAnalysis = await getAnalysisById(user.uid, id);
            setAnalysis(foundAnalysis ?? null);
        }
    }, [user, id, getAnalysisById]);

    useEffect(() => {
        fetchAnalysis();
    }, [fetchAnalysis]);

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
                condition: analysis.condition,
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
            // Cannot render Logo component directly, so recreating a simplified version
            pdf.setFillColor(231, 48, 48); // Using HSL from theme, approx converted to RGB
            pdf.circle(margin + 5, margin + 5, 5, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.text('+', margin + 3.5, margin + 6.5);
            
            pdf.setTextColor(0,0,0);
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('SkinWise', margin + 12, margin + 7);
            
            pdf.setFontSize(18);
            pdf.text('AI Skin Analysis Report', pageWidth / 2, margin + 15, { align: 'center' });

            pdf.setLineWidth(0.5);
            pdf.line(margin, margin + 20, pageWidth - margin, margin + 20);

            let yPos = margin + 30;

            // --- Patient Details ---
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Patient Information', margin, yPos);
            yPos += 7;

            pdf.setFont('helvetica', 'normal');
            pdf.text(`Name: ${userData.displayName || 'N/A'}`, margin, yPos);
            pdf.text(`Date of Birth: ${userData.dob ? new Date(userData.dob).toLocaleDateString() : 'N/A'}`, pageWidth / 2, yPos);
            yPos += 7;
            pdf.text(`Gender: ${userData.gender || 'N/A'}`, margin, yPos);
            pdf.text(`Blood Group: ${userData.bloodGroup || 'N/A'}`, pageWidth / 2, yPos);
            yPos += 10;
            
            pdf.line(margin, yPos-3, pageWidth - margin, yPos-3);

            // --- Analysis Details ---
            pdf.setFont('helvetica', 'bold');
            pdf.text('Analysis Details', margin, yPos);
            yPos += 7;
            
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Analysis Date: ${new Date(analysis.date).toLocaleString()}`, margin, yPos);
            yPos += 7;
            pdf.text(`Condition Identified:`, margin, yPos);
            pdf.setFont('helvetica', 'bold');
            pdf.text(analysis.condition, margin + 45, yPos);
            yPos += 10;
            
            pdf.line(margin, yPos-3, pageWidth - margin, yPos-3);

            // --- Submitted Photo & Info ---
            pdf.setFont('helvetica', 'bold');
            pdf.text('Submitted Information', margin, yPos);
            yPos += 7;

            const img = new Image();
            img.src = analysis.image;
            img.onload = () => {
                const imgProps = pdf.getImageProperties(img);
                const imgRatio = imgProps.width / imgProps.height;
                const imgWidth = 60;
                const imgHeight = imgWidth / imgRatio;

                pdf.addImage(img, 'JPEG', margin, yPos, imgWidth, imgHeight);
                
                const textX = margin + imgWidth + 10;
                pdf.setFont('helvetica', 'bold');
                pdf.text('Pre-medication:', textX, yPos + 5);
                pdf.setFont('helvetica', 'normal');
                pdf.text(analysis.submittedInfo.preMedication, textX, yPos + 10);
                
                pdf.setFont('helvetica', 'bold');
                pdf.text('Disease Duration:', textX, yPos + 20);
                pdf.setFont('helvetica', 'normal');
                pdf.text(analysis.submittedInfo.diseaseDuration, textX, yPos + 25);
                
                yPos += imgHeight + 10; // Move yPos past the image

                // --- Recommendations ---
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
                const splitTextAndDraw = (title: string, items: string[], startY: number) => {
                    pdf.setFontSize(12);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(title, margin, startY);
                    startY += 6;
                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    items.forEach(item => {
                        const itemText = pdf.splitTextToSize(`- ${item}`, (pageWidth / 2) - margin - 5);
                        pdf.text(itemText, margin + 5, startY);
                        startY += itemText.length * 4;
                    });
                    return startY;
                }

                const dosY = splitTextAndDraw("Do's:", analysis.dos, yPos);
                const dontsY = splitTextAndDraw("Don'ts:", analysis.donts, yPos);

                yPos = Math.max(dosY, dontsY) + 10;

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

    if (isAnalysisLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex justify-center items-center h-[60vh]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!analysis) {
        // This condition handles both the initial state and the case where the analysis isn't found after loading.
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
                <Card>
                    <CardHeader>
                        <CardTitle>Analysis Not Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">The analysis report you are looking for does not exist or you do not have permission to view it.</p>
                    </CardContent>
                </Card>
            </div>
        )
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
                            <CardTitle className="text-3xl font-headline">Analysis Report: {analysis.condition}</CardTitle>
                            <CardDescription>Generated on {new Date(analysis.date).toLocaleDateString()} | Severity: {analysis.severity}</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <h3 className="font-semibold text-xl mb-4 text-primary">Expert Recommendations</h3>
                             <p className="text-muted-foreground leading-relaxed">{analysis.recommendations}</p>
                        </CardContent>
                    </Card>

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
                             <Image src={analysis.image} alt="Skin condition" width={400} height={400} className="rounded-lg w-full aspect-square object-cover" data-ai-hint="skin condition" />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>Information Provided</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between">
                                <span className="font-medium text-muted-foreground">Pre-medication:</span>
                                <span className="font-semibold">{analysis.submittedInfo.preMedication}</span>
                            </div>
                            <Separator/>
                            <div className="flex justify-between">
                                <span className="font-medium text-muted-foreground">Disease Duration:</span>
                                <span className="font-semibold">{analysis.submittedInfo.diseaseDuration}</span>
                            </div>
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
                                            {/* This div is needed for the tooltip to work on a disabled button */}
                                            <div className="w-full">
                                                <Button disabled={true} className="w-full" variant="secondary">
                                                    <Video className="mr-2 h-4 w-4" />Generate Healing Video
                                                </Button>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This premium feature requires GCP billing to be enabled.</p>
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

    