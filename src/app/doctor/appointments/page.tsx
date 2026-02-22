
"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Pill, StickyNote, Loader2, Video, Calendar as CalendarIcon, Trash2, MoreHorizontal, CheckCircle, XCircle, Settings2, FileText, Image as ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { format, set, isValid, differenceInMinutes, isFuture, isPast, parse } from "date-fns"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { StreamChat } from 'stream-chat';


type Appointment = {
    id: string;
    patient_id: string;
    patient_name: string;
    request_date: string;
    preferred_date?: string; // yyyy-MM-dd
    preferred_time?: string; // HH:mm
    appointment_mode: 'Online' | 'In-Person';
    status: 'Pending' | 'Confirmed' | 'Declined' | 'Completed';
    appointment_date?: string;
    notes?: string;
    prescription?: {
        medication: string;
        type: string;
        time: string;
        dosage: string;
        instructions: string;
        dateIssued: string;
    };
    [key: string]: any;
};

export default function DoctorAppointmentsPage() {
    const { user, userData, forceReload } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentNotes, setCurrentNotes] = useState("");
    const [currentAppointmentId, setCurrentAppointmentId] = useState<string | null>(null);
    const { toast } = useToast();

    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
    const [scheduleTime, setScheduleTime] = useState("09:00");
    const [now, setNow] = useState(new Date());


    const [prescriptionForm, setPrescriptionForm] = useState({
        medication: '',
        type: '',
        time: '',
        dosage: '',
        instructions: ''
    });

    useEffect(() => {
        if (!user) return;
        const supabase = createClient();

        setIsLoading(true);

        const fetchAppointments = async () => {
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', user.id);

            if (error) {
                toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
            } else {
                setAppointments(data as Appointment[]);
            }
            setIsLoading(false);
        };

        fetchAppointments();

        // Subscribe to realtime changes
        const channel = supabase
            .channel(`doctor_appointments_${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `doctor_id=eq.${user.id}`
            }, (payload) => {
                fetchAppointments(); // Re-fetch on any change for simplicity
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, toast]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);


    const handleConfirmRequest = async (app: Appointment, usePatientTime: boolean = false) => {
        if (!user || !userData) return;
        const supabase = createClient();

        let finalDateTime;

        if (usePatientTime && app.preferred_date && app.preferred_time) {
            const baseDate = parse(app.preferred_date, 'yyyy-MM-dd', new Date());
            const [hours, minutes] = app.preferred_time.split(':').map(Number);
            finalDateTime = set(baseDate, { hours, minutes, seconds: 0, milliseconds: 0 });
        } else {
            if (!scheduleDate) {
                toast({ title: "Please select a date.", variant: "destructive" });
                return;
            }
            const [hours, minutes] = scheduleTime.split(':').map(Number);
            finalDateTime = set(scheduleDate, { hours, minutes, seconds: 0, milliseconds: 0 });
        }

        if (!isValid(finalDateTime)) {
            toast({ title: "Invalid date/time for confirmation.", variant: "destructive" });
            return;
        }

        try {
            // 1. Update appointment status in Supabase
            const { error: appError } = await supabase
                .from('appointments')
                .update({
                    status: 'Confirmed',
                    appointment_date: finalDateTime.toISOString(),
                })
                .eq('id', app.id);

            if (appError) throw appError;

            // 2. Create/Update a record in doctor_cases to link patient to doctor
            const { error: caseError } = await supabase
                .from('doctor_cases')
                .upsert({
                    doctor_id: user.id,
                    patient_id: app.patient_id,
                    patient_name: app.patient_name,
                    last_appointment_date: finalDateTime.toISOString(),
                }, { onConflict: 'doctor_id,patient_id' });

            if (caseError) throw caseError;

            // 3. Handle Stream Chat Provisioning (only for online appointments)
            if (app.appointment_mode === 'Online') {
                try {
                    const provisionResponse = await fetch('/api/chat/provision', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ patientId: app.patient_id }),
                    });

                    if (!provisionResponse.ok) {
                        console.error('Failed to provision chat channel');
                        // Don't throw - appointment is already confirmed
                    }
                } catch (chatError) {
                    console.error('Error provisioning chat channel', chatError);
                    // Don't fail the whole operation if chat fails
                }
            }

            toast({
                title: `Request Confirmed`,
                description: `The appointment has been scheduled${app.appointment_mode === 'Online' ? ' and a chat channel has been created' : ''}.`,
            });
            forceReload();

            fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId: 'appointment-confirmed',
                    subscriberId: app.patient_id,
                    payload: { doctorName: userData?.display_name || user?.email || 'Your doctor' },
                }),
            }).catch(() => { });
        } catch (error: any) {
            toast({ title: "Error confirming request", description: error.message || "Could not confirm the appointment.", variant: "destructive" });
        }
    };

    const handleDeclineRequest = async (app: Appointment) => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ status: 'Declined' })
                .eq('id', app.id);

            if (error) throw error;
            toast({ title: "Request Declined", variant: "destructive" });
            forceReload();

            fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId: 'appointment-declined',
                    subscriberId: app.patient_id,
                    payload: { doctorName: userData?.display_name || user?.email || 'Your doctor' },
                }),
            }).catch(() => { });
        } catch (error: any) {
            toast({ title: "Error declining request", description: error.message, variant: "destructive" });
        }
    }

    const handleDelete = async (id: string) => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast({
                title: "Appointment Cancelled",
                description: "The appointment has been removed.",
            });
            forceReload();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Could not cancel the appointment.",
                variant: "destructive",
            });
        }
    };

    const handleSaveNotes = async () => {
        if (!currentAppointmentId) return;
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ notes: currentNotes, status: 'Completed' })
                .eq('id', currentAppointmentId);

            if (error) throw error;
            toast({ title: "Notes Saved", description: "The consultation notes have been saved and the appointment marked as complete." });
            setCurrentNotes('');
            setCurrentAppointmentId(null);
            forceReload();
        } catch (error: any) {
            toast({ title: "Error saving notes", description: error.message, variant: "destructive" });
        }
    }

    const handleSendPrescription = async (patientName: string) => {
        if (!currentAppointmentId) return;
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('appointments')
                .update({
                    prescription: {
                        ...prescriptionForm,
                        dateIssued: new Date().toISOString(),
                    }
                })
                .eq('id', currentAppointmentId);

            if (error) throw error;
            toast({ title: "E-Prescription Sent", description: `The prescription has been sent to ${patientName}.` });
            setPrescriptionForm({ medication: '', type: '', time: '', dosage: '', instructions: '' });
            setCurrentAppointmentId(null);
            forceReload();
        } catch (error: any) {
            toast({ title: "Error sending prescription", description: error.message, variant: "destructive" });
        }
    }

    const openNotesDialog = (app: Appointment) => {
        setCurrentAppointmentId(app.id);
        setCurrentNotes(app.notes || "");
    }

    const openPrescriptionDialog = (app: Appointment) => {
        setCurrentAppointmentId(app.id);
        setPrescriptionForm(app.prescription || { medication: '', type: '', time: '', dosage: '', instructions: '' });
    }

    const openScheduleDialog = (app: Appointment) => {
        // Pre-fill the dialog with patient's preferred date/time if available
        if (app.preferredDate && typeof app.preferredDate === 'string') {
            try {
                const parsedDate = parse(app.preferredDate, 'yyyy-MM-dd', new Date());
                if (isValid(parsedDate)) {
                    setScheduleDate(parsedDate);
                } else {
                    setScheduleDate(new Date());
                }
            } catch (e) {
                setScheduleDate(new Date());
            }
        } else {
            setScheduleDate(new Date());
        }

        if (app.preferredTime) {
            setScheduleTime(app.preferredTime);
        } else {
            setScheduleTime("09:00");
        }
    }

    const isJoinButtonEnabled = (appointmentDate?: string) => {
        if (!appointmentDate) return false;
        const appointmentTime = new Date(appointmentDate);
        const diff = differenceInMinutes(appointmentTime, now);
        // Enable from 10 mins before to 10 mins after
        return diff <= 10 && diff > -10;
    };

    const getJoinTooltipContent = (appointmentDate?: string) => {
        if (!appointmentDate) return "This appointment has not been scheduled yet.";
        const appointmentTime = new Date(appointmentDate);
        if (isPast(appointmentTime) && differenceInMinutes(now, appointmentTime) > 10) {
            return "The window to join this call has passed.";
        }
        if (isFuture(appointmentTime) && differenceInMinutes(appointmentTime, now) > 10) {
            return `You can join the call 10 minutes before the start time.`;
        }
        return "Join your video consultation now.";
    }

    const getFormattedPreferredDate = (app: Appointment) => {
        let datePart = 'Date not specified';

        // Use preferred_date if available (snake_case — raw from Supabase)
        if (app.preferred_date && typeof app.preferred_date === 'string') {
            try {
                const parsedDate = parse(app.preferred_date, 'yyyy-MM-dd', new Date());
                if (isValid(parsedDate)) {
                    datePart = format(parsedDate, 'PP');
                }
            } catch (e) { /* Fallback to default */ }
        }

        let timePart = '';
        if (app.preferred_time) {
            const [hoursStr, minutesStr] = app.preferred_time.split(':');
            const hours = parseInt(hoursStr, 10);
            const minutes = parseInt(minutesStr, 10);
            if (!isNaN(hours) && !isNaN(minutes)) {
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const formattedHours = hours % 12 || 12;
                const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
                timePart = ` at ${formattedHours}:${formattedMinutes} ${ampm}`;
            }
        }
        return `${datePart}${timePart}`;
    };


    const renderTable = (data: Appointment[]) => (
        <div className="rounded-md border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Date &amp; Time</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                            </TableCell>
                        </TableRow>
                    ) : data.length > 0 ? data.map(app => {
                        let displayDate = 'Not Scheduled';

                        if (app.status === 'Pending') {
                            displayDate = getFormattedPreferredDate(app);
                        } else if (app.appointment_date) {
                            try {
                                const dateObj = new Date(app.appointment_date);
                                if (isValid(dateObj)) {
                                    displayDate = format(dateObj, 'PPpp');
                                } else {
                                    displayDate = 'Invalid Date Format';
                                }
                            } catch (e) {
                                displayDate = 'Parse Error';
                            }
                        } else if (app.status === 'Confirmed' || app.status === 'Completed') {
                            // Fallback: If it's confirmed but appointment_date is missing, try to show the requested date
                            displayDate = getFormattedPreferredDate(app);
                        }

                        return (
                            <TableRow key={app.id}>
                                <TableCell>
                                    <div className="font-medium">{app.patient_name}</div>
                                </TableCell>
                                <TableCell>{displayDate}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{app.appointment_mode}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={
                                        app.status === 'Confirmed' ? 'default' :
                                            app.status === 'Completed' ? 'secondary' :
                                                app.status === 'Declined' ? 'destructive' : 'outline'
                                    }>{app.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    {app.status === 'Pending' && (
                                        <>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline" className="mr-2">
                                                        <FileText className="mr-2 h-4 w-4" /> View Details
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Request Details</DialogTitle>
                                                        <DialogDescription>Review the patient's request before confirming.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2 text-sm text-left">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="font-semibold">Reason for Visit:</div>
                                                            <div>{app.reason_for_visit}</div>
                                                            <div className="font-semibold">Duration of Symptoms:</div>
                                                            <div>{app.symptoms_duration}</div>
                                                            <div className="font-semibold">Severity of Symptoms:</div>
                                                            <div>{app.symptoms_severity}</div>
                                                        </div>
                                                        {app.past_treatments && (
                                                            <div>
                                                                <div className="font-semibold mb-1">Past Treatments:</div>
                                                                <div className="text-muted-foreground bg-slate-50 p-2 rounded">{app.past_treatments}</div>
                                                            </div>
                                                        )}
                                                        {app.current_medications && (
                                                            <div>
                                                                <div className="font-semibold mb-1">Current Medications:</div>
                                                                <div className="text-muted-foreground bg-slate-50 p-2 rounded">{app.current_medications}</div>
                                                            </div>
                                                        )}
                                                        {app.allergies && (
                                                            <div>
                                                                <div className="font-semibold mb-1">Allergies:</div>
                                                                <div className="text-muted-foreground bg-slate-50 p-2 rounded">{app.allergies}</div>
                                                            </div>
                                                        )}

                                                        {app.attached_report_summary && (
                                                            <div className="mt-4 border-t pt-4">
                                                                <div className="font-semibold text-base mb-2">Attached AI Report</div>
                                                                <div className="font-medium">{app.attached_report_summary.conditionName}</div>
                                                                <div className="text-muted-foreground mt-1">{app.attached_report_summary.condition}</div>
                                                            </div>
                                                        )}

                                                        {(app.uploaded_image_urls?.length > 0 || app.uploaded_report_urls?.length > 0) && (
                                                            <div className="mt-4 border-t pt-4">
                                                                <div className="font-semibold text-base mb-2">Uploaded Media</div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {app.uploaded_image_urls?.map((url: string, i: number) => (
                                                                        <Button key={`img-${i}`} variant="outline" size="sm" asChild>
                                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                                <ImageIcon className="mr-2 h-4 w-4" /> Photo {i + 1}
                                                                            </a>
                                                                        </Button>
                                                                    ))}
                                                                    {app.uploaded_report_urls?.map((url: string, i: number) => (
                                                                        <Button key={`rep-${i}`} variant="outline" size="sm" asChild>
                                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                                <FileText className="mr-2 h-4 w-4" /> Document {i + 1}
                                                                            </a>
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {app.is_emergency && (
                                                            <div className="mt-4">
                                                                <Badge variant="destructive">⚠️ Marked as Emergency</Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">Toggle menu</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onSelect={() => handleConfirmRequest(app, true)} disabled={!app.preferred_date || !app.preferred_time}>
                                                                <CheckCircle className="mr-2 h-4 w-4" /> Quick Confirm
                                                            </DropdownMenuItem>
                                                            <DialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={() => openScheduleDialog(app)}>
                                                                    <Settings2 className="mr-2 h-4 w-4" /> Change & Confirm
                                                                </DropdownMenuItem>
                                                            </DialogTrigger>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e: any) => e.preventDefault()}>
                                                                    <XCircle className="mr-2 h-4 w-4" /> Decline
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>

                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Decline this request?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action will mark the appointment as declined and cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeclineRequest(app)} className="bg-destructive hover:bg-destructive/90">Decline</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>

                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Schedule Appointment for {app.patient_name}</DialogTitle>
                                                        <DialogDescription>
                                                            Patient preferred: {getFormattedPreferredDate(app)}.
                                                            <br />
                                                            Select a final date and time to confirm.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="space-y-2">
                                                            <Label>Date</Label>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}>
                                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                                        {scheduleDate ? format(scheduleDate, "PPP") : <span>Pick a date</span>}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0">
                                                                    <CalendarPicker mode="single" selected={scheduleDate} onSelect={setScheduleDate} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="time">Time</Label>
                                                            <Input id="time" type="time" value={scheduleTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduleTime(e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button onClick={() => handleConfirmRequest(app, false)}>Confirm Appointment</Button>
                                                        </DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </>
                                    )}
                                    {(app.status === 'Confirmed') && (
                                        <>
                                            {app.appointment_mode === 'Online' && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="inline-block">
                                                                <Button asChild size="sm" disabled={!isJoinButtonEnabled(app.appointment_date)}>
                                                                    <Link href={`/video/${app.id}`}>
                                                                        <Video className="mr-2 h-4 w-4" /> Join Call
                                                                    </Link>
                                                                </Button>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{getJoinTooltipContent(app.appointment_date)}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
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
                                                            <DropdownMenuItem onSelect={(e: any) => e.preventDefault()} className="text-destructive focus:text-destructive">
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
                                                            This will cancel the appointment for {app.patient_name}. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(app.id)} className="bg-destructive hover:bg-destructive/90">
                                                            Yes, Cancel
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    )}
                                    {app.status === 'Completed' && (
                                        <>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline" onClick={() => openPrescriptionDialog(app)}>
                                                        <Pill className="mr-2 h-4 w-4" /> E-Prescription
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>E-Prescription for {app.patient_name}</DialogTitle>
                                                        <DialogDescription>Fill out the details below to generate an e-prescription.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="medication">Medication</Label>
                                                            <Input id="medication" placeholder="e.g., Tretinoin Cream 0.05%" value={prescriptionForm.medication} onChange={(e) => setPrescriptionForm(p => ({ ...p, medication: e.target.value }))} />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label htmlFor="type">Medicine Type</Label>
                                                                <Select value={prescriptionForm.type} onValueChange={(v: string) => setPrescriptionForm(p => ({ ...p, type: v }))}>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select a type" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="cream">Cream</SelectItem>
                                                                        <SelectItem value="ointment">Ointment</SelectItem>
                                                                        <SelectItem value="gel">Gel</SelectItem>
                                                                        <SelectItem value="lotion">Lotion</SelectItem>
                                                                        <SelectItem value="foam">Foam</SelectItem>
                                                                        <SelectItem value="solution">Solution</SelectItem>
                                                                        <SelectItem value="shampoo">Shampoo</SelectItem>
                                                                        <SelectItem value="tablet">Tablet</SelectItem>
                                                                        <SelectItem value="capsule">Capsule</SelectItem>
                                                                        <SelectItem value="syrup">Syrup</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label htmlFor="time">Time of Day</Label>
                                                                <Select value={prescriptionForm.time} onValueChange={(v: string) => setPrescriptionForm(p => ({ ...p, time: v }))}>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select time" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="morn-after">Morning (After Food)</SelectItem>
                                                                        <SelectItem value="morn-before">Morning (Before Food)</SelectItem>
                                                                        <SelectItem value="noon-after">Afternoon (After Food)</SelectItem>
                                                                        <SelectItem value="noon-before">Afternoon (Before Food)</SelectItem>
                                                                        <SelectItem value="night-after">Night (After Food)</SelectItem>
                                                                        <SelectItem value="night-before">Night (Before Food)</SelectItem>
                                                                        <SelectItem value="twice-day">Twice a day</SelectItem>
                                                                        <SelectItem value="thrice-day">Thrice a day</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="dosage">Dosage</Label>
                                                            <Input id="dosage" placeholder="e.g., Apply a pea-sized amount once daily" value={prescriptionForm.dosage} onChange={(e) => setPrescriptionForm(p => ({ ...p, dosage: e.target.value }))} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="instructions">Additional Instructions</Label>
                                                            <Textarea id="instructions" placeholder="e.g., Avoid sun exposure. Use moisturizer." value={prescriptionForm.instructions} onChange={(e) => setPrescriptionForm(p => ({ ...p, instructions: e.target.value }))} />
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button onClick={() => handleSendPrescription(app.patient_name)}>Send to Patient</Button>
                                                        </DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" onClick={() => openNotesDialog(app)}>
                                                        <StickyNote className="mr-2 h-4 w-4" /> Notes
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Consultation Notes for {app.patient_name}</DialogTitle>
                                                        <DialogDescription>Add or edit your follow-up notes for this consultation. These notes will be visible to the patient.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4">
                                                        <Textarea
                                                            placeholder="Type your consultation notes here..."
                                                            className="min-h-[200px]"
                                                            value={currentNotes}
                                                            onChange={(e) => setCurrentNotes(e.target.value)}
                                                        />
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button onClick={handleSaveNotes}>Save Notes &amp; Mark Complete</Button>
                                                        </DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    }) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                No appointments in this category.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );

    const getAppointmentsByStatus = (status: Appointment['status']) => appointments.filter(a => a.status === status);

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
                        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto mb-4">
                            <TabsTrigger value="pending" className="truncate">Pending ({getAppointmentsByStatus('Pending').length})</TabsTrigger>
                            <TabsTrigger value="confirmed" className="truncate">Confirmed ({getAppointmentsByStatus('Confirmed').length})</TabsTrigger>
                            <TabsTrigger value="completed" className="truncate">Completed ({getAppointmentsByStatus('Completed').length})</TabsTrigger>
                            <TabsTrigger value="declined" className="truncate">Declined ({getAppointmentsByStatus('Declined').length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending">
                            {renderTable(getAppointmentsByStatus('Pending'))}
                        </TabsContent>
                        <TabsContent value="confirmed">
                            {renderTable(getAppointmentsByStatus('Confirmed'))}
                        </TabsContent>
                        <TabsContent value="completed">
                            {renderTable(getAppointmentsByStatus('Completed'))}
                        </TabsContent>
                        <TabsContent value="declined">
                            {renderTable(getAppointmentsByStatus('Declined'))}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
