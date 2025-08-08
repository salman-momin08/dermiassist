
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video, Clock, Download, FileText, MoreHorizontal, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";

const mockAppointments = [
    {
        id: "APT001",
        doctorName: "Dr. Emily Carter",
        date: "2024-08-15",
        time: "10:30 AM",
        mode: "Online",
        status: "Confirmed",
        notes: null,
        prescription: null,
    },
    {
        id: "APT002",
        doctorName: "Dr. Ben Adams",
        date: "2024-07-25",
        time: "02:00 PM",
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

    const handlePrint = (id: string) => {
        toast({
            title: "Printing Prescription",
            description: `Your e-prescription for appointment ${id} is being sent to your printer.`,
        });
        // In a real app, this would trigger window.print()
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
                                    <TableCell>{appointment.date} at {appointment.time}</TableCell>
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
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>
                                                    {appointment.mode === "Online" ? (
                                                        <><Video className="mr-2 h-4 w-4" /> Join Call</>
                                                    ) : (
                                                        <><Calendar className="mr-2 h-4 w-4" /> View Details</>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>Cancel Appointment</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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
                                    <TableCell>{appointment.date}</TableCell>
                                    <TableCell className="text-right space-x-2">
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
                                                            Notes from your appointment on {appointment.date}.
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
                                                                    <p>Appointment: {appointment.date}</p>
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
                                         {!appointment.notes && !appointment.prescription && (
                                            <p className="text-sm text-muted-foreground">No notes or prescription.</p>
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
