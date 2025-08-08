
"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video, MessageSquare, MoreHorizontal, CheckCircle, Clock, Download, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

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
        notes: "Patient's condition has improved significantly. Recommended to continue with the current skincare routine. Follow-up in 3 months.",
        prescription: {
            medication: "Tretinoin Cream 0.05%",
            dosage: "Apply a pea-sized amount to the face once daily at night.",
            instructions: "Avoid sun exposure. Use moisturizer.",
        },
    },
];

export default function AppointmentsPage() {
    const { toast } = useToast();

    const handleDownload = (id: string) => {
        toast({
            title: "Downloading Prescription",
            description: `Your e-prescription for appointment ${id} is being downloaded.`,
        });
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
                                <TableHead>Notes & Prescription</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockAppointments.filter(a => a.status === 'Completed').map(appointment => (
                                <TableRow key={appointment.id}>
                                    <TableCell className="font-medium">{appointment.doctorName}</TableCell>
                                    <TableCell>{appointment.date}</TableCell>
                                    <TableCell>
                                        {appointment.notes && (
                                            <p className="text-sm text-muted-foreground mb-2">
                                                <strong className="text-foreground">Doctor's Notes:</strong> {appointment.notes}
                                            </p>
                                        )}
                                        {appointment.prescription && (
                                            <Button size="sm" variant="outline" onClick={() => handleDownload(appointment.id)}>
                                                <Download className="mr-2 h-4 w-4" />
                                                Download E-Prescription
                                            </Button>
                                        )}
                                         {!appointment.notes && !appointment.prescription && (
                                            <p className="text-sm text-muted-foreground">No notes or prescription for this appointment.</p>
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
