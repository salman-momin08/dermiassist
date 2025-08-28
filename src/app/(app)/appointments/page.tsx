
"use client"

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video, Clock, Download, FileText, Printer, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { addMinutes, differenceInMinutes, format, isFuture, isPast } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Appointment = {
    id: string;
    doctorName: string;
    appointmentDate: string; // ISO string
    mode: 'Online' | 'Offline';
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

    useEffect(() => {
        if (!user) return;

        setIsLoading(true);
        const q = query(collection(db, "appointments"), where("patientId", "==", user.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAppointments = snapshot.docs.map(doc => ({ 
                id: doc.id,
                ...doc.data(),
            } as Appointment));
            setAppointments(fetchedAppointments);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching appointments:", error);
            toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);
    
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

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
            const canvas = await html2canvas(input, { scale: 2, useCORS: true, backgroundColor: null });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'px', [canvas.width, canvas.height]);
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`SkinWise-Appointment-${appointment.id}.pdf`);
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
    
    const isJoinButtonEnabled = (appointmentDate: string) => {
        if (!appointmentDate) return false;
        const appointmentTime = new Date(appointmentDate);
        const diff = differenceInMinutes(appointmentTime, now);
        // Enable from 10 mins before to 10 mins after
        return diff <= 10 && diff > -10;
    };

    const getJoinTooltipContent = (appointmentDate: string) => {
        if (!appointmentDate) return "This appointment has not been scheduled yet.";
        const appointmentTime = new Date(appointmentDate);
        const diff = differenceInMinutes(appointmentTime, now);
        if (diff > 10) {
            return `You can join the call ${diff - 10} minutes before the start time.`;
        }
        if (diff <= -10) {
            return "The window to join this call has passed.";
        }
        return "Join your video consultation now.";
    }

    const upcomingAppointments = appointments.filter(a => a.status === 'Confirmed' && a.appointmentDate && isFuture(new Date(a.appointmentDate)));
    const pastAppointments = appointments.filter(a => a.status === 'Completed' || (a.status === 'Confirmed' && a.appointmentDate && isPast(new Date(a.appointmentDate))));

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

            <Card>
                <CardHeader>
                    <CardTitle>Upcoming Appointments</CardTitle>
                    <CardDescription>
                        Here are your scheduled consultations. Please be on time.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Doctor</TableHead>
                                <TableHead>Date &amp; Time</TableHead>
                                <TableHead className="hidden md:table-cell">Mode</TableHead>
                                <TableHead className="hidden md:table-cell">Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                            ) : upcomingAppointments.length > 0 ? upcomingAppointments.map(appointment => (
                                <TableRow key={appointment.id}>
                                    <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                    <TableCell>{format(new Date(appointment.appointmentDate), 'PPpp')}</TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="outline">
                                            {appointment.mode === "Online" ? <Video className="mr-1 h-3 w-3" /> : <Calendar className="mr-1 h-3 w-3" />}
                                            {appointment.mode}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge>
                                             <Clock className="mr-1 h-3 w-3" />
                                            {appointment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {appointment.mode === "Online" ? (
                                             <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        {/* This div is necessary to prevent Tooltip from complaining about a disabled button */}
                                                        <div> 
                                                          <Button asChild size="sm" disabled={!isJoinButtonEnabled(appointment.appointmentDate)}>
                                                              <Link href={`/video/${appointment.id}`}>
                                                                <Video className="mr-2 h-4 w-4" /> Join Call
                                                              </Link>
                                                          </Button>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{getJoinTooltipContent(appointment.appointmentDate)}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Button size="sm" variant="outline" disabled>View Details</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        You have no upcoming appointments.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="mt-8">
                 <CardHeader>
                    <CardTitle>Past Appointments</CardTitle>
                    <CardDescription>
                        Review your consultation history, notes, and prescriptions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Doctor</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                            ) : pastAppointments.length > 0 ? pastAppointments.map(appointment => (
                                <TableRow key={appointment.id}>
                                    <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                    <TableCell>{format(new Date(appointment.appointmentDate), 'PP')}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                         {appointment.mode === 'Offline' && (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline"><Download className="mr-2 h-4 w-4" />Appointment Letter</Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Appointment Confirmation Letter</DialogTitle>
                                                        <DialogDescription>
                                                            A downloadable copy of your appointment confirmation.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <ScrollArea className="max-h-[60vh] pr-6">
                                                        <div ref={letterRef} className="p-8 bg-white text-black">
                                                            <Card className="shadow-none border-0 text-black">
                                                                <CardHeader className="text-center space-y-4">
                                                                    <div className="flex justify-center">
                                                                        <Logo />
                                                                    </div>
                                                                    <CardTitle className="font-normal text-2xl">Appointment Confirmation</CardTitle>
                                                                    <Separator />
                                                                </CardHeader>
                                                                <CardContent className="space-y-6 text-sm">
                                                                    <p>Dear {appointment.patientName},</p>
                                                                    <p>This letter confirms your appointment with <strong>{appointment.doctorName}</strong>. Please find the details below:</p>
                                                                    <div className="border p-4 rounded-lg space-y-2 bg-slate-50">
                                                                        <p><strong>Date:</strong> {format(new Date(appointment.appointmentDate), 'EEEE, MMMM d, yyyy')}</p>
                                                                        <p><strong>Time:</strong> {format(new Date(appointment.appointmentDate), 'p')}</p>
                                                                        <p><strong>Location:</strong> {appointment.doctorLocation}</p>
                                                                        <p><strong>Contact:</strong> {appointment.doctorPhone}</p>
                                                                    </div>
                                                                    <p>Please arrive 15 minutes early and bring a valid ID. If you need to reschedule, please contact us at least 24 hours in advance.</p>
                                                                    <div className="pt-8">
                                                                        <p>Sincerely,</p>
                                                                        {appointment.doctorSignature && <Image src={appointment.doctorSignature} alt="Doctor's Signature" width={150} height={50} data-ai-hint="signature"/>}
                                                                        <p><strong>{appointment.doctorName}</strong></p>
                                                                        <p>SkinWise Dermatology</p>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </div>
                                                    </ScrollArea>
                                                    <Button className="w-full mt-4" onClick={() => handleDownloadLetter(appointment)} disabled={isDownloading}>
                                                        {isDownloading ? <><Download className="mr-2 h-4 w-4" />Downloading...</> : <><Download className="mr-2 h-4 w-4" />Download PDF</>}
                                                    </Button>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                        {appointment.notes && (
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
                                                            Notes from your appointment on {format(new Date(appointment.appointmentDate), 'PP')}.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4 text-sm text-muted-foreground">
                                                        {appointment.notes}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                        {appointment.prescription && (
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
                                                                    <p>Appointment: {format(new Date(appointment.appointmentDate), 'PP')}</p>
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
                                                                <p>Date Issued: {format(new Date(appointment.prescription.dateIssued), 'PP')}</p>
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
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                        You have no past appointments.
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

    