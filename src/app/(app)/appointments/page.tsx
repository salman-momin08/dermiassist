
"use client"

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video, Clock, Download, FileText, Printer, Loader2, MoreHorizontal, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInMinutes, format, isFuture, isPast, parse, isValid } from "date-fns";

import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Appointment = {
    id: string;
    doctorName: string;
    appointmentDate?: string;
    preferredDate?: string;
    preferredTime?: string;
    appointmentMode: 'Online' | 'Offline';
    status: 'Confirmed' | 'Completed' | 'Pending' | 'Declined';
    notes?: string;
    patientName?: string;
    doctorLocation?: string;
    doctorPhone?: string;
    doctorSignature?: string;
    prescription?: {
        medication: string;
        dosage: string;
        instructions: string;
        dateIssued: string;
    };
    [key: string]: any;
};

export default function AppointmentsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [now, setNow] = useState(new Date());
    const letterRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        if (!user) return;

        setIsLoading(true);

        async function fetchAppointments() {
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('patient_id', user!.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching appointments:", error);
                toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
            } else if (data) {
                const mapped: Appointment[] = data.map(item => ({
                    id: item.id,
                    doctorName: item.doctor_name || 'Unknown Doctor',
                    appointmentDate: item.appointment_date,
                    preferredDate: item.preferred_date,
                    preferredTime: item.preferred_time,
                    appointmentMode: item.appointment_mode || 'Online',
                    status: item.status,
                    notes: item.notes,
                    patientName: item.patient_name,
                    doctorLocation: item.doctor_location,
                    doctorPhone: item.doctor_phone,
                    doctorSignature: item.doctor_signature,
                    prescription: item.prescription,
                }));
                setAppointments(mapped);
            }
            setIsLoading(false);
        }

        fetchAppointments();

        const channel = supabase
            .channel('patient-appointments')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `patient_id=eq.${user.id}`
            }, () => {
                fetchAppointments();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, toast]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getDisplayDate = (appointment: Appointment) => {
        // Confirmed/Completed: show the actual confirmed date
        if (appointment.appointmentDate) {
            try {
                const d = new Date(appointment.appointmentDate);
                if (isValid(d)) return format(d, 'PPpp');
            } catch { }
        }
        // Pending: show patient's preferred date/time
        if (appointment.preferredDate) {
            try {
                const d = parse(appointment.preferredDate, 'yyyy-MM-dd', new Date());
                if (isValid(d)) {
                    const dateStr = format(d, 'PP');
                    const timeStr = appointment.preferredTime ? ` at ${appointment.preferredTime}` : '';
                    return `${dateStr}${timeStr} (preferred)`;
                }
            } catch { }
        }
        return 'Not Scheduled';
    };

    const handlePrint = (id: string) => {
        toast({
            title: "Printing Prescription",
            description: `Your e-prescription for appointment ${id} is being sent to your printer.`,
        });
    }

    const handleDownloadLetter = async (appointment: any) => {
        const input = letterRef.current;
        if (!input) return;

        setIsDownloading(true);

        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(input, { scale: 2, useCORS: true, backgroundColor: null });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'px', [canvas.width, canvas.height]);
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`DermiAssist-AI-Appointment-${appointment.id}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast({
                title: "Download Failed",
                description: "Could not generate the PDF letter. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsDownloading(false);
        }
    };

    // Join window: 15 minutes before start to 90 minutes after
    const isJoinButtonEnabled = (appointmentDate?: string) => {
        if (!appointmentDate) return false;
        const apptTime = new Date(appointmentDate);
        const diff = differenceInMinutes(apptTime, now); // positive = in future
        return diff <= 15 && diff >= -90;
    };

    const getJoinTooltip = (appointmentDate?: string) => {
        if (!appointmentDate) return 'Appointment not yet scheduled.';
        const apptTime = new Date(appointmentDate);
        const diff = differenceInMinutes(apptTime, now);
        if (diff > 15) return `You can join 15 minutes before the start time.`;
        if (diff < -90) return 'The time window to join has passed.';
        return 'Join your video consultation now.';
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Remove from local state immediately
            setAppointments(prev => prev.filter(a => a.id !== id));

            toast({
                title: "Appointment Cancelled",
                description: "Your appointment has been successfully cancelled.",
            });
        } catch (error) {
            console.error("Error cancelling appointment:", error);
            toast({
                title: "Error",
                description: "Could not cancel the appointment. Please try again.",
                variant: "destructive",
            });
        }
    };

    const upcomingAppointments = appointments.filter(a => a.status === 'Confirmed');
    const pastAppointments = appointments.filter(a => a.status === 'Completed');
    const pendingAppointments = appointments.filter(a => a.status === 'Pending');
    const declinedAppointments = appointments.filter(a => a.status === 'Declined');

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex items-center justify-between space-y-2 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">
                        My Appointments
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your upcoming and past appointments with doctors.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/doctors">
                        <Calendar className="mr-2 h-4 w-4" />
                        Book New Appointment
                    </Link>
                </Button>
            </div>

            {/* Upcoming Confirmed */}
            <Card>
                <CardHeader>
                    <CardTitle>Upcoming Appointments</CardTitle>
                    <CardDescription>
                        Here are your confirmed consultations. Please be on time.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Doctor</TableHead>
                                    <TableHead>Date &amp; Time</TableHead>
                                    <TableHead className="hidden md:table-cell">Mode</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                ) : upcomingAppointments.length > 0 ? upcomingAppointments.map(appointment => (
                                    <TableRow key={appointment.id}>
                                        <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                        <TableCell>{getDisplayDate(appointment)}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Badge variant="outline">{appointment.appointmentMode}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {appointment.appointmentMode === "Online" ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="inline-block">
                                                                    <Button asChild size="sm" disabled={!isJoinButtonEnabled(appointment.appointmentDate)}>
                                                                        <Link href={`/video/${appointment.id}`}>
                                                                            <Video className="mr-2 h-4 w-4" /> Join Call
                                                                        </Link>
                                                                    </Button>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{getJoinTooltip(appointment.appointmentDate)}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button size="sm" variant="outline"><Download className="mr-2 h-4 w-4" />Letter</Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-3xl">
                                                            <DialogHeader>
                                                                <DialogTitle>Appointment Confirmation Letter</DialogTitle>
                                                                <DialogDescription>A downloadable copy of your appointment confirmation.</DialogDescription>
                                                            </DialogHeader>
                                                            <ScrollArea className="max-h-[60vh] pr-6">
                                                                <div ref={letterRef} className="p-8 bg-white text-black">
                                                                    <div className="p-8 bg-white text-black">
                                                                        <Card className="shadow-none border-0 text-black">
                                                                            <CardHeader className="text-center space-y-4">
                                                                                <div className="flex justify-center"><Logo /></div>
                                                                                <CardTitle className="font-normal text-2xl">Appointment Confirmation</CardTitle>
                                                                                <Separator />
                                                                            </CardHeader>
                                                                            <CardContent className="space-y-6 text-sm">
                                                                                <p>Dear {appointment.patientName},</p>
                                                                                <p>This letter confirms your appointment with <strong>{appointment.doctorName}</strong>. Please find the details below:</p>
                                                                                <div className="border p-4 rounded-lg space-y-2 bg-slate-50">
                                                                                    <p><strong>Date:</strong> {appointment.appointmentDate ? format(new Date(appointment.appointmentDate), 'EEEE, MMMM d, yyyy') : 'N/A'}</p>
                                                                                    <p><strong>Time:</strong> {appointment.appointmentDate ? format(new Date(appointment.appointmentDate), 'p') : 'N/A'}</p>
                                                                                    <p><strong>Location:</strong> {appointment.doctorLocation || 'Online Consultation'}</p>
                                                                                    <p><strong>Contact:</strong> {appointment.doctorPhone || 'Via DermiAssist App'}</p>
                                                                                </div>
                                                                                <p>Please arrive 15 minutes early and bring a valid ID. If you need to reschedule, please contact us at least 24 hours in advance.</p>
                                                                                <div className="pt-8">
                                                                                    <p>Sincerely,</p>
                                                                                    {appointment.doctorSignature && <Image src={appointment.doctorSignature} alt="Doctor's Signature" width={150} height={50} style={{ height: 'auto' }} data-ai-hint="signature" />}
                                                                                    <p><strong>{appointment.doctorName}</strong></p>
                                                                                    <p>DermiAssist-AI Dermatology</p>
                                                                                </div>
                                                                            </CardContent>
                                                                        </Card>
                                                                    </div>
                                                                </div>
                                                            </ScrollArea>
                                                            <Button className="w-full mt-4" onClick={() => handleDownloadLetter(appointment)} disabled={isDownloading}>
                                                                {isDownloading ? <><Download className="mr-2 h-4 w-4" />Downloading...</> : <><Download className="mr-2 h-4 w-4" />Download PDF</>}
                                                            </Button>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Cancel Appointment
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently cancel your appointment with {appointment.doctorName}. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Go Back</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(appointment.id)} className="bg-destructive hover:bg-destructive/90">
                                                                Yes, Cancel
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            You have no upcoming appointments.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Pending Requests */}
            {pendingAppointments.length > 0 && (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-yellow-500" />
                            Pending Requests
                        </CardTitle>
                        <CardDescription>
                            These appointment requests are awaiting confirmation from your doctor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Doctor</TableHead>
                                        <TableHead>Preferred Date</TableHead>
                                        <TableHead className="hidden md:table-cell">Mode</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingAppointments.map(appointment => (
                                        <TableRow key={appointment.id}>
                                            <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                            <TableCell className="text-muted-foreground">{getDisplayDate(appointment)}</TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <Badge variant="outline">{appointment.appointmentMode}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                                                            <XCircle className="mr-2 h-4 w-4" /> Cancel Request
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will withdraw your appointment request with {appointment.doctorName}.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Keep Request</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(appointment.id)} className="bg-destructive hover:bg-destructive/90">
                                                                Yes, Cancel
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* History */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Consultation History</CardTitle>
                    <CardDescription>
                        Review your past consultations, notes, and prescriptions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Doctor</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                ) : [...pastAppointments, ...declinedAppointments].length > 0 ? [...pastAppointments, ...declinedAppointments].map(appointment => (
                                    <TableRow key={appointment.id}>
                                        <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                        <TableCell>{appointment.appointmentDate ? format(new Date(appointment.appointmentDate), 'PP') : getDisplayDate(appointment)}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                appointment.status === 'Completed' ? 'secondary' :
                                                    appointment.status === 'Declined' ? 'destructive' : 'outline'
                                            }>{appointment.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            {appointment.status === 'Completed' && appointment.notes && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" variant="outline">
                                                            <FileText className="mr-2 h-4 w-4" />
                                                            View Notes
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Follow-up notes from Dr. {appointment.doctorName}</DialogTitle>
                                                            <DialogDescription>
                                                                Notes from your appointment on {appointment.appointmentDate ? format(new Date(appointment.appointmentDate), 'PP') : ''}.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-4 text-sm text-muted-foreground">
                                                            {appointment.notes}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                            {appointment.status === 'Completed' && appointment.prescription && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" variant="outline">
                                                            <Download className="mr-2 h-4 w-4" />
                                                            View E-Prescription
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl">
                                                        <DialogHeader>
                                                            <DialogTitle>E-Prescription Details</DialogTitle>
                                                            <DialogDescription>
                                                                Your official e-prescription from Dr. {appointment.doctorName}.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <Card className="shadow-none border-0">
                                                            <CardHeader className="text-center space-y-4">
                                                                <div className="flex justify-center">
                                                                    <Logo />
                                                                </div>
                                                                <CardTitle className="font-normal">Official E-Prescription</CardTitle>
                                                                <Separator />
                                                            </CardHeader>
                                                            <CardContent className="space-y-6 text-sm">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="font-semibold">Patient Details</p>
                                                                        <p>{appointment.patientName}</p>
                                                                        <p>Appointment: {appointment.appointmentDate ? format(new Date(appointment.appointmentDate), 'PP') : ''}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-semibold">Prescribing Doctor</p>
                                                                        <p>{appointment.doctorName}</p>
                                                                        <p>General Dermatology</p>
                                                                    </div>
                                                                </div>
                                                                <Separator />
                                                                <div className="pt-4">
                                                                    <div className="flex items-start gap-4">
                                                                        <div className="font-bold text-2xl text-primary font-serif">Rx</div>
                                                                        <div className="w-full space-y-4">
                                                                            <div>
                                                                                <p className="font-bold">{appointment.prescription.medication}</p>
                                                                                <p className="text-muted-foreground">{appointment.prescription.dosage}</p>
                                                                            </div>
                                                                            <Separator />
                                                                            <div>
                                                                                <p className="font-semibold">Instructions:</p>
                                                                                <p className="text-muted-foreground">{appointment.prescription.instructions}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Separator />
                                                                <div className="text-xs text-muted-foreground text-center">
                                                                    <p>Date Issued: {appointment.prescription.dateIssued ? format(new Date(appointment.prescription.dateIssued), 'PP') : ''}</p>
                                                                    <p>This is a digitally generated prescription and does not require a physical signature for verification.</p>
                                                                </div>
                                                            </CardContent>
                                                            <CardContent>
                                                                <Button className="w-full" onClick={() => handlePrint(appointment.id)}>
                                                                    <Printer className="mr-2 h-4 w-4" />
                                                                    Print Prescription
                                                                </Button>
                                                            </CardContent>
                                                        </Card>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                            {appointment.status === 'Declined' && (
                                                <span className="text-sm text-muted-foreground italic">No further action needed</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            You have no past appointments yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


