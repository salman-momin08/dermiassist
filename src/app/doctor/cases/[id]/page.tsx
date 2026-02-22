
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, User, Calendar, Bot, MessageSquare, Loader2, FileText, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useParams, notFound } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { format, isValid } from "date-fns";
import { AnalysisReport } from "@/hooks/use-analyses";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Appointment = {
    id: string;
    request_date: string;
    appointment_date?: string;
    status: string;
    notes?: string;
    attached_report?: {
        condition_name: string;
        condition: string;
        recommendations: string;
        dos?: string[];
        donts?: string[];
    };
    uploaded_image_urls?: string[];
    uploaded_report_urls?: string[];
};

type TimelineItem = {
    type: 'appointment';
    title: string;
    description: string;
    date: Date; // Use Date object for sorting
    data?: any;
};

type PatientData = {
    uid: string;
    displayName: string;
    [key: string]: any;
}

export default function CaseDetailPage() {
    const params = useParams();
    const patientId = params.id as string;
    const { user } = useAuth();
    const { toast } = useToast();

    const [patient, setPatient] = useState<PatientData | null>(null);
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notes, setNotes] = useState("");
    const [activeReport, setActiveReport] = useState<any>(null);

    // Fetch primary patient data first
    useEffect(() => {
        const fetchPatient = async () => {
            if (!user || !patientId) {
                setIsLoading(false);
                return;
            };

            const supabase = createClient();
            setIsLoading(true);
            try {
                const { data: patientData, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', patientId)
                    .single();

                if (error) throw error;

                if (patientData) {
                    setPatient({ uid: patientData.id, ...patientData } as PatientData);
                    setNotes(patientData.doctor_notes?.[user.id] || "");
                } else {
                    notFound();
                }
            } catch (error) {
                toast({ title: "Error", description: "Could not load patient data.", variant: "destructive" });
                setIsLoading(false);
            }
        };
        fetchPatient();
    }, [user, patientId, toast]);

    // Fetch related appointments after patient data is loaded
    useEffect(() => {
        const fetchRelatedData = async () => {
            if (!patient || !user) return;

            const supabase = createClient();
            try {
                const { data: appointments, error: apptError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('doctor_id', user.id) // Changed doctorId to doctor_id, user.uid to user.id
                    .eq('patient_id', patient.uid) // Changed patientId to patient_id, patient.uid to patient.uid
                    .order('request_date', { ascending: false }); // Changed requestDate to request_date

                if (apptError) throw apptError;

                const newTimeline: TimelineItem[] = [];
                appointments?.forEach((app: Appointment) => { // Changed app: any to app: Appointment
                    let description = `Appointment was ${app.status.toLowerCase()}`;
                    if (app.attached_report?.condition_name) { // Changed attachedReport to attached_report, conditionName to condition_name
                        description += ` with AI report for ${app.attached_report.condition_name}.`;
                    }
                    newTimeline.push({
                        type: 'appointment',
                        title: `Appointment ${app.status}`,
                        description: description,
                        date: app.appointment_date ? new Date(app.appointment_date) : new Date(app.request_date), // Changed appointmentDate to appointment_date, requestDate.seconds * 1000 to request_date
                        data: app
                    });
                });

                newTimeline.sort((a, b) => b.date.getTime() - a.date.getTime());
                setTimeline(newTimeline);

            } catch (error) {
                toast({ title: "Error", description: "Could not load timeline details.", variant: "destructive" });
            } finally {
                setIsLoading(false); // Set loading to false after all fetches are done
            }
        };

        fetchRelatedData();

    }, [patient, user, toast]);

    const handleSaveNotes = async () => {
        if (!user) return;
        toast({ title: "Saving Notes..." });
        const supabase = createClient();
        try {
            // Update doctor_notes JSONB field
            const { error } = await supabase
                .from('profiles')
                .update({
                    doctor_notes: {
                        ...patient?.doctor_notes,
                        [user.id]: notes
                    }
                })
                .eq('id', patientId);

            if (error) throw error;
            toast({
                title: "Notes Saved",
                description: "Your notes for this case have been successfully updated.",
            });
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to save notes.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <div className="mb-6">
                    <Button variant="outline" asChild>
                        <Link href="/doctor/cases">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to All Cases
                        </Link>
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Case Not Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">The case you are looking for does not exist or you do not have permission to view it.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const formatDate = (date: Date) => {
        return isValid(date) ? format(date, "PPp") : 'Invalid Date';
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/doctor/cases">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Cases
                    </Link>
                </Button>
            </div>

            <Dialog>
                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-2xl font-headline">Case Details</CardTitle>
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-sm text-muted-foreground">Patient ID: {patient.uid}</span>
                                </div>
                            </CardHeader>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Case Activity</CardTitle>
                                <CardDescription>A timeline of the patient's reports and appointments.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {timeline.map((item, index) => (
                                        <div key={index} className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                                                    <Calendar className="h-5 w-5" />
                                                </div>
                                                {index < timeline.length - 1 && <div className="w-px h-full bg-border" />}
                                            </div>
                                            <div className="pb-6 w-full">
                                                <p className="font-semibold">{item.title}</p>
                                                <p className="text-sm text-muted-foreground">{item.description}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{formatDate(item.date)}</p>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {item.data.attached_report ? (
                                                        <DialogTrigger asChild>
                                                            <Button variant="secondary" size="sm" onClick={() => setActiveReport(item.data.attached_report)}>
                                                                <FileText className="mr-2 h-4 w-4" /> View AI Report
                                                            </Button>
                                                        </DialogTrigger>
                                                    ) : null}
                                                    {item.data.uploaded_image_urls?.map((url: string, i: number) => (
                                                        <Button key={`img-${i}`} variant="outline" size="sm" asChild>
                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                <ImageIcon className="mr-2 h-4 w-4" /> Photo {i + 1}
                                                            </a>
                                                        </Button>
                                                    ))}
                                                    {item.data.uploaded_report_urls?.map((url: string, i: number) => (
                                                        <Button key={`rep-${i}`} variant="outline" size="sm" asChild>
                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                <FileText className="mr-2 h-4 w-4" /> Document {i + 1}
                                                            </a>
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {timeline.length === 0 && (
                                        <p className="text-muted-foreground text-center py-8">No activity found for this case.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="text-primary" />
                                    Patient Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={patient.photo_url || `https://placehold.co/100x100.png?text=${patient.display_name?.charAt(0)}`} data-ai-hint="patient portrait" />
                                        <AvatarFallback>{patient.display_name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-lg">{patient.display_name}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {patient.dob ? `${new Date().getFullYear() - new Date(patient.dob).getFullYear()} years old, ` : ''}
                                            {patient.gender}
                                        </p>
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <Button className="w-full" variant="outline">
                                        <FileText className="mr-2 h-4 w-4" /> View Full Medical History
                                    </Button>
                                    <Button className="w-full" asChild>
                                        <Link href="/doctor/chat">
                                            <MessageSquare className="mr-2 h-4 w-4" /> Chat with Patient
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Doctor's Notes</CardTitle>
                                <CardDescription>Private notes for this case. Not visible to the patient.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    placeholder="Add your notes here..."
                                    className="min-h-[200px]"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                                <Button className="w-full" onClick={handleSaveNotes}>
                                    Save Notes
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>AI Analysis Report</DialogTitle>
                    </DialogHeader>
                    {activeReport ? (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                            <h3 className="font-bold text-lg">{activeReport.conditionName}</h3>
                            <p className="text-sm text-muted-foreground">{activeReport.condition}</p>
                            <Separator />
                            <h4 className="font-semibold">Expert Recommendations:</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activeReport.recommendations}</p>
                            {(activeReport.dos && activeReport.dos.length > 0) && (
                                <>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-semibold mb-2">Do's</h4>
                                            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                                {activeReport.dos?.map((item: string, i: number) => <li key={i}>{item}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2">Don'ts</h4>
                                            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                                {activeReport.donts?.map((item: string, i: number) => <li key={i}>{item}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <p>No report details to display.</p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
