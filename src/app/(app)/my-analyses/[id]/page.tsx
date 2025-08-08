
"use client";

import { useEffect, useState, useRef } from 'react';
import { notFound } from 'next/navigation';
import { useAnalyses, type AnalysisReport } from '@/hooks/use-analyses';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileText, XCircle, ArrowLeft, Loader2, Upload, LineChart, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { visualProgressAnalysis } from '@/ai/flows/visual-progress-analysis';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AnalysisDetailPage({ params }: { params: { id: string } }) {
    const { getAnalysisById, isLoading } = useAnalyses();
    const [analysis, setAnalysis] = useState<AnalysisReport | undefined>(undefined);
    const [progressImage, setProgressImage] = useState<string | null>(null);
    const [isComparing, setIsComparing] = useState(false);
    const [progressSummary, setProgressSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!isLoading) {
            const foundAnalysis = getAnalysisById(params.id);
            setAnalysis(foundAnalysis);
        }
    }, [isLoading, params.id, getAnalysisById]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProgressImage(reader.result as string);
                setProgressSummary(null);
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

    if (isLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex justify-center items-center h-[60vh]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        )
    }

    if (!analysis) {
        return notFound();
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
                            <CardDescription>Generated on {analysis.date} | Severity: {analysis.severity}</CardDescription>
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
                            </Header>
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
                            </Header>
                            <CardContent>
                               <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                                    {analysis.donts.map((item, index) => <li key={index}>{item}</li>)}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>Your Submitted Photo</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Image src={analysis.image} alt="Skin condition" width={400} height={400} className="rounded-lg w-full aspect-square object-cover" data-ai-hint="skin condition" />
                        </CardContent>
                    </Card>
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

                    <Dialog onOpenChange={() => { setProgressImage(null); setProgressSummary(null); setError(null); }}>
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
                                 {error && (
                                    <Alert variant="destructive">
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCompare} disabled={!progressImage || isComparing} className="w-full">
                                    {isComparing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Comparing...
                                        </>
                                    ) : (
                                        "Compare with Original"
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    
                    <Button className="w-full">
                        <FileText className="mr-2 h-4 w-4" />
                        Download Report (PDF)
                    </Button>
                </div>
            </div>
        </div>
    );
}
