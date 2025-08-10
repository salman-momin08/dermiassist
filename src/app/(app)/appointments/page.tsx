
"use client"

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video, Clock, Download, FileText, MoreHorizontal, Printer, Phone, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { addMinutes, differenceInMinutes, format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";

const mockAppointments = [
    {
        id: "APT001",
        doctorName: "Dr. Emily Carter",
        doctorLocation: "123 Health St, Wellness City, 45678",
        doctorPhone: "+1 (555) 123-4567",
        doctorSignature: "https://placehold.co/150x50.png?text=Dr.+Emily+Carter",
        date: "2024-08-15T10:30:00",
        mode: "Online",
        status: "Confirmed",
        notes: null,
        prescription: null,
    },
    {
        id: "APT002",
        doctorName: "Dr. Ben Adams",
        doctorLocation: "456 Care Ave, Meditown, 12345",
        doctorPhone: "+1 (555) 765-4321",
        doctorSignature: "https://placehold.co/150x50.png?text=Dr.+Ben+Adams",
        date: "2024-07-25T14:00:00",
        mode: "Offline",
        status: "Completed",
        patientName: "Patient",
        notes: "Patient's condition has improved significantly. Recommended to continue with the current skincare routine. Follow-up in 3 months.",
        prescription: {
            medication: "Tretinoin Cream 0.05%",
            dosage: "Apply a pea-sized amount to the face once daily at night.",
            instructions: "Avoid sun exposure. Use moisturizer.",
            dateIssued: "2024-07-25",
        },
    },
];

export default function AppointmentsPage() {
    const { toast } = useToast();
    const [now, setNow] = useState(new Date());
    const letterRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

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
    
    const handleDownloadLetter = async (appointment: typeof mockAppointments[0]) => {
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
        const appointmentTime = new Date(appointmentDate);
        const diff = differenceInMinutes(appointmentTime, now);
        // Enable from 10 mins before to 10 mins after
        return diff <= 10 && diff > -10;
    };

    const getJoinTooltipContent = (appointmentDate: string) => {
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
                                <TableHead>Date & Time</TableHead>
                                <TableHead className="hidden md:table-cell">Mode</TableHead>
                                <TableHead className="hidden md:table-cell">Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockAppointments.filter(a => a.status === 'Confirmed').map(appointment => (
                                <TableRow key={appointment.id}>
                                    <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                    <TableCell>{format(new Date(appointment.date), 'PPpp')}</TableCell>
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
                                                            <Button size="sm" disabled={!isJoinButtonEnabled(appointment.date)}>
                                                                <Video className="mr-2 h-4 w-4" /> Join Call
                                                            </Button>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{getJoinTooltipContent(appointment.date)}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Button size="sm" variant="outline" disabled>View Details</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                             {mockAppointments.filter(a => a.status === 'Confirmed').length === 0 && (
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
                            {mockAppointments.filter(a => a.status === 'Completed').map(appointment => (
                                <TableRow key={appointment.id}>
                                    <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                    <TableCell>{format(new Date(appointment.date), 'PP')}</TableCell>
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
                                                                        <p><strong>Date:</strong> {format(new Date(appointment.date), 'EEEE, MMMM d, yyyy')}</p>
                                                                        <p><strong>Time:</strong> {format(new Date(appointment.date), 'p')}</p>
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
                                                            Notes from your appointment on {format(new Date(appointment.date), 'PP')}.
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
                                                                    <p>Appointment: {format(new Date(appointment.date), 'PP')}</p>
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
                                                                <p>Date Issued: {appointment.prescription.dateIssued}</p>
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
                            ))}
                             {mockAppointments.filter(a => a.status === 'Completed').length === 0 && (
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

    

    