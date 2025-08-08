
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, Calendar, FileText, Bot, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const mockCaseDetails = {
    id: "CASE001",
    patientName: "Liam Johnson",
    patientAge: 28,
    patientGender: "Male",
    status: "Active",
    condition: "Acne Vulgaris",
    timeline: [
        { type: "appointment", date: "2024-07-28", title: "Follow-up Consultation", description: "Online session to review progress." },
        { type: "report", date: "2024-07-20", title: "AI Analysis Report", description: "Initial analysis submitted by patient." },
        { type: "appointment", date: "2024-07-15", title: "Initial Consultation", description: "First appointment booked." },
    ],
    notes: "Patient reports improvement with the prescribed topical treatment. Redness has decreased. Recommending continued use and a follow-up in 2 weeks. Advised on a non-comedogenic skincare routine.",
};

export default function CaseDetailPage({ params }: { params: { id: string } }) {
    const { toast } = useToast();
    const [notes, setNotes] = useState(mockCaseDetails.notes);

    const handleSaveNotes = () => {
        // In a real app, you'd save this to a database.
        console.log("Saving notes:", notes);
        toast({
            title: "Notes Saved",
            description: "Your notes for this case have been successfully updated.",
        });
    };

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
            
            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline">Case Details: {mockCaseDetails.condition}</CardTitle>
                            <div className="flex items-center gap-2 pt-1">
                                <Badge variant={mockCaseDetails.status === 'Active' ? 'default' : 'secondary'}>{mockCaseDetails.status}</Badge>
                                <span className="text-sm text-muted-foreground">Case ID: {mockCaseDetails.id}</span>
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
                                {mockCaseDetails.timeline.map((item, index) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                                                {item.type === 'appointment' ? <Calendar className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                                            </div>
                                            {index < mockCaseDetails.timeline.length - 1 && <div className="w-px h-full bg-border" />}
                                        </div>
                                        <div className="pb-6">
                                            <p className="font-semibold">{item.title}</p>
                                            <p className="text-sm text-muted-foreground">{item.description}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
                                        </div>
                                    </div>
                                ))}
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
                                    <AvatarImage src={`https://placehold.co/100x100.png?text=${mockCaseDetails.patientName.charAt(0)}`} data-ai-hint="patient portrait" />
                                    <AvatarFallback>{mockCaseDetails.patientName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-lg">{mockCaseDetails.patientName}</h3>
                                    <p className="text-sm text-muted-foreground">{mockCaseDetails.patientAge} years old, {mockCaseDetails.patientGender}</p>
                                </div>
                            </div>
                            <Separator />
                             <div className="space-y-2">
                                <Button className="w-full" variant="outline">
                                    <FileText className="mr-2 h-4 w-4" /> View Full Medical History
                                </Button>
                                 <Button className="w-full">
                                    <MessageSquare className="mr-2 h-4 w-4" /> Chat with Patient
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
        </div>
    );
}

// You might need to add this import if it's missing
import { MessageSquare } from "lucide-react";
