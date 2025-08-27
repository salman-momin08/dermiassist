
"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CalendarCheck, Users, FileText, Bot, Loader2, BookUser, ShieldAlert } from "lucide-react"
import { generateAiReportSummary } from "@/ai/flows/generate-ai-report-summary"
import { generateCaseFileSummary } from "@/ai/flows/generate-case-file-summary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"

// In a real app, this would be fetched from Firestore
const initialAppointments: any[] = [
    {
      id: "APP001",
      patientName: "John Smith",
      mode: "Online",
      requestDate: "2024-08-26",
      status: "Pending",
      reportId: "REP001",
      reportCondition: "Acne Vulgaris",
      reportFullText:
        "The patient presents with moderate acne vulgaris on the face, primarily comedonal with some inflammatory papules. Pre-medication: None. Duration: 6 months. The analysis suggests a combination therapy of topical retinoids and benzoyl peroxide.",
      previousNotes: "First consultation.",
    },
    {
      id: "APP002",
      patientName: "Emily White",
      mode: "Offline",
      requestDate: "2024-08-25",
      status: "Pending",
      reportId: "REP002",
      reportCondition: "Eczema",
      reportFullText:
        "The patient has chronic atopic dermatitis on her hands. Pre-medication: OTC hydrocortisone. Duration: 2 years. The AI recommends a stronger topical steroid and consistent use of emollients.",
      previousNotes:
        "Patient has a history of seasonal flare-ups. Previous treatment with OTC creams had limited success.",
    },
];

const mockDashboardStats = {
    totalPatients: 124,
    newPatientsThisMonth: 12,
    reportsToReview: 5,
};


export default function DoctorDashboardPage() {
    const { userData, loading: authLoading } = useAuth();
    const [summary, setSummary] = useState('');
    const [caseFile, setCaseFile] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [appointments, setAppointments] = useState(initialAppointments);
    const [activeDialog, setActiveDialog] = useState<'summary' | 'caseFile' | null>(null);
    const { toast } = useToast();

    const pendingRequests = useMemo(() => {
        return appointments.filter(a => a.status === 'Pending');
    }, [appointments]);

    const handleRequest = (id: string, newStatus: 'Approved' | 'Declined') => {
        setAppointments(prev => prev.filter(app => app.id !== id));
        toast({
            title: `Request ${newStatus}`,
            description: `The appointment request has been ${newStatus.toLowerCase()}.`,
        });
    };

    const handleGenerateSummary = async (reportText: string) => {
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
    
    const handleGenerateCaseFile = async (app: typeof appointments[0]) => {
        setIsGenerating(true);
        setCaseFile('');
        try {
            const result = await generateCaseFileSummary({
                patientName: app.patientName,
                reportCondition: app.reportCondition,
                reportFullText: app.reportFullText,
                previousNotes: app.previousNotes,
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
                        <div className="text-2xl font-bold">{pendingRequests.length}</div>
                        <p className="text-xs text-muted-foreground">New appointment requests await your review.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockDashboardStats.totalPatients}</div>
                        <p className="text-xs text-muted-foreground">+{mockDashboardStats.newPatientsThisMonth} this month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Reports to Review</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockDashboardStats.reportsToReview}</div>
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
                            {pendingRequests.length > 0 ? pendingRequests.map(app => (
                                <TableRow key={app.id}>
                                    <TableCell>
                                        <div className="font-medium">{app.patientName}</div>
                                        <div className="text-sm text-muted-foreground">{app.mode}</div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{app.requestDate}</TableCell>
                                    <TableCell>
                                        <Dialog onOpenChange={(open) => !open && closeDialog()}>
                                            <div className="flex items-center gap-2">
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={() => { setActiveDialog('summary'); handleGenerateSummary(app.reportFullText); }}>
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
                                                            ? `AI Report Summary: ${app.reportCondition}`
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
                                        <Button size="sm" onClick={() => handleRequest(app.id, 'Approved')}>Approve</Button>
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
