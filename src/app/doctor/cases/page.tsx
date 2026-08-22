
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
import { createClient } from "@/lib/supabase/client";
import { format, isValid } from "date-fns";

type CaseLink = {
    patientId: string;
    patientName: string;
    lastAppointmentDate: string;
};

type PatientCase = CaseLink & {
    patientAvatar: string;
    lastInteraction: string;
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

        const supabase = createClient();
        setIsLoading(true);

        const fetchCases = async () => {
            try {
                // Fetch doctor_cases for this doctor
                const { data: cases, error: casesError } = await supabase
                    .from('doctor_cases')
                    .select('*')
                    .eq('doctor_id', user.id);

                if (casesError) throw casesError;

                if (!cases || cases.length === 0) {
                    setPatientCases([]);
                    setIsLoading(false);
                    return;
                }

                // Fetch full patient details for each case
                const casesPromises = cases.map(async (caseLink: any) => {
                    const { data: patientData, error: patientError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', caseLink.patient_id)
                        .single();

                    if (patientError) {
                        return null;
                    }

                    return {
                        patientId: caseLink.patient_id,
                        patientName: caseLink.patient_name,
                        lastAppointmentDate: caseLink.last_appointment_date,
                        patientAvatar: patientData?.photo_url || `https://placehold.co/100x100.png?text=${caseLink.patient_name.charAt(0)}`,
                        lastInteraction: isValid(new Date(caseLink.last_appointment_date)) ? format(new Date(caseLink.last_appointment_date), 'yyyy-MM-dd') : 'N/A',
                        fileCount: 0, // Placeholder
                        status: 'Active' as const, // Placeholder
                    };
                });

                const resolvedCases = (await Promise.all(casesPromises)).filter(c => c !== null) as PatientCase[];
                setPatientCases(resolvedCases);
            } catch (error) {
                // Silently handle fetch error for cases list
            } finally {
                setIsLoading(false);
            }
        };

        fetchCases();
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
                    <div className="rounded-md border overflow-x-auto">
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
                                                    <AvatarImage src={c.patientAvatar} alt={c.patientName} data-ai-hint="person portrait" />
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
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
