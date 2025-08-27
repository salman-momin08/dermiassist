
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, MoreHorizontal, PlusCircle, Trash2, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import { useAnalyses, type AnalysisReport } from "@/hooks/use-analyses";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import jsPDF from 'jspdf';
import { useToast } from "@/hooks/use-toast";

export default function MyAnalysesPage() {
    const { analyses, deleteAnalysis, isLoading } = useAnalyses();
    const { user, userData } = useAuth();
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const { toast } = useToast();

    const handleDelete = (id: string) => {
        if (!user) return;
        deleteAnalysis(user.uid, id);
    };

    const handleDownloadPdf = async (analysis: AnalysisReport) => {
        if (!analysis || !userData) {
            toast({ title: "Cannot generate PDF", description: "Report or user data is missing.", variant: "destructive" });
            return;
        }

        setIsDownloading(analysis.id);

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
            
            pdf.setFont('helvetica', 'bold');
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
                const checkAndSwitchPage = (neededHeight: number) => {
                  if (yPos + neededHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                  }
                };

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
                
                yPos += imgHeight > 35 ? imgHeight + 10 : 45;

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
                    yPos += itemText.length * 4;
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
                    yPos += itemText.length * 4;
                });

                pdf.save(`SkinWise-Report-${analysis.id}.pdf`);
                setIsDownloading(null);
            };

        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast({
                title: "Download Failed",
                description: "Could not generate the PDF report. Please try again.",
                variant: "destructive"
            });
            setIsDownloading(null);
        }
    };


    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex items-center justify-between space-y-2 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">
                        My Analyses
                    </h1>
                    <p className="text-muted-foreground">
                        View and manage your past skin analysis reports.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/analyze">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Analysis
                    </Link>
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            <Skeleton className="h-10 w-full rounded-md" />
                            <Skeleton className="h-20 w-full rounded-md" />
                            <Skeleton className="h-20 w-full rounded-md" />
                            <Skeleton className="h-20 w-full rounded-md" />
                        </div>
                    ) : analyses.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="hidden w-[100px] sm:table-cell">Image</TableHead>
                                    <TableHead>Condition</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="hidden md:table-cell">Severity</TableHead>
                                    <TableHead>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analyses.map(analysis => (
                                    <TableRow key={analysis.id}>
                                        <TableCell className="hidden sm:table-cell">
                                            <Image
                                                alt="Analysis image"
                                                className="aspect-square rounded-md object-cover"
                                                height="64"
                                                src={analysis.image}
                                                width="64"
                                                data-ai-hint="skin condition"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{analysis.conditionName}</TableCell>
                                        <TableCell>{new Date(analysis.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="hidden md:table-cell">{analysis.severity}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild><Link href={`/my-analyses/${analysis.id}`} className="flex items-center cursor-pointer"><Eye className="mr-2 h-4 w-4" />View Details</Link></DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleDownloadPdf(analysis); }} className="flex items-center cursor-pointer" disabled={isDownloading === analysis.id}>
                                                            {isDownloading === analysis.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                                            Download
                                                        </DropdownMenuItem>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="flex items-center text-red-600 dark:text-red-500 focus:text-red-600 focus:dark:text-red-500" onSelect={(e) => e.preventDefault()}>
                                                                <Trash2 className="mr-2 h-4 w-4" />Delete
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete this analysis report from the database.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(analysis.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center p-12">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No analyses yet</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Get started by performing your first skin analysis.
                            </p>
                            <Button className="mt-6" asChild>
                                <Link href="/analyze">Start New Analysis</Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
