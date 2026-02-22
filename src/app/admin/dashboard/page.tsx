
"use client";

import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Users, UserCheck, FileClock, Trash2, CheckCircle, XCircle, Search, LineChart, User as UserIcon, Loader2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, subMonths, startOfMonth } from "date-fns";

const chartConfig = {
    users: {
        label: "New Users",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig;

type User = {
    id: string;
    name: string;
    email: string;
    role: 'patient' | 'doctor' | 'admin';
    joined: string;
    updated_at?: string;
    [key: string]: any;
};

type Doctor = User & {
    specialization: string;
    status: 'Verified' | 'Pending' | 'Not Verified';
};


export default function AdminDashboardPage() {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [patients, setPatients] = useState<User[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userSearch, setUserSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const { toast } = useToast();
    const supabase = createClient();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const fetchSession = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        fetchSession();
    }, [supabase]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            if (!user) {
                setIsLoading(false);
                return;
            }

            // Fetch all users (excluding admins)
            const { data: usersData, error: usersError } = await supabase
                .from('profiles')
                .select('*')
                .neq('role', 'admin')
                .order('created_at', { ascending: false });

            if (usersError) {
                toast({
                    title: "Error",
                    description: "Failed to load users",
                    variant: "destructive"
                });
            } else {
                const formattedUsers = (usersData || []).map(item => ({
                    ...item,
                    name: item.display_name || 'Unknown',
                    joined: item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A',
                })) as User[];

                setAllUsers(formattedUsers);
            }

            // Fetch contact requests
            const { data: requestsData, error: requestsError } = await supabase
                .from('contact_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (requestsError) {
                toast({
                    title: "Error",
                    description: "Failed to load requests",
                    variant: "destructive"
                });
            } else {
                setRequests(requestsData || []);
            }

            setIsLoading(false);
        };

        fetchData();

        const channel = supabase
            .channel('admin-users')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles'
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, toast, user]);



    const handleDeleteUser = async (userId: string) => {
        try {
            // Note: In Supabase, deleting from public.profiles will cascade to auth.users if set up with 'on delete cascade' 
            // OR we might need to delete from auth.users via an edge function / admin API if we want full removal.
            // For now, let's delete the profile.
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;
            toast({ title: "User Deleted", description: "The user's record has been removed." });
        } catch (error) {
            toast({ title: "Error", description: "Could not delete the user.", variant: "destructive" });
        }
    };

    const patientUsers = useMemo(() => {
        const patients = allUsers.filter(user => user.role === 'patient');
        return patients;
    }, [allUsers]);

    const filteredUsers = useMemo(() => {
        const filtered = allUsers.filter(user =>
            user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
            user.email?.toLowerCase().includes(userSearch.toLowerCase())
        );
        return filtered;
    }, [allUsers, userSearch]);

    const analyticsData = useMemo(() => {
        if (isLoading || allUsers.length === 0) return [];

        const monthlyCounts: { [key: string]: number } = {};

        // Initialize last 6 months
        for (let i = 0; i < 6; i++) {
            const month = format(subMonths(new Date(), i), 'MMM yyyy');
            monthlyCounts[month] = 0;
        }

        allUsers.forEach(user => {
            if (user.createdAt) {
                const joinDate = new Date(user.createdAt);
                const month = format(joinDate, 'MMM yyyy');
                if (monthlyCounts.hasOwnProperty(month)) {
                    monthlyCounts[month]++;
                }
            }
        });

        return Object.entries(monthlyCounts)
            .map(([month, count]) => ({
                month: month.split(' ')[0], // Just get month name
                users: count,
                date: startOfMonth(new Date(month))
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [allUsers, isLoading]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading Admin Dashboard...</p>
            </div>
        );
    }

    const renderDetail = (label: string, value: any) => {
        if (!value) return null;
        return (
            <div className="grid grid-cols-3 gap-2">
                <span className="font-medium text-muted-foreground col-span-1">{label}:</span>
                <span className="col-span-2">{value}</span>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Dashboard</h1>
                <p className="text-muted-foreground">Manage users, doctors, and system settings.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{allUsers.length}</div>
                        <p className="text-xs text-muted-foreground">Total registered users on the platform.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Role Change Requests</CardTitle>
                        <FileClock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">-</div>
                        <p className="text-xs text-muted-foreground">Manage requests in the <Link href="/admin/requests" className="text-primary hover:underline">Requests</Link> page.</p>
                    </CardContent>
                </Card>
            </div>

            <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedUser(null)}>
                <div className="grid gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>Oversee all registered users on the platform (patients and doctors).</CardDescription>
                            <div className="relative pt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or email..."
                                    className="pl-9"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Joined Date</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(() => {
                                            return filteredUsers.length > 0 ? filteredUsers.map(user => {
                                                return (
                                                    <TableRow key={user.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{user.name}</div>
                                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={user.role === 'doctor' ? 'default' : 'secondary'} className="capitalize">
                                                                {user.role}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {user.joined}
                                                        </TableCell>
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
                                                                        <DialogTrigger asChild>
                                                                            <DropdownMenuItem onSelect={() => setSelectedUser(user)}>
                                                                                <UserIcon className="mr-2 h-4 w-4" /> View Profile
                                                                            </DropdownMenuItem>
                                                                        </DialogTrigger>
                                                                        <AlertDialogTrigger asChild>
                                                                            <DropdownMenuItem className="text-red-600 dark:text-red-500 focus:text-red-600 focus:dark:text-red-500" onSelect={(e) => e.preventDefault()}>
                                                                                <Trash2 className="mr-2 h-4 w-4" />Delete User
                                                                            </DropdownMenuItem>
                                                                        </AlertDialogTrigger>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This action cannot be undone. This will permanently delete this user's record from Supabase.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center">
                                                        No users found.
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })()}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>User Profile Details</DialogTitle>
                        <DialogDescription>
                            A complete overview of {selectedUser?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedUser && (
                        <ScrollArea className="max-h-[70vh] pr-4">
                            <div className="space-y-6 pt-4">
                                <div className="flex items-center space-x-4">
                                    <Avatar className="h-20 w-20">
                                        <AvatarImage src={selectedUser.photo_url || `https://placehold.co/100x100.png?text=${selectedUser.name.charAt(0)}`} data-ai-hint="user portrait" />
                                        <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-xl">{selectedUser.name}</h3>
                                        <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                        <Badge variant={selectedUser.role === 'doctor' ? 'secondary' : 'outline'}>{selectedUser.role}</Badge>
                                    </div>
                                </div>
                                <Separator />

                                <div className="space-y-3 text-sm">
                                    <h4 className="font-semibold text-base">Personal Information</h4>
                                    {renderDetail("User ID", selectedUser.id)}
                                    {renderDetail("Joined", selectedUser.joined)}
                                    {renderDetail("Phone", selectedUser.phone || selectedUser.mobile)}
                                    {renderDetail("Date of Birth", selectedUser.dob ? new Date(selectedUser.dob).toLocaleDateString() : null)}
                                    {renderDetail("Gender", selectedUser.gender)}
                                    {renderDetail("Blood Group", selectedUser.blood_group)}
                                    {renderDetail("Address", selectedUser.address)}
                                    {renderDetail("City", selectedUser.city)}
                                    {renderDetail("State", selectedUser.state)}
                                </div>

                                {selectedUser.role === 'doctor' && (
                                    <>
                                        <Separator />
                                        <div className="space-y-3 text-sm">
                                            <h4 className="font-semibold text-base">Professional Details</h4>
                                            {renderDetail("Specialization", selectedUser.specialization)}
                                            {renderDetail("Medical ID", selectedUser.medical_id)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );


}

