"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CalendarCheck, Users, FileText, Bot, Loader2 } from "lucide-react"
import { generateAiReportSummary } from "@/ai/flows/generate-ai-report-summary"
import { ScrollArea } from "@/components/ui/scroll-area"

const mockAppointments = [
    {
        id: "APP001",
        patientName: "Liam Johnson",
        patientAvatar: "https://placehold.co/40x40.png",
        requestDate: "2024-07-28",
        mode: "Online",
        status: "Pending",
        reportId: "1",
        reportCondition: "Acne Vulgaris",
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
    },
];

const mockReportFullText = "Analysis Report: Acne Vulgaris. Generated on 2024-05-15. Severity: Mild. It is recommended to use a gentle cleanser twice a day and apply a non-comedogenic moisturizer. Consider using over-the-counter benzoyl peroxide treatments. Avoid picking or squeezing pimples to prevent scarring. If the condition persists or worsens, consult a dermatologist. Do's: Cleanse your face twice daily with a mild, non-abrasive cleanser. Use non-comedogenic (won't clog pores) skin care products and cosmetics. Drink plenty of water to stay hydrated. Don'ts: Avoid harsh scrubbing or over-washing your face. Do not pick, pop, or squeeze pimples. Limit your intake of high-glycemic foods and dairy products if you notice a link. Submitted Info: Pre-medication: None. Disease Duration: 3 months."

export default function DoctorDashboardPage() {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateSummary = async () => {
        setIsLoading(true);
        try {
            const result = await generateAiReportSummary({ report: mockReportFullText });
            setSummary(result.summary);
        } catch (error) {
            console.error("Failed to generate summary:", error);
            setSummary("Could not generate summary at this time.");
        } finally {
            setIsLoading(false);
        }
    };

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
                        <div className="text-2xl font-bold">3</div>
                        <p className="text-xs text-muted-foreground">New appointment requests await your review.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">48</div>
                        <p className="text-xs text-muted-foreground">+2 this month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Reports to Review</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8</div>
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
                                <TableHead className="hidden md:table-cell">Mode</TableHead>
                                <TableHead>AI Report</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockAppointments.map(app => (
                                <TableRow key={app.id}>
                                    <TableCell>
                                        <div className="font-medium">{app.patientName}</div>
                                        <div className="text-sm text-muted-foreground">{app.id}</div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{app.requestDate}</TableCell>
                                    <TableCell className="hidden md:table-cell"><Badge variant={app.mode === 'Online' ? 'default' : 'secondary'}>{app.mode}</Badge></TableCell>
                                    <TableCell>
                                        <Dialog onOpenChange={(open) => {if(open) { handleGenerateSummary() } else { setSummary('') }}}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <Bot className="mr-2 h-4 w-4" />
                                                    AI Summary
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>AI Report Summary for {app.reportCondition}</DialogTitle>
                                                    <DialogDescription>
                                                        This is a concise summary generated by AI for a quick overview.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <ScrollArea className="max-h-[400px] my-4 pr-4">
                                                    {isLoading ? (
                                                        <div className="flex items-center justify-center p-8">
                                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
                                                    )}
                                                </ScrollArea>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="outline">Decline</Button>
                                        <Button size="sm">Approve</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
