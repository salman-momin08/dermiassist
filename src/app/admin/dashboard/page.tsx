
"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Users, UserCheck, FileClock, Trash2, CheckCircle, XCircle, Search, LineChart, User as UserIcon } from "lucide-react";
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

const mockUsersData = [
    { id: 'usr_1', name: 'Patient One', email: 'patient1@example.com', role: 'patient', joined: '2024-07-20' },
    { id: 'usr_2', name: 'Dr. Emily Carter', email: 'dremily.carter@skinwise.com', role: 'doctor', joined: '2024-07-19' },
    { id: 'usr_3', name: 'Patient Two', email: 'patient2@example.com', role: 'patient', joined: '2024-07-18' },
    { id: 'usr_4', name: 'Dr. Ben Adams', email: 'drben.adams@skinwise.com', role: 'doctor', joined: '2024-07-15' },
    { id: 'usr_5', name: 'Dr. Olivia Chen', email: 'drolivia.chen@skinwise.com', role: 'doctor', joined: '2024-07-12' },
];

const mockDoctorsData = [
    { id: 'doc_1', name: 'Dr. Ben Adams', specialization: 'Pediatric Dermatology', joined: '2024-07-15', status: 'Verified' },
    { id: 'doc_2', name: 'Dr. Olivia Chen', specialization: 'Cosmetic Dermatology', joined: '2024-07-12', status: 'Verified' },
    { id: 'doc_3', name: 'Dr. Sarah Jenkins', specialization: 'General Dermatology', joined: '2024-07-21', status: 'Pending' },
    { id: 'doc_4', name: 'Dr. Emily Carter', specialization: 'General Dermatology', joined: '2024-07-19', status: 'Verified' },
];

const analyticsData = [
  { month: "January", users: 12 },
  { month: "February", users: 23 },
  { month: "March", users: 31 },
  { month: "April", users: 25 },
  { month: "May", users: 42 },
  { month: "June", users: 51 },
];

const chartConfig = {
  users: {
    label: "New Users",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

type User = typeof mockUsersData[number];
type Doctor = typeof mockDoctorsData[number];

export default function AdminDashboardPage() {
    const [users, setUsers] = useState(mockUsersData);
    const [doctors, setDoctors] = useState(mockDoctorsData);
    const [userSearch, setUserSearch] = useState("");
    const [doctorSearch, setDoctorSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | (Doctor & {email?: string, role?: string}) | null>(null);

    const handleApprove = (doctorId: string) => {
        setDoctors(prevDoctors =>
            prevDoctors.map(doc =>
                doc.id === doctorId ? { ...doc, status: 'Verified' } : doc
            )
        );
    };

    const handleReject = (doctorId: string) => {
        setDoctors(prevDoctors => prevDoctors.filter(doc => doc.id !== doctorId));
    };

    const handleDeleteUser = (userId: string) => {
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
    };

    const verifiedDoctorsCount = useMemo(() => doctors.filter(d => d.status === 'Verified').length, [doctors]);
    const pendingVerificationsCount = useMemo(() => doctors.filter(d => d.status === 'Pending').length, [doctors]);

    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            user.email.toLowerCase().includes(userSearch.toLowerCase())
        );
    }, [users, userSearch]);
    
    const filteredDoctors = useMemo(() => {
         return doctors.filter(doctor =>
            doctor.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            doctor.specialization.toLowerCase().includes(doctorSearch.toLowerCase())
        );
    }, [doctors, doctorSearch]);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Dashboard</h1>
                <p className="text-muted-foreground">Manage users, doctors, and system settings.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{users.length}</div>
                        <p className="text-xs text-muted-foreground">Total registered users on the platform.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Doctors</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{verifiedDoctorsCount}</div>
                        <p className="text-xs text-muted-foreground">Approved and verified doctors.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
                        <FileClock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingVerificationsCount}</div>
                        <p className="text-xs text-muted-foreground">Doctor applications awaiting review.</p>
                    </CardContent>
                </Card>
            </div>
            
             <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedUser(null)}>
                <div className="grid gap-8 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Doctor Management</CardTitle>
                            <CardDescription>Review and manage doctor profiles and verifications.</CardDescription>
                            <div className="relative pt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by name or specialization..." 
                                    className="pl-9"
                                    value={doctorSearch}
                                    onChange={(e) => setDoctorSearch(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="all">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="pending">Pending</TabsTrigger>
                                    <TabsTrigger value="verified">Verified</TabsTrigger>
                                </TabsList>
                                <TabsContent value="all">
                                    {renderDoctorTable(filteredDoctors)}
                                </TabsContent>
                                <TabsContent value="pending">
                                    {renderDoctorTable(filteredDoctors.filter(d => d.status === 'Pending'))}
                                </TabsContent>
                                <TabsContent value="verified">
                                    {renderDoctorTable(filteredDoctors.filter(d => d.status === 'Verified'))}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>Oversee all registered users on the platform.</CardDescription>
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
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="font-medium">{user.name}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === 'doctor' ? 'secondary' : 'outline'}>{user.role}</Badge>
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
                                                            This action cannot be undone. This will permanently delete this user's account and remove their data from our servers.
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
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                 <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>User Profile</DialogTitle>
                        <DialogDescription>
                            Details for {selectedUser?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedUser && (
                        <div className="space-y-4 pt-4">
                             <div className="flex items-center space-x-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={`https://placehold.co/100x100.png?text=${selectedUser.name.charAt(0)}`} data-ai-hint="user portrait" />
                                    <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-lg">{selectedUser.name}</h3>
                                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="font-medium text-muted-foreground">User ID:</span>
                                <span>{selectedUser.id}</span>

                                <span className="font-medium text-muted-foreground">Joined:</span>
                                <span>{selectedUser.joined}</span>

                                <span className="font-medium text-muted-foreground">Role:</span>
                                <span><Badge variant={'role' in selectedUser && selectedUser.role === 'doctor' ? 'secondary' : 'outline'}>{selectedUser.role}</Badge></span>

                                {'specialization' in selectedUser && (
                                    <>
                                        <span className="font-medium text-muted-foreground">Specialization:</span>
                                        <span>{selectedUser.specialization}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Platform Analytics</CardTitle>
                    <CardDescription>An overview of platform growth and activity.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <BarChart data={analyticsData} accessibilityLayer>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                          tickFormatter={(value) => value.slice(0, 3)}
                        />
                         <YAxis />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar dataKey="users" fill="var(--color-users)" radius={8} />
                      </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

        </div>
    );

    function renderDoctorTable(doctorsToRender: Doctor[]) {
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {doctorsToRender.length > 0 ? doctorsToRender.map(doctor => (
                    <TableRow key={doctor.id}>
                        <TableCell>
                            <div className="font-medium">{doctor.name}</div>
                            <div className="text-sm text-muted-foreground">{doctor.specialization}</div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={doctor.status === 'Verified' ? 'default' : 'secondary'}>{doctor.status}</Badge>
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
                                            <DropdownMenuItem onSelect={() => {
                                                const userRecord = users.find(u => u.name === doctor.name);
                                                const doctorDetails = { 
                                                    ...doctor,
                                                    email: userRecord?.email,
                                                    role: userRecord?.role,
                                                };
                                                setSelectedUser(doctorDetails);
                                             }}>
                                                <UserIcon className="mr-2 h-4 w-4" /> View Profile
                                            </DropdownMenuItem>
                                        </DialogTrigger>
                                        {doctor.status === 'Pending' && (
                                            <>
                                                <DropdownMenuItem onClick={() => handleApprove(doctor.id)}>
                                                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Approve
                                                </DropdownMenuItem>
                                                 <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 dark:text-red-500 focus:text-red-600 focus:dark:text-red-500">
                                                        <XCircle className="mr-2 h-4 w-4" /> Reject
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </>
                                        )}
                                        {doctor.status === 'Verified' && <DropdownMenuItem>Suspend</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                     <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will reject the verification request for {doctor.name}. They will be removed from the list.
                                        </Description>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleReject(doctor.id)} className="bg-destructive hover:bg-destructive/90">Reject</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                    </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                                No doctors found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        )
    }
}
