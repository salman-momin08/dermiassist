
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Pill, StickyNote } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const initialAppointments = [
    {
        id: "APP001",
        patientName: "Liam Johnson",
        requestDate: "2024-07-28",
        mode: "Online",
        status: "Pending",
        reportId: "1",
        reportCondition: "Acne Vulgaris",
        reportFullText: "Analysis Report: Acne Vulgaris. Generated on 2024-05-15. Severity: Mild. It is recommended to use a gentle cleanser twice a day and apply a non-comedogenic moisturizer. Consider using over-the-counter benzoyl peroxide treatments. Avoid picking or squeezing pimples to prevent scarring. If the condition persists or worsens, consult a dermatologist. Do's: Cleanse your face twice daily with a mild, non-abrasive cleanser. Use non-comedogenic (won't clog pores) skin care products and cosmetics. Drink plenty of water to stay hydrated. Don'ts: Avoid harsh scrubbing or over-washing your face. Do not pick, pop, or squeeze pimples. Limit your intake of high-glycemic foods and dairy products if you notice a link. Submitted Info: Pre-medication: None. Disease Duration: 3 months.",
        previousNotes: "Initial consultation. Patient is new to the platform. No major concerns reported other than the current acne breakout.",
        notes: "",
    },
    {
        id: "APP002",
        patientName: "Olivia Smith",
        requestDate: "2024-07-27",
        mode: "Offline",
        status: "Pending",
        reportId: "2",
        reportCondition: "Eczema",
        reportFullText: "Analysis Report: Eczema. Generated on 2024-04-22. Severity: Moderate. Recommendations include daily moisturizing with a thick cream, avoiding known triggers like certain fabrics or soaps, and using a humidifier. Short, lukewarm baths are advised. Do's: Moisturize daily. Wear soft, breathable clothing. Use a humidifier in dry or cold weather. Don'ts: Avoid long, hot baths or showers. Steer clear of harsh soaps and detergents. Try not to scratch the affected area to prevent infection. Submitted Info: Pre-medication: Hydrocortisone cream (1%). Disease Duration: 6 months.",
        previousNotes: "Follow-up for eczema management. Patient reports the hydrocortisone cream is providing some relief but flare-ups persist, especially in dry weather.",
        notes: "",
    },
    {
        id: "APP003",
        patientName: "Noah Williams",
        requestDate: "2024-07-27",
        mode: "Online",
        status: "Confirmed",
        appointmentDate: "2024-08-05",
        appointmentTime: "11:00 AM",
        reportId: "3",
        reportCondition: "Rosacea",
        reportFullText: "Analysis Report: Rosacea. Generated on 2024-03-10. Severity: Mild. It is recommended to identify and avoid triggers such as spicy foods, alcohol, and extreme temperatures. A gentle skincare routine is crucial. Sun protection is paramount. Do's: Use sunscreen daily. Choose gentle, fragrance-free skincare products. Keep a diary to identify personal triggers. Don'ts: Avoid sun exposure without protection. Do not use harsh exfoliants or astringents. Be cautious with hot beverages and spicy foods. Submitted Info: Pre-medication: None. Disease Duration: 1 year.",
        notes: "Patient has been managing well, but we will discuss potential flare-up triggers in this session.",
    },
    {
        id: "APP004",
        patientName: "Emma Brown",
        requestDate: "2024-07-26",
        mode: "Offline",
        status: "Completed",
        appointmentDate: "2024-07-30",
        appointmentTime: "02:30 PM",
        reportId: "4",
        reportCondition: "Psoriasis",
        reportFullText: "...",
        notes: "Prescribed a new topical steroid and recommended light therapy. Follow-up scheduled for 4 weeks."
    },
];

type Appointment = typeof initialAppointments[number];

export default function DoctorAppointmentsPage() {
    const [appointments, setAppointments] = useState(initialAppointments);
    const [currentNotes, setCurrentNotes] = useState("");
    const { toast } = useToast();

    const handleRequest = (id: string, newStatus: 'Confirmed' | 'Declined') => {
        setAppointments(prev =>
            prev.map(app =>
                app.id === id ? { 
                    ...app, 
                    status: newStatus,
                    appointmentDate: newStatus === 'Confirmed' ? '2024-08-10' : undefined, // Mock date
                    appointmentTime: newStatus === 'Confirmed' ? '03:00 PM' : undefined,   // Mock time
                } : app
            )
        );
        toast({
            title: `Request ${newStatus}`,
            description: `The appointment request has been ${newStatus.toLowerCase()}.`,
        });
    };
    
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
                            {app.status === 'Pending' ? `Requested: ${app.requestDate}` : `${app.appointmentDate} at ${app.appointmentTime}`}
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
                                    <Button size="sm" variant="outline" onClick={() => handleRequest(app.id, 'Declined')}>Decline</Button>
                                    <Button size="sm" onClick={() => handleRequest(app.id, 'Confirmed')}>Confirm</Button>
                                </>
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
                                                <div className="space-y-2">
                                                    <Label htmlFor="type">Medicine Type</Label>
                                                    <Select>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="cream">Cream</SelectItem>
                                                            <SelectItem value="tablet">Tablet</SelectItem>
                                                            <SelectItem value="syrup">Syrup</SelectItem>
                                                            <SelectItem value="ointment">Ointment</SelectItem>
                                                        </SelectContent>
                                                    </Select>
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
