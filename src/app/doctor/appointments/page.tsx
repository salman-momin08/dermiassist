
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Pill, StickyNote, Calendar, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { format, set } from "date-fns"
import { cn } from "@/lib/utils"

const initialAppointments: any[] = [];

type Appointment = {
    id: string;
    patientName: string;
    requestDate: string;
    mode: string;
    status: string;
    reportId: string;
    reportCondition: string;
    reportFullText: string;
    previousNotes?: string;
    notes: string;
    appointmentDate?: string;
};

export default function DoctorAppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
    const [currentNotes, setCurrentNotes] = useState("");
    const { toast } = useToast();
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
    const [scheduleTime, setScheduleTime] = useState("09:00");

    const handleConfirmRequest = (id: string) => {
        if (!scheduleDate) {
            toast({ title: "Please select a date.", variant: "destructive" });
            return;
        }

        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const finalDateTime = set(scheduleDate, { hours, minutes });

        setAppointments(prev =>
            prev.map(app =>
                app.id === id ? { 
                    ...app, 
                    status: 'Confirmed',
                    appointmentDate: finalDateTime.toISOString(),
                } : app
            )
        );
        toast({
            title: `Request Confirmed`,
            description: `The appointment has been scheduled.`,
        });
    };
    
    const handleDeclineRequest = (id: string) => {
        setAppointments(prev => prev.map(app => app.id === id ? {...app, status: 'Declined' } : app));
        toast({ title: "Request Declined", variant: "destructive" });
    }
    
    const handleSaveNotes = (id: string) => {
        setAppointments(prev =>
            prev.map(app =>
                app.id === id ? { ...app, notes: currentNotes } : app
            )
        );
        toast({ title: "Notes Saved", description: "The consultation notes have been saved." });
        setCurrentNotes('');
    }

    const handleSendPrescription = (patientName: string) => {
        toast({ title: "E-Prescription Sent", description: `The prescription has been sent to ${patientName}.` });
    }

    const renderTable = (data: Appointment[]) => (
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
                            {app.status === 'Pending' ? `Requested: ${app.requestDate}` : app.appointmentDate ? format(new Date(app.appointmentDate), 'PPpp') : 'Not Scheduled'}
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
                                            <DialogDescription>Select a date and time to confirm this appointment.</DialogDescription>
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
                             {(app.status === 'Confirmed' || app.status === 'Completed') && (
                                <>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline">
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
                                                    <Input id="medication" placeholder="e.g., Tretinoin Cream 0.05%" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="type">Medicine Type</Label>
                                                        <Select>
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
                                                        <Select>
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
                                                    <Input id="dosage" placeholder="e.g., Apply a pea-sized amount once daily" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="instructions">Additional Instructions</Label>
                                                    <Textarea id="instructions" placeholder="e.g., Avoid sun exposure. Use moisturizer." />
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
                                             <Button size="sm" onClick={() => setCurrentNotes(app.notes || "")}>
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
                                                    <Button onClick={() => handleSaveNotes(app.id)}>Save Notes</Button>
                                                </DialogClose>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
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
