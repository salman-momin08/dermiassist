
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
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, isValid } from "date-fns";

type CaseLink = {
    patientId: string;
    patientName: string;
    lastAppointmentDate: string;
};

type PatientCase = CaseLink & {
    patientAvatar: string;
    fileCount: number;
    status: 'Active' | 'Resolved';
};

export default function DoctorCasesPage() {
    const { user } = useAuth();
    const [patientCases, setPatientCases] = useState<PatientCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        // 1. Fetch the list of patients linked to the doctor
        const casesCollectionRef = collection(db, "doctorCases", user.uid, "patients");

        const unsubscribe = onSnapshot(casesCollectionRef, async (snapshot) => {
            if (snapshot.empty) {
                setPatientCases([]);
                setIsLoading(false);
                return;
            }

            const caseLinks = snapshot.docs.map(doc => doc.data() as CaseLink);
            
            // 2. Fetch full details for each patient
            const casesPromises = caseLinks.map(async (caseLink) => {
                const patientDocRef = doc(db, "users", caseLink.patientId);
                const patientDoc = await getDoc(patientDocRef);
                const patientData = patientDoc.exists() ? patientDoc.data() : {};

                // In a real app, you would fetch file counts and proper status
                return {
                    ...caseLink,
                    patientAvatar: patientData.photoURL || `https://placehold.co/100x100.png?text=${caseLink.patientName.charAt(0)}`,
                    lastInteraction: isValid(new Date(caseLink.lastAppointmentDate)) ? format(new Date(caseLink.lastAppointmentDate), 'yyyy-MM-dd') : 'N/A',
                    fileCount: 0, // Placeholder
                    status: 'Active', // Placeholder
                } as PatientCase;
            });
            
            const resolvedCases = await Promise.all(casesPromises);
            setPatientCases(resolvedCases);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching patient cases:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
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
                                        No patient cases found. Confirm appointments to create cases.
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
