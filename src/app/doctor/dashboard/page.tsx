"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CalendarCheck, Users, FileText, Bot, Loader2, BookUser, ShieldAlert, Paperclip } from "lucide-react"
import { generateAiReportSummary } from "@/ai/flows/generate-ai-report-summary"
import { generateCaseFileSummary } from "@/ai/flows/generate-case-file-summary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { format, parse, isValid } from "date-fns"
import { Separator } from "@/components/ui/separator"

type Appointment = {
    id: string;
    patientName: string;
    patientId: string;
    mode: string;
    requestDate: string; // ISO string from Supabase
    preferredDate?: string;
    preferredTime?: string;
    status: 'Pending' | 'Confirmed' | 'Declined' | 'Completed';
    attachedReport?: {
        condition: string;
        recommendations: string;
    };
    uploadedImageUrls?: string[];
    uploadedReportUrls?: string[];
    reasonForVisit?: string;
    previousNotes?: string;
    [key: string]: any;
};

export default function DoctorDashboardPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const [summary, setSummary] = useState('');
    const [caseFile, setCaseFile] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
    const [activeDialog, setActiveDialog] = useState<'summary' | 'caseFile' | 'attachments' | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const { toast } = useToast();
    const supabase = createClient();

    // Connection Requests State
    const [connectionRequests, setConnectionRequests] = useState<any[]>([]);
    const [isLoadingConnectionRequests, setIsLoadingConnectionRequests] = useState(true);

    useEffect(() => {
        if (!user) return;

        setIsLoadingAppointments(true);
        setIsLoadingConnectionRequests(true);

        async function fetchData() {
            // Fetch Appointments
            const { data: appointmentsData, error: appointmentsError } = await supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', user!.id);

            if (appointmentsError) {
                toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
            } else if (appointmentsData) {
                const mapped: Appointment[] = appointmentsData.map(item => ({
                    id: item.id,
                    patientId: item.patient_id,
                    patientName: item.patient_name,
                    mode: item.appointment_mode || 'Online',
                    requestDate: item.created_at,
                    preferredDate: item.preferred_date,
                    preferredTime: item.preferred_time,
                    status: item.status,
                    attachedReport: item.attached_report_summary,
                    uploadedImageUrls: item.uploaded_image_urls,
                    uploadedReportUrls: item.uploaded_report_urls,
                    reasonForVisit: item.reason_for_visit,
                    previousNotes: item.previous_notes,
                }));
                setAppointments(mapped);
            }
            setIsLoadingAppointments(false);

            // Fetch Connection Requests
            const { data: connectionsData, error: connectionsError } = await supabase
                .from('connection_requests')
                .select('*, profiles:patient_id(display_name, photo_url, email)')
                .eq('doctor_id', user!.id)
                .eq('status', 'pending');

            if (connectionsError) {
                // Ignore silent fetch errors
            } else if (connectionsData) {
                setConnectionRequests(connectionsData);
            }
            setIsLoadingConnectionRequests(false);
        }

        fetchData();

        const appointmentChannel = supabase
            .channel('doctor-appointments')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `doctor_id=eq.${user.id}`
            }, () => {
                fetchData();
            })
            .subscribe();

        const connectionChannel = supabase
            .channel('doctor-connections')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'connection_requests',
                filter: `doctor_id=eq.${user.id}`
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(appointmentChannel);
            supabase.removeChannel(connectionChannel);
        };

    }, [user, toast, supabase]);

    const { pendingRequests, dashboardStats } = useMemo(() => {
        const pending = appointments.filter(a => a.status === 'Pending');
        const patientIds = new Set(appointments.map(a => a.patientId));

        const stats = {
            pendingCount: pending.length,
            totalPatients: patientIds.size,
            reportsToReview: appointments.filter(a => a.attachedReport || (a.uploadedImageUrls && a.uploadedImageUrls.length > 0) || (a.uploadedReportUrls && a.uploadedReportUrls.length > 0)).length,
            pendingConnections: connectionRequests.length
        };

        return { pendingRequests: pending, dashboardStats: stats };
    }, [appointments, connectionRequests]);


    const handleRequest = async (id: string, newStatus: 'Confirmed' | 'Declined') => {
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            toast({
                title: `Request ${newStatus}`,
                description: `The appointment request has been ${newStatus.toLowerCase()}.`,
            });
        } catch (error) {
            toast({ title: "Update Failed", description: `Could not ${newStatus.toLowerCase()} the request.`, variant: "destructive" });
        }
    };

    const handleConnectionAction = async (requestId: string, status: 'accepted' | 'rejected') => {
        try {
            const response = await fetch('/api/connections', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, status }),
            });

            if (!response.ok) throw new Error('Failed to update request');

            toast({
                title: `Request ${status === 'accepted' ? 'Accepted' : 'Rejected'}`,
                description: `You have ${status} the connection request.`,
            });

            // Optimistic update
            setConnectionRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (error) {
            toast({ title: "Error", description: "Could not update connection request.", variant: "destructive" });
        }
    };

    const handleGenerateSummary = async (reportText: string | undefined) => {
        if (!reportText) {
            setSummary("No AI report was attached to this appointment request.");
            return;
        }
        setIsGenerating(true);
        setSummary('');
        try {
            const result = await generateAiReportSummary({ report: reportText });
            setSummary(result.summary);
        } catch (error) {
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
            setCaseFile("Could not generate case file at this time. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const openAttachmentsDialog = (app: Appointment) => {
        setSelectedAppointment(app);
        setActiveDialog('attachments');
    };

    const closeDialog = () => {
        setSummary('');
        setCaseFile('');
        setActiveDialog(null);
        setSelectedAppointment(null);
    }



    const renderDialogContent = () => {
        if (activeDialog === 'attachments' && selectedAppointment) {
            const hasImages = selectedAppointment.uploadedImageUrls && selectedAppointment.uploadedImageUrls.length > 0;
            const hasReports = selectedAppointment.uploadedReportUrls && selectedAppointment.uploadedReportUrls.length > 0;
            return (
                <>
                    <DialogHeader>
                        <DialogTitle>Patient Attachments: {selectedAppointment.patientName}</DialogTitle>
                        <DialogDescription>Reason for visit: {selectedAppointment.reasonForVisit || "Not provided"}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] my-4 pr-4">
                        <div className="space-y-4">
                            {hasImages && (
                                <div>
                                    <h4 className="font-semibold mb-2">Skin Condition Photos</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedAppointment.uploadedImageUrls!.map((url, index) => (
                                            <Link key={index} href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt={`Condition photo ${index + 1}`} className="rounded-md object-cover aspect-square" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {hasReports && (
                                <div>
                                    <h4 className="font-semibold mb-2">Previous Reports</h4>
                                    <ul className="space-y-2">
                                        {selectedAppointment.uploadedReportUrls!.map((url, index) => (
                                            <li key={index}>
                                                <Link href={url} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="outline" className="w-full justify-start">
                                                        <FileText className="mr-2" /> Report {index + 1}
                                                    </Button>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {(!hasImages && !hasReports) && (
                                <p className="text-muted-foreground text-center py-8">No files were uploaded with this request.</p>
                            )}
                        </div>
                    </ScrollArea>
                </>
            );
        }

        const isSummary = activeDialog === 'summary';
        const title = isSummary
            ? `AI Report Summary: ${selectedAppointment?.attachedReport?.condition || 'N/A'}`
            : `Case File: ${selectedAppointment?.patientName}`;
        const description = isSummary
            ? `A concise summary generated by AI for a quick overview.`
            : `A comprehensive overview of the patient's case.`;
        const content = isSummary ? summary : caseFile;

        return (
            <>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[400px] my-4 pr-4">
                    {isGenerating ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {content}
                        </p>
                    )}
                </ScrollArea>
            </>
        );
    };

    const getFormattedRequestedDate = (app: Appointment) => {
        // 1. Prioritize the preferredDate if it exists and is valid
        if (app.preferredDate && typeof app.preferredDate === 'string') {
            const parsedDate = parse(app.preferredDate, 'yyyy-MM-dd', new Date());
            if (isValid(parsedDate)) {
                return format(parsedDate, 'PP');
            }
        }

        // 2. Fallback to the requestDate
        if (app.requestDate) {
            const dateObj = new Date(app.requestDate);
            if (isValid(dateObj)) {
                return `Requested: ${format(dateObj, 'PP')}`;
            }
        }

        // 3. Final fallback
        return 'Not specified';
    };


    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Doctor Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, Dr. {userData?.display_name || userData?.lastName || 'Doctor'}. Here's what's happening today.</p>
            </div>

            {!userData?.verified && (
                <Alert variant={userData?.display_name && userData?.specialization && userData?.signature_url ? "default" : "destructive"} className="mb-8">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>
                        {userData?.display_name && userData?.specialization && userData?.signature_url
                            ? "Profile Pending Verification"
                            : "Complete Your Profile"}
                    </AlertTitle>
                    <AlertDescription>
                        {userData?.display_name && userData?.specialization && userData?.signature_url
                            ? "Your professional profile is complete and pending admin verification. You will be listed for patients once verified."
                            : "Please complete your professional profile to get access to all features and be visible to patients."}
                        <Button variant="link" className="p-0 h-auto ml-2 font-semibold" asChild>
                            <Link href="/doctor/profile">Go to Profile</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Appointments</CardTitle>
                        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardStats.pendingCount}</div>
                        <p className="text-xs text-muted-foreground">Requests await review.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Connection Requests</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardStats.pendingConnections}</div>
                        <p className="text-xs text-muted-foreground">Patients want to connect.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardStats.totalPatients}</div>
                        <p className="text-xs text-muted-foreground">Patients booked.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Files for Review</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardStats.reportsToReview}</div>
                        <p className="text-xs text-muted-foreground">Documents available.</p>
                    </CardContent>
                </Card>
            </div>

            {/* Connection Requests Section */}
            {connectionRequests.length > 0 && (
                <div className="mb-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Chat Connection Requests</CardTitle>
                            <CardDescription>Patients requesting to connect for direct messaging.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Desktop Connection Requests Table */}
                            <div className="hidden md:block rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Patient Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Requested On</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {connectionRequests.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell className="font-medium">
                                                    {req.profiles?.display_name || 'Anonymous'}
                                                </TableCell>
                                                <TableCell>{req.profiles?.email}</TableCell>
                                                <TableCell>{format(new Date(req.created_at), 'PPp')}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleConnectionAction(req.id, 'rejected')}>Deny</Button>
                                                    <Button size="sm" onClick={() => handleConnectionAction(req.id, 'accepted')}>Accept</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Connection Requests Cards */}
                            <div className="md:hidden space-y-4">
                                {connectionRequests.map((req) => (
                                    <Card key={req.id} className="border-zinc-200 dark:border-zinc-800 shadow-sm">
                                        <div className="p-4 space-y-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-bold text-lg">{req.profiles?.display_name || 'Anonymous'}</div>
                                                <div className="text-sm text-muted-foreground">{req.profiles?.email}</div>
                                            </div>
                                            <div className="text-xs text-muted-foreground pt-1 border-t">
                                                Requested: {format(new Date(req.created_at), 'PP')}
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleConnectionAction(req.id, 'rejected')}>Deny</Button>
                                                <Button size="sm" className="flex-1" onClick={() => handleConnectionAction(req.id, 'accepted')}>Accept</Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}


            <Dialog onOpenChange={(open) => !open && closeDialog()}>
                <Card>
                    <CardHeader>
                        <CardTitle>Appointment Requests</CardTitle>
                        <CardDescription>Review and respond to new appointment requests.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Desktop Appointment Requests Table */}
                        <div className="hidden md:block rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Patient</TableHead>
                                        <TableHead className="hidden lg:table-cell">Requested Date/Time</TableHead>
                                        <TableHead>Tools</TableHead>
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
                                            <TableCell className="hidden lg:table-cell">
                                                {`${getFormattedRequestedDate(app)} at ${app.preferredTime || 'any time'}`}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => { setSelectedAppointment(app); setActiveDialog('summary'); handleGenerateSummary(app.attachedReport?.recommendations); }}>
                                                            <Bot className="mr-2 h-4 w-4" />
                                                            AI Summary
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => { setSelectedAppointment(app); setActiveDialog('caseFile'); handleGenerateCaseFile(app); }}>
                                                            <BookUser className="mr-2 h-4 w-4" />
                                                            Case File
                                                        </Button>
                                                    </DialogTrigger>
                                                    {(app.uploadedImageUrls?.length || app.uploadedReportUrls?.length) ? (
                                                        <DialogTrigger asChild>
                                                            <Button variant="secondary" size="sm" onClick={() => openAttachmentsDialog(app)}>
                                                                <Paperclip className="mr-2 h-4 w-4" />
                                                                View Attachments
                                                            </Button>
                                                        </DialogTrigger>
                                                    ) : null}
                                                </div>
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
                        </div>

                        {/* Mobile Appointment Requests Cards */}
                        <div className="md:hidden space-y-4">
                            {isLoadingAppointments ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : pendingRequests.length > 0 ? pendingRequests.map(app => (
                                <Card key={app.id} className="border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                    <div className="p-4 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="font-bold text-lg">{app.patientName}</div>
                                                <div className="text-sm text-muted-foreground">{app.mode} Consultation</div>
                                            </div>
                                            <Badge variant="outline">{app.status}</Badge>
                                        </div>

                                        <div className="text-sm space-y-1 text-muted-foreground">
                                            <div className="font-medium text-foreground">Requested Session:</div>
                                            <div>{getFormattedRequestedDate(app)} at {app.preferredTime || 'any time'}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedAppointment(app); setActiveDialog('summary'); handleGenerateSummary(app.attachedReport?.recommendations); }}>
                                                    <Bot className="mr-2 h-4 w-4" /> AI Summary
                                                </Button>
                                            </DialogTrigger>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedAppointment(app); setActiveDialog('caseFile'); handleGenerateCaseFile(app); }}>
                                                    <BookUser className="mr-2 h-4 w-4" /> Case File
                                                </Button>
                                            </DialogTrigger>
                                            {(app.uploadedImageUrls?.length || app.uploadedReportUrls?.length) && (
                                                <DialogTrigger asChild>
                                                    <Button variant="secondary" size="sm" className="col-span-2 w-full" onClick={() => openAttachmentsDialog(app)}>
                                                        <Paperclip className="mr-2 h-4 w-4" /> View Attachments
                                                    </Button>
                                                </DialogTrigger>
                                            )}
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleRequest(app.id, 'Declined')}>Decline</Button>
                                            <Button size="sm" className="flex-1" onClick={() => handleRequest(app.id, 'Confirmed')}>Approve</Button>
                                        </div>
                                    </div>
                                </Card>
                            )) : (
                                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                                    No pending appointment requests.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <DialogContent className="sm:max-w-md">
                    {renderDialogContent()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
