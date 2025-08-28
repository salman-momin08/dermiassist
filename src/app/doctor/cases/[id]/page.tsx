
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, User, Calendar, Bot, MessageSquare, Loader2, FileText, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useParams, notFound } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { AnalysisReport } from "@/hooks/use-analyses";

type Appointment = {
    id: string;
    requestDate: { seconds: number };
    appointmentDate?: string;
    status: string;
    notes?: string;
    attachedReport?: any;
    uploadedImageUrls?: string[];
    uploadedReportUrls?: string[];
};

type TimelineItem = {
    type: 'appointment' | 'analysis';
    title: string;
    description: string;
    date: string;
};

type CaseDetails = {
    patient: any;
    appointments: Appointment[];
    analyses: AnalysisReport[];
    timeline: TimelineItem[];
};

export default function CaseDetailPage() {
    const params = useParams();
    const patientId = params.id as string;
    const { user } = useAuth();
    const { toast } = useToast();

    const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (!user || !patientId) return;

        const fetchCaseDetails = async () => {
            setIsLoading(true);
            try {
                // Fetch patient data
                const patientDocRef = doc(db, "users", patientId);
                const patientDoc = await getDoc(patientDocRef);
                if (!patientDoc.exists()) {
                    notFound();
                    return;
                }
                const patientData = patientDoc.data();
                setNotes(patientData.doctorNotes?.[user.uid] || ""); // Load notes specific to this doctor

                // Fetch appointments with this patient
                const apptQuery = query(
                    collection(db, "appointments"),
                    where("doctorId", "==", user.uid),
                    where("patientId", "==", patientId)
                );
                const apptSnapshot = await new Promise<any>((resolve) => onSnapshot(apptQuery, resolve));
                const appointments = apptSnapshot.docs.map((d:any) => ({ id: d.id, ...d.data() }));

                // Fetch analyses for this patient
                const analysesQuery = query(collection(db, "users", patientId, "analyses"));
                const analysesSnapshot = await new Promise<any>((resolve) => onSnapshot(analysesQuery, resolve));
                const analyses = analysesSnapshot.docs.map((d:any) => ({ id: d.id, ...d.data() }));

                // Create timeline
                const timeline: TimelineItem[] = [];
                appointments.forEach((app: Appointment) => {
                    timeline.push({
                        type: 'appointment',
                        title: `Appointment ${app.status}`,
                        description: `Appointment was ${app.status.toLowerCase()}`,
                        date: app.appointmentDate ? format(new Date(app.appointmentDate), "PPp") : format(new Date(app.requestDate.seconds * 1000), "PPp"),
                    });
                });
                analyses.forEach((an: AnalysisReport) => {
                    timeline.push({
                        type: 'analysis',
                        title: 'AI Analysis Completed',
                        description: `Identified: ${an.conditionName}`,
                        date: format(new Date(an.date), "PPp"),
                    });
                });

                timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setCaseDetails({
                    patient: patientData,
                    appointments,
                    analyses,
                    timeline
                });

            } catch (error) {
                console.error("Error fetching case details:", error);
                toast({ title: "Error", description: "Could not load case details.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCaseDetails();
    }, [user, patientId, toast]);

    const handleSaveNotes = async () => {
        if (!user) return;
        toast({ title: "Saving Notes..." });
        const patientDocRef = doc(db, "users", patientId);
        try {
            // Use dot notation to update a map field
            await updateDoc(patientDocRef, {
                [`doctorNotes.${user.uid}`]: notes
            });
            toast({
                title: "Notes Saved",
                description: "Your notes for this case have been successfully updated.",
            });
        } catch (error) {
            console.error("Error saving notes:", error);
            toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
        }
    };
    
    const allUploadedImages = caseDetails?.appointments.flatMap(a => a.uploadedImageUrls || []) || [];
    const allUploadedReports = caseDetails?.appointments.flatMap(a => a.uploadedReportUrls || []) || [];


    if (isLoading) {
        return (
             <div className="container mx-auto p-4 md:p-8 flex justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    if (!caseDetails) {
       return (
        <div className="container mx-auto p-4 md:p-8">
             <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/doctor/cases">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Cases
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Case Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">The case you are looking for does not exist or you do not have permission to view it.</p>
                </CardContent>
            </Card>
        </div>
       )
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/doctor/cases">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Cases
                    </Link>
                </Button>
            </div>
            
            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline">Case Details</CardTitle>
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-sm text-muted-foreground">Patient ID: {caseDetails.patient.uid}</span>
                            </div>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Uploaded Files</CardTitle>
                            <CardDescription>All files uploaded by the patient across all appointments.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {allUploadedImages.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="font-semibold mb-2">Condition Photos</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {allUploadedImages.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt={`Patient upload ${i + 1}`} className="rounded-lg object-cover aspect-square hover:opacity-80 transition-opacity" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                             {allUploadedReports.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">Previous Medical Reports</h4>
                                    <div className="space-y-2">
                                        {allUploadedReports.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="secondary" className="w-full justify-start">
                                                    <Download className="mr-2" /> Report {i + 1}
                                                </Button>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                             {allUploadedImages.length === 0 && allUploadedReports.length === 0 && (
                                 <p className="text-muted-foreground text-center py-8">No files have been uploaded by this patient.</p>
                             )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Case Activity</CardTitle>
                            <CardDescription>A timeline of the patient's reports and appointments.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {caseDetails.timeline.map((item: any, index: number) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                                                {item.type === 'appointment' ? <Calendar className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                                            </div>
                                            {index < caseDetails.timeline.length - 1 && <div className="w-px h-full bg-border" />}
                                        </div>
                                        <div className="pb-6">
                                            <p className="font-semibold">{item.title}</p>
                                            <p className="text-sm text-muted-foreground">{item.description}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="text-primary" />
                                Patient Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={caseDetails.patient.photoURL || `https://placehold.co/100x100.png?text=${caseDetails.patient.displayName.charAt(0)}`} data-ai-hint="patient portrait" />
                                    <AvatarFallback>{caseDetails.patient.displayName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-lg">{caseDetails.patient.displayName}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {caseDetails.patient.dob ? `${new Date().getFullYear() - new Date(caseDetails.patient.dob).getFullYear()} years old, ` : ''} 
                                        {caseDetails.patient.gender}
                                    </p>
                                </div>
                            </div>
                            <Separator />
                             <div className="space-y-2">
                                <Button className="w-full" variant="outline">
                                    <FileText className="mr-2 h-4 w-4" /> View Full Medical History
                                </Button>
                                 <Button className="w-full" asChild>
                                    <Link href="/doctor/chat">
                                        <MessageSquare className="mr-2 h-4 w-4" /> Chat with Patient
                                    </Link>
                                </Button>
                             </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Doctor's Notes</CardTitle>
                            <CardDescription>Private notes for this case. Not visible to the patient.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="Add your notes here..."
                                className="min-h-[200px]"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                            <Button className="w-full" onClick={handleSaveNotes}>
                                Save Notes
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
