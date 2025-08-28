
"use client";

import { useState, useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, isValid } from "date-fns";

type Appointment = {
    id: string;
    patientId: string;
    patientName: string;
    requestDate: { seconds: number, nanoseconds: number };
    [key: string]: any;
};

type PatientCase = {
    patientId: string;
    patientName: string;
    patientAvatar: string;
    lastInteraction: string;
    fileCount: number;
    status: 'Active' | 'Resolved';
};

export default function DoctorCasesPage() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        
        // This query fetches all appointments for the current doctor.
        // This is used to derive the list of unique patients.
        const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid), orderBy("requestDate", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            setAppointments(fetchedAppointments);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching appointments for patient cases:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const patientCases = useMemo((): PatientCase[] => {
        if (appointments.length === 0) {
            return [];
        }
        
        const cases: Record<string, PatientCase> = {};
        
        appointments.forEach(app => {
            // Initialize patient case if it's the first time we see this patient
            if (!cases[app.patientId]) {
                 cases[app.patientId] = {
                    patientId: app.patientId,
                    patientName: app.patientName,
                    patientAvatar: app.patientAvatar || `https://placehold.co/100x100.png?text=${app.patientName.charAt(0)}`,
                    lastInteraction: new Date(0).toISOString(), // Initialize with a very old date
                    fileCount: 0,
                    status: 'Active' // Default status
                };
            }
            
            // Update last interaction date if this one is newer
            const interactionDate = new Date(app.requestDate.seconds * 1000);
            const lastInteractionDate = new Date(cases[app.patientId].lastInteraction);
            if (interactionDate > lastInteractionDate) {
                cases[app.patientId].lastInteraction = interactionDate.toISOString();
            }

            // Aggregate file counts
            const fileCount = (app.uploadedImageUrls?.length || 0) + (app.uploadedReportUrls?.length || 0) + (app.attachedReport ? 1 : 0);
            cases[app.patientId].fileCount += fileCount;
            
            // Update status (example logic: if any appointment is completed, case is resolved)
            if (app.status === 'Completed') {
                cases[app.patientId].status = 'Resolved';
            }
        });

        // Convert the record to an array and format the date for display
        return Object.values(cases).map(c => ({
            ...c,
            lastInteraction: isValid(new Date(c.lastInteraction)) ? format(new Date(c.lastInteraction), 'yyyy-MM-dd') : 'N/A'
        }));
    }, [appointments]);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Patient Cases</h1>
                <p className="text-muted-foreground">Manage and review all your patient cases.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Cases</CardTitle>
                    <CardDescription>An overview of active and resolved patient cases.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Patient</TableHead>
                                <TableHead className="hidden md:table-cell">Last Interaction</TableHead>
                                <TableHead className="hidden sm:table-cell">Files</TableHead>
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
                            ) : patientCases.length > 0 ? patientCases.map((c) => (
                                <TableRow key={c.patientId}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={c.patientAvatar} alt={c.patientName} data-ai-hint="person portrait"/>
                                                <AvatarFallback>{c.patientName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{c.patientName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{c.lastInteraction}</TableCell>
                                    <TableCell className="hidden sm:table-cell">{c.fileCount}</TableCell>
                                    <TableCell>
                                        <Badge variant={c.status === 'Active' ? 'default' : 'secondary'}>{c.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                         <Button asChild variant="outline" size="sm">
                                            <Link href={`/doctor/cases/${c.patientId}`}>
                                                <Eye className="mr-2 h-4 w-4" />View Case
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No patient cases found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
