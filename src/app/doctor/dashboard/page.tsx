
"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CalendarCheck, Users, FileText, Bot, Loader2, BookUser } from "lucide-react"
import { generateAiReportSummary } from "@/ai/flows/generate-ai-report-summary"
import { generateCaseFileSummary } from "@/ai/flows/generate-case-file-summary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

const initialAppointments = [
    {
        id: "APP001",
        patientName: "Liam Johnson",
        patientAvatar: "https://placehold.co/40x40.png",
        requestDate: "2024-07-28",
        mode: "Online",
        status: "Pending",
        reportId: "1",
        reportCondition: "Acne Vulgaris",
        reportFullText: "Analysis Report: Acne Vulgaris. Generated on 2024-05-15. Severity: Mild. It is recommended to use a gentle cleanser twice a day and apply a non-comedogenic moisturizer. Consider using over-the-counter benzoyl peroxide treatments. Avoid picking or squeezing pimples to prevent scarring. If the condition persists or worsens, consult a dermatologist. Do's: Cleanse your face twice daily with a mild, non-abrasive cleanser. Use non-comedogenic (won't clog pores) skin care products and cosmetics. Drink plenty of water to stay hydrated. Don'ts: Avoid harsh scrubbing or over-washing your face. Do not pick, pop, or squeeze pimples. Limit your intake of high-glycemic foods and dairy products if you notice a link. Submitted Info: Pre-medication: None. Disease Duration: 3 months.",
        previousNotes: "Initial consultation. Patient is new to the platform. No major concerns reported other than the current acne breakout."
    },
    {
        id: "APP002",
        patientName: "Olivia Smith",
        patientAvatar: "https://placehold.co/40x40.png",
        requestDate: "2024-07-27",
        mode: "Offline",
        status: "Pending",
        reportId: "2",
        reportCondition: "Eczema",
        reportFullText: "Analysis Report: Eczema. Generated on 2024-04-22. Severity: Moderate. Recommendations include daily moisturizing with a thick cream, avoiding known triggers like certain fabrics or soaps, and using a humidifier. Short, lukewarm baths are advised. Do's: Moisturize daily. Wear soft, breathable clothing. Use a humidifier in dry or cold weather. Don'ts: Avoid long, hot baths or showers. Steer clear of harsh soaps and detergents. Try not to scratch the affected area to prevent infection. Submitted Info: Pre-medication: Hydrocortisone cream (1%). Disease Duration: 6 months.",
        previousNotes: "Follow-up for eczema management. Patient reports the hydrocortisone cream is providing some relief but flare-ups persist, especially in dry weather."
    },
    {
        id: "APP003",
        patientName: "Noah Williams",
        patientAvatar: "https://placehold.co/40x40.png",
        requestDate: "2024-07-27",
        mode: "Online",
        status: "Pending",
        reportId: "3",
        reportCondition: "Rosacea",
        reportFullText: "Analysis Report: Rosacea. Generated on 2024-03-10. Severity: Mild. It is recommended to identify and avoid triggers such as spicy foods, alcohol, and extreme temperatures. A gentle skincare routine is crucial. Sun protection is paramount. Do's: Use sunscreen daily. Choose gentle, fragrance-free skincare products. Keep a diary to identify personal triggers. Don'ts: Avoid sun exposure without protection. Do not use harsh exfoliants or astringents. Be cautious with hot beverages and spicy foods. Submitted Info: Pre-medication: None. Disease Duration: 1 year."
    },
];

// Mock data, in a real app this would come from an API
const mockDashboardStats = {
    totalPatients: 48,
    newPatientsThisMonth: 2,
    reportsToReview: 8,
};

export default function DoctorDashboardPage() {
    const [summary, setSummary] = useState('');
    const [caseFile, setCaseFile] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [appointments, setAppointments] = useState(initialAppointments);
    const [activeDialog, setActiveDialog] = useState<'summary' | 'caseFile' | null>(null);
    const { toast } = useToast();

    const pendingRequestsCount = useMemo(() => {
        return appointments.filter(a => a.status === 'Pending').length;
    }, [appointments]);

    const handleRequest = (id: string, newStatus: 'Approved' | 'Declined') => {
        setAppointments(prev => prev.filter(app => app.id !== id));
        toast({
            title: `Request ${newStatus}`,
            description: `The appointment request has been ${newStatus.toLowerCase()}.`,
        });
    };

    const handleGenerateSummary = async (reportText: string) => {
        setIsLoading(true);
        setSummary('');
        try {
            const result = await generateAiReportSummary({ report: reportText });
            setSummary(result.summary);
        } catch (error) {
            console.error("Failed to generate summary:", error);
            setSummary("Could not generate summary at this time. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateCaseFile = async (app: typeof appointments[0]) => {
        setIsLoading(true);
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
            setIsLoading(false);
        }
    };

    const closeDialog = () => {
        setSummary('');
        setCaseFile('');
        setActiveDialog(null);
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Doctor Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, Dr. Grant. Here's what's happening today.</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingRequestsCount}</div>
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
                            {pendingRequestsCount > 0 ? appointments.filter(a => a.status === 'Pending').map(app => (
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
                                                    {isLoading ? (
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
                                        <Button size="sm" variant="outline" onClick={() => handleRequest(app.id, 'Declined')}>Decline</Button>
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
