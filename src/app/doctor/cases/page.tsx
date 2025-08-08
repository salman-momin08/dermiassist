
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, FileText, MessageSquare } from "lucide-react";
import Link from "next/link";

const mockCases = [
    { id: "CASE001", patientName: "Liam Johnson", condition: "Acne Vulgaris", lastUpdate: "2024-07-28", status: "Active" },
    { id: "CASE002", patientName: "Olivia Smith", condition: "Eczema", lastUpdate: "2024-07-27", status: "Active" },
    { id: "CASE003", patientName: "Noah Williams", condition: "Rosacea", lastUpdate: "2024-07-27", status: "Resolved" },
    { id: "CASE004", patientName: "Emma Brown", condition: "Psoriasis", lastUpdate: "2024-07-26", status: "Active" },
    { id: "CASE005", patientName: "James Wilson", condition: "Dermatitis", lastUpdate: "2024-07-25", status: "Resolved" },
];

export default function DoctorCasesPage() {
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
                                <TableHead>Condition</TableHead>
                                <TableHead className="hidden md:table-cell">Last Update</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockCases.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.patientName}</TableCell>
                                    <TableCell>{c.condition}</TableCell>
                                    <TableCell className="hidden md:table-cell">{c.lastUpdate}</TableCell>
                                    <TableCell>
                                        <Badge variant={c.status === 'Active' ? 'default' : 'secondary'}>{c.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>
                                                    <FileText className="mr-2 h-4 w-4" />View Case Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                     <MessageSquare className="mr-2 h-4 w-4" />Chat with Patient
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
