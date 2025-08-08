
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, MoreHorizontal, PlusCircle, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import { useAnalyses } from "@/hooks/use-analyses";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function MyAnalysesPage() {
    const { analyses, deleteAnalysis, isLoading } = useAnalyses();

    const handleDelete = (id: string) => {
        deleteAnalysis(id);
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex items-center justify-between space-y-2 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">
                        My Analyses
                    </h1>
                    <p className="text-muted-foreground">
                        View and manage your past skin analysis reports.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/analyze">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Analysis
                    </Link>
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            <Skeleton className="h-10 w-full rounded-md" />
                            <Skeleton className="h-20 w-full rounded-md" />
                            <Skeleton className="h-20 w-full rounded-md" />
                            <Skeleton className="h-20 w-full rounded-md" />
                        </div>
                    ) : analyses.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="hidden w-[100px] sm:table-cell">Image</TableHead>
                                    <TableHead>Condition</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="hidden md:table-cell">Severity</TableHead>
                                    <TableHead>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analyses.map(analysis => (
                                    <TableRow key={analysis.id}>
                                        <TableCell className="hidden sm:table-cell">
                                            <Image
                                                alt="Analysis image"
                                                className="aspect-square rounded-md object-cover"
                                                height="64"
                                                src={analysis.image}
                                                width="64"
                                                data-ai-hint="skin condition"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{analysis.condition}</TableCell>
                                        <TableCell>{analysis.date}</TableCell>
                                        <TableCell className="hidden md:table-cell">{analysis.severity}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild><Link href={`/my-analyses/${analysis.id}`} className="flex items-center cursor-pointer"><Eye className="mr-2 h-4 w-4" />View Details</Link></DropdownMenuItem>
                                                        <DropdownMenuItem className="flex items-center" disabled><FileText className="mr-2 h-4 w-4" />Download</DropdownMenuItem>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="flex items-center text-red-600 dark:text-red-500 focus:text-red-600 focus:dark:text-red-500" onSelect={(e) => e.preventDefault()}>
                                                                <Trash2 className="mr-2 h-4 w-4" />Delete
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete this analysis report.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(analysis.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center p-12">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No analyses yet</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Get started by performing your first skin analysis.
                            </p>
                            <Button className="mt-6" asChild>
                                <Link href="/analyze">Start New Analysis</Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
