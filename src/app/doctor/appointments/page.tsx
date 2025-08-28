
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Pill, StickyNote, Loader2, Video, Calendar as CalendarIcon, Trash2, MoreHorizontal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { format, set, isValid } from "date-fns"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"


type Appointment = {
    id: string;
    patientName: string;
    requestDate: { seconds: number, nanoseconds: number };
    preferredDate?: string;
    preferredTime?: string;
    mode: 'Online' | 'Offline';
    status: 'Pending' | 'Confirmed' | 'Declined' | 'Completed';
    appointmentDate?: string;
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
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentNotes, setCurrentNotes] = useState("");
    const [currentAppointmentId, setCurrentAppointmentId] = useState<string | null>(null);
    const { toast } = useToast();
    
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
    const [scheduleTime, setScheduleTime] = useState("09:00");
    
    const [prescriptionForm, setPrescriptionForm] = useState({
        medication: '',
        type: '',
        time: '',
        dosage: '',
        instructions: ''
    });

    useEffect(() => {
        if (!user) return;

        setIsLoading(true);
        const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            setAppointments(fetchedAppointments);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching appointments:", error);
            toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);
    

    const handleConfirmRequest = async (id: string) => {
        if (!scheduleDate) {
            toast({ title: "Please select a date.", variant: "destructive" });
            return;
        }

        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const finalDateTime = set(scheduleDate, { hours, minutes, seconds: 0, milliseconds: 0 });

        const appointmentRef = doc(db, 'appointments', id);
        try {
            await updateDoc(appointmentRef, { 
                status: 'Confirmed',
                appointmentDate: finalDateTime.toISOString(),
            });
             toast({
                title: `Request Confirmed`,
                description: `The appointment has been scheduled.`,
            });
        } catch(error) {
            toast({ title: "Error confirming request", variant: "destructive" });
        }
    };
    
    const handleDeclineRequest = async (id: string) => {
        const appointmentRef = doc(db, 'appointments', id);
        try {
            await updateDoc(appointmentRef, { status: 'Declined' });
            toast({ title: "Request Declined", variant: "destructive" });
        } catch(error) {
            toast({ title: "Error declining request", variant: "destructive" });
        }
    }
    
    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, "appointments", id));
            toast({
                title: "Appointment Cancelled",
                description: "The appointment has been removed.",
            });
        } catch (error) {
            console.error("Error cancelling appointment:", error);
            toast({
                title: "Error",
                description: "Could not cancel the appointment.",
                variant: "destructive",
            });
        }
    };
    
    const handleSaveNotes = async () => {
        if (!currentAppointmentId) return;
        const appointmentRef = doc(db, 'appointments', currentAppointmentId);
        try {
            await updateDoc(appointmentRef, { notes: currentNotes, status: 'Completed' });
            toast({ title: "Notes Saved", description: "The consultation notes have been saved and the appointment marked as complete." });
            setCurrentNotes('');
            setCurrentAppointmentId(null);
        } catch(error) {
            toast({ title: "Error saving notes", variant: "destructive" });
        }
    }

    const handleSendPrescription = async (patientName: string) => {
         if (!currentAppointmentId) return;
         const appointmentRef = doc(db, 'appointments', currentAppointmentId);
         try {
            await updateDoc(appointmentRef, {
                prescription: {
                    ...prescriptionForm,
                    dateIssued: new Date().toISOString(),
                }
            });
            toast({ title: "E-Prescription Sent", description: `The prescription has been sent to ${patientName}.` });
            setPrescriptionForm({ medication: '', type: '', time: '', dosage: '', instructions: '' }); 
            setCurrentAppointmentId(null);
         } catch(error) {
            toast({ title: "Error sending prescription", variant: "destructive" });
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

    const renderTable = (data: Appointment[]) => (
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
                        if (app.requestDate && app.requestDate.seconds) {
                            const dateObj = new Date(app.requestDate.seconds * 1000);
                            if (isValid(dateObj)) {
                                displayDate = `Requested: ${format(dateObj, 'PP')}`;
                            } else {
                                displayDate = 'Invalid Request Date';
                            }
                        } else {
                             displayDate = 'Date not set';
                        }
                    } else if (app.appointmentDate) {
                        const dateObj = new Date(app.appointmentDate);
                         if (isValid(dateObj)) {
                            displayDate = format(dateObj, 'PPpp');
                        } else {
                            displayDate = 'Invalid Appointment Date'
                        }
                    }
                    
                    return (
                        <TableRow key={app.id}>
                            <TableCell>
                                <div className="font-medium">{app.patientName}</div>
                            </TableCell>
                            <TableCell>{displayDate}</TableCell>
                            <TableCell>
                               <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                    {app.mode === "Online" ? <Video className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
                                    {app.mode}
                                </Badge>
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
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm">Confirm</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Schedule Appointment for {app.patientName}</DialogTitle>
                                                <DialogDescription>
                                                    Patient preferred date: {app.preferredDate ? format(new Date(app.preferredDate), 'PPP') : 'Not specified'} at {app.preferredTime || 'any time'}.
                                                    <br/>
                                                    Select a final date and time to confirm.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Date</Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full justify-start text-left font-normal",
                                                                    !scheduleDate && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {scheduleDate ? format(scheduleDate, "PPP") : <span>Pick a date</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            <CalendarPicker
                                                                mode="single"
                                                                selected={scheduleDate}
                                                                onSelect={setScheduleDate}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="time">Time</Label>
                                                    <Input id="time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="ghost" onClick={() => handleDeclineRequest(app.id)}>Decline Request</Button>
                                                <DialogClose asChild>
                                                    <Button onClick={() => handleConfirmRequest(app.id)}>Confirm Appointment</Button>
                                                </DialogClose>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                 )} 
                                 {(app.status === 'Confirmed') && (
                                    <>
                                      {app.mode === 'Online' && (
                                        <Button asChild size="sm">
                                          <Link href={`/video/${app.id}`}>
                                            <Video className="mr-2 h-4 w-4" /> Join Call
                                          </Link>
                                        </Button>
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
                                              This will cancel the appointment for {app.patientName}. This action cannot be undone.
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
                                                    <DialogTitle>E-Prescription for {app.patientName}</DialogTitle>
                                                    <DialogDescription>Fill out the details below to generate an e-prescription.</DialogDescription>
                                                </DialogHeader>
                                                <div className="grid gap-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="medication">Medication</Label>
                                                        <Input id="medication" placeholder="e.g., Tretinoin Cream 0.05%" value={prescriptionForm.medication} onChange={(e) => setPrescriptionForm(p => ({...p, medication: e.target.value}))}/>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="type">Medicine Type</Label>
                                                            <Select value={prescriptionForm.type} onValueChange={(v) => setPrescriptionForm(p => ({...p, type: v}))}>
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
                                                            <Select value={prescriptionForm.time} onValueChange={(v) => setPrescriptionForm(p => ({...p, time: v}))}>
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
                                                        <Input id="dosage" placeholder="e.g., Apply a pea-sized amount once daily" value={prescriptionForm.dosage} onChange={(e) => setPrescriptionForm(p => ({...p, dosage: e.target.value}))}/>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="instructions">Additional Instructions</Label>
                                                        <Textarea id="instructions" placeholder="e.g., Avoid sun exposure. Use moisturizer." value={prescriptionForm.instructions} onChange={(e) => setPrescriptionForm(p => ({...p, instructions: e.target.value}))}/>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <DialogClose asChild>
                                                        <Button onClick={() => handleSendPrescription(app.patientName)}>Send to Patient</Button>
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
                                                    <DialogTitle>Consultation Notes for {app.patientName}</DialogTitle>
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
                                                        <Button onClick={handleSaveNotes}>Save Notes & Mark Complete</Button>
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
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="pending">Pending ({getAppointmentsByStatus('Pending').length})</TabsTrigger>
                            <TabsTrigger value="confirmed">Confirmed ({getAppointmentsByStatus('Confirmed').length})</TabsTrigger>
                            <TabsTrigger value="completed">Completed ({getAppointmentsByStatus('Completed').length})</TabsTrigger>
                            <TabsTrigger value="declined">Declined ({getAppointmentsByStatus('Declined').length})</TabsTrigger>
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
