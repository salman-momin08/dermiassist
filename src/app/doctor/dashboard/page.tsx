
"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CalendarCheck, Users, FileText, Bot, Loader2, BookUser, ShieldAlert } from "lucide-react"
import { generateAiReportSummary } from "@/ai/flows/generate-ai-report-summary"
import { generateCaseFileSummary } from "@/ai/flows/generate-case-file-summary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"

type Appointment = {
    id: string;
    patientName: string;
    mode: string;
    requestDate: { seconds: number, nanoseconds: number };
    status: 'Pending' | 'Confirmed' | 'Declined' | 'Completed';
    attachedReport?: {
        condition: string;
        recommendations: string;
    };
    [key: string]: any;
};

export default function DoctorDashboardPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const [summary, setSummary] = useState('');
    const [caseFile, setCaseFile] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
    const [activeDialog, setActiveDialog] = useState<'summary' | 'caseFile' | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!user) return;

        setIsLoadingAppointments(true);
        const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            setAppointments(fetchedAppointments);
            setIsLoadingAppointments(false);
        }, (error) => {
            console.error("Error fetching appointments:", error);
            toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
            setIsLoadingAppointments(false);
        });

        return () => unsubscribe();

    }, [user, toast]);

    const { pendingRequests, dashboardStats } = useMemo(() => {
        const pending = appointments.filter(a => a.status === 'Pending');
        const patientIds = new Set(appointments.map(a => a.patientId));
        
        const stats = {
            pendingCount: pending.length,
            totalPatients: patientIds.size,
            reportsToReview: appointments.filter(a => a.attachedReport).length,
        };

        return { pendingRequests: pending, dashboardStats: stats };
    }, [appointments]);


    const handleRequest = async (id: string, newStatus: 'Confirmed' | 'Declined') => {
        const appointmentRef = doc(db, 'appointments', id);
        try {
            await updateDoc(appointmentRef, { status: newStatus });
            toast({
                title: `Request ${newStatus}`,
                description: `The appointment request has been ${newStatus.toLowerCase()}.`,
            });
        } catch (error) {
            console.error(`Failed to ${newStatus.toLowerCase()} request:`, error);
            toast({ title: "Update Failed", description: `Could not ${newStatus.toLowerCase()} the request.`, variant: "destructive" });
        }
    };

    const handleGenerateSummary = async (reportText: string | undefined) => {
        if (!reportText) {
            setSummary("No report was attached to this appointment request.");
            return;
        }
        setIsGenerating(true);
        setSummary('');
        try {
            const result = await generateAiReportSummary({ report: reportText });
            setSummary(result.summary);
        } catch (error) {
            console.error("Failed to generate summary:", error);
            setSummary("Could not generate summary at this time. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleGenerateCaseFile = async (app: Appointment) => {
        setIsGenerating(true);
        setCaseFile('');
        try {
            const result = await generateCaseFileSummary({
                patientName: app.patientName,
                reportCondition: app.attachedReport?.condition || "N/A",
                reportFullText: app.attachedReport?.recommendations || "No report attached.",
                previousNotes: app.previousNotes || "No previous notes.",
            });
            setCaseFile(result.summary);
        } catch (error) {
            console.error("Failed to generate case file:", error);
            setCaseFile("Could not generate case file at this time. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const closeDialog = () => {
        setSummary('');
        setCaseFile('');
        setActiveDialog(null);
    }
    
    if (authLoading) {
        return (
             <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading Doctor Dashboard...</p>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Doctor Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, Dr. {userData?.lastName || 'Doctor'}. Here's what's happening today.</p>
            </div>
            
            {!userData?.verified && (
                <Alert variant="destructive" className="mb-8">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Verification Required</AlertTitle>
                    <AlertDescription>
                        Your account is not verified. Please complete your profile to get access to all features and be visible to patients.
                        <Button variant="link" className="p-0 h-auto ml-2 text-destructive font-semibold" asChild>
                            <Link href="/doctor/profile">Go to Profile</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardStats.pendingCount}</div>
                        <p className="text-xs text-muted-foreground">New appointment requests await your review.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardStats.totalPatients}</div>
                        <p className="text-xs text-muted-foreground">Patients who have booked appointments.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Reports to Review</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardStats.reportsToReview}</div>
                        <p className="text-xs text-muted-foreground">From new and existing patients.</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Appointment Requests</CardTitle>
                    <CardDescription>Review and respond to new appointment requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Patient</TableHead>
                                <TableHead className="hidden sm:table-cell">Requested On</TableHead>
                                <TableHead>AI Tools</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingAppointments ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : pendingRequests.length > 0 ? pendingRequests.map(app => (
                                <TableRow key={app.id}>
                                    <TableCell>
                                        <div className="font-medium">{app.patientName}</div>
                                        <div className="text-sm text-muted-foreground">{app.mode}</div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{format(new Date(app.requestDate.seconds * 1000), 'PP')}</TableCell>
                                    <TableCell>
                                        <Dialog onOpenChange={(open) => !open && closeDialog()}>
                                            <div className="flex items-center gap-2">
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={() => { setActiveDialog('summary'); handleGenerateSummary(app.attachedReport?.recommendations); }}>
                                                        <Bot className="mr-2 h-4 w-4" />
                                                        AI Summary
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={() => { setActiveDialog('caseFile'); handleGenerateCaseFile(app); }}>
                                                        <BookUser className="mr-2 h-4 w-4" />
                                                        Case File
                                                    </Button>
                                                </DialogTrigger>
                                            </div>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        {activeDialog === 'summary' 
                                                            ? `AI Report Summary: ${app.attachedReport?.condition || 'N/A'}`
                                                            : `Case File: ${app.patientName}`
                                                        }
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                         {activeDialog === 'summary' 
                                                            ? `A concise summary generated by AI for a quick overview.`
                                                            : `A comprehensive overview of the patient's case.`
                                                        }
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <ScrollArea className="max-h-[400px] my-4 pr-4">
                                                    {isGenerating ? (
                                                        <div className="flex items-center justify-center p-8">
                                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                            {activeDialog === 'summary' ? summary : caseFile}
                                                        </p>
                                                    )}
                                                </ScrollArea>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="destructive" onClick={() => handleRequest(app.id, 'Declined')}>Decline</Button>
                                        <Button size="sm" onClick={() => handleRequest(app.id, 'Confirmed')}>Approve</Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No pending appointment requests.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
