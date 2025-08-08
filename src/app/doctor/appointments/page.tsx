
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"


const initialAppointments = [
    {
        id: "APP001",
        patientName: "Liam Johnson",
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
        requestDate: "2024-07-27",
        mode: "Online",
        status: "Confirmed",
        appointmentDate: "2024-08-05",
        appointmentTime: "11:00 AM",
        reportId: "3",
        reportCondition: "Rosacea",
        reportFullText: "Analysis Report: Rosacea. Generated on 2024-03-10. Severity: Mild. It is recommended to identify and avoid triggers such as spicy foods, alcohol, and extreme temperatures. A gentle skincare routine is crucial. Sun protection is paramount. Do's: Use sunscreen daily. Choose gentle, fragrance-free skincare products. Keep a diary to identify personal triggers. Don'ts: Avoid sun exposure without protection. Do not use harsh exfoliants or astringents. Be cautious with hot beverages and spicy foods. Submitted Info: Pre-medication: None. Disease Duration: 1 year."
    },
    {
        id: "APP004",
        patientName: "Emma Brown",
        requestDate: "2024-07-26",
        mode: "Offline",
        status: "Completed",
        appointmentDate: "2024-07-30",
        appointmentTime: "02:30 PM",
        reportId: "4",
        reportCondition: "Psoriasis",
        reportFullText: "...",
        notes: "Prescribed a new topical steroid and recommended light therapy."
    },
];

export default function DoctorAppointmentsPage() {
    const [summary, setSummary] = useState('');
    const [caseFile, setCaseFile] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [appointments, setAppointments] = useState(initialAppointments);
    const [activeDialog, setActiveDialog] = useState<'summary' | 'caseFile' | null>(null);
    const { toast } = useToast();

    const handleRequest = (id: string, newStatus: 'Confirmed' | 'Declined') => {
        setAppointments(prev =>
            prev.map(app =>
                app.id === id ? { ...app, status: newStatus } : app
            )
        );
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

    const renderTable = (data: typeof appointments) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length > 0 ? data.map(app => (
                    <TableRow key={app.id}>
                        <TableCell>
                            <div className="font-medium">{app.patientName}</div>
                            <div className="text-sm text-muted-foreground">{app.mode}</div>
                        </TableCell>
                        <TableCell>
                            {app.status === 'Pending' ? `Requested: ${app.requestDate}` : `${app.appointmentDate} at ${app.appointmentTime}`}
                        </TableCell>
                         <TableCell>
                            <Badge variant={
                                app.status === 'Confirmed' ? 'default' :
                                app.status === 'Completed' ? 'secondary' : 'outline'
                            }>{app.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                             {app.status === 'Pending' ? (
                                <>
                                    <Button size="sm" variant="outline" onClick={() => handleRequest(app.id, 'Declined')}>Decline</Button>
                                    <Button size="sm" onClick={() => handleRequest(app.id, 'Confirmed')}>Confirm</Button>
                                </>
                             ) : (
                                <>
                                    <Button size="sm" variant="outline" disabled>E-Prescription</Button>
                                    <Button size="sm" disabled>Add Notes</Button>
                                </>
                             )}
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                            No appointments in this category.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Appointments</h1>
                <p className="text-muted-foreground">Manage your patient appointment schedule and requests.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Appointment Management</CardTitle>
                     <CardDescription>Review pending requests and view your schedule.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="pending">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                            <TabsTrigger value="declined">Declined</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending">
                            {renderTable(appointments.filter(a => a.status === 'Pending'))}
                        </TabsContent>
                        <TabsContent value="confirmed">
                             {renderTable(appointments.filter(a => a.status === 'Confirmed'))}
                        </TabsContent>
                        <TabsContent value="completed">
                             {renderTable(appointments.filter(a => a.status === 'Completed'))}
                        </TabsContent>
                        <TabsContent value="declined">
                             {renderTable(appointments.filter(a => a.status === 'Declined'))}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
