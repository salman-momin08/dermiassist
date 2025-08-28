
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
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";

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

// Mock data to allow UI to be functional
const mockPatientCases: PatientCase[] = [
    { patientId: 'patient1', patientName: 'John Doe', patientAvatar: 'https://placehold.co/100x100.png?text=JD', lastInteraction: '2024-05-20', fileCount: 2, status: 'Active' },
    { patientId: 'patient2', patientName: 'Jane Smith', patientAvatar: 'https://placehold.co/100x100.png?text=JS', lastInteraction: '2024-05-18', fileCount: 5, status: 'Resolved' },
    { patientId: 'patient3', patientName: 'Sam Wilson', patientAvatar: 'https://placehold.co/100x100.png?text=SW', lastInteraction: '2024-05-21', fileCount: 0, status: 'Active' },
];

export default function DoctorCasesPage() {
    const { user } = useAuth();
    const [patientCases, setPatientCases] = useState<PatientCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Using mock data since appointments collection is empty
        // This makes the UI usable for demonstration and testing purposes
        if (user) {
            setPatientCases(mockPatientCases);
        }
        setIsLoading(false);
    }, [user]);

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
