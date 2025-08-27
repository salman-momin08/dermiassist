
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
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";

const analyticsData: any[] = [];

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
    [key: string]: any; // Allow other properties
};

type Doctor = User & {
    specialization: string;
    status: 'Verified' | 'Pending' | 'Not Verified';
};


export default function AdminDashboardPage() {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userSearch, setUserSearch] = useState("");
    const [doctorSearch, setDoctorSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                name: doc.data().displayName,
                joined: doc.data().createdAt ? new Date(doc.data().createdAt).toLocaleDateString() : 'N/A',
            })) as User[];
            setAllUsers(usersData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (doctorId: string) => {
        const userDocRef = doc(db, 'users', doctorId);
        try {
            await updateDoc(userDocRef, {
                verified: true,
                verificationPending: false
            });
            toast({ title: "Doctor Approved", description: "The doctor has been verified and can now access all features." });
        } catch (error) {
            toast({ title: "Error", description: "Could not approve the doctor.", variant: "destructive"});
        }
    };

    const handleReject = async (doctorId: string) => {
        const userDocRef = doc(db, 'users', doctorId);
        try {
            await updateDoc(userDocRef, {
                verificationPending: false,
                certificateUrl: null, // Optionally clear the certificate URL
            });
            toast({ title: "Doctor Rejected", description: "The verification request has been rejected." });
        } catch(error) {
            toast({ title: "Error", description: "Could not reject the doctor.", variant: "destructive"});
        }
    };

    const handleDeleteUser = async (userId: string) => {
        // Note: This only deletes the Firestore record. For a full deletion, you'd also need a backend function to delete the Firebase Auth user.
        try {
            await deleteDoc(doc(db, "users", userId));
            toast({ title: "User Deleted", description: "The user's record has been removed from Firestore."});
        } catch (error) {
            toast({ title: "Error", description: "Could not delete the user.", variant: "destructive"});
        }
    };
    
    const { patientUsers, doctorUsers, verifiedDoctorsCount, pendingVerificationsCount } = useMemo(() => {
        const patients = allUsers.filter(user => user.role === 'patient');
        const doctors = allUsers
            .filter(user => user.role === 'doctor')
            .map(docUser => ({
                ...docUser,
                status: docUser.verified ? 'Verified' : docUser.verificationPending ? 'Pending' : 'Not Verified'
            })) as Doctor[];
        
        const verifiedCount = doctors.filter(d => d.status === 'Verified').length;
        const pendingCount = doctors.filter(d => d.status === 'Pending').length;

        return { patientUsers: patients, doctorUsers: doctors, verifiedDoctorsCount: verifiedCount, pendingVerificationsCount: pendingCount };
    }, [allUsers]);

    const filteredUsers = useMemo(() => {
        return patientUsers.filter(user =>
            user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            user.email.toLowerCase().includes(userSearch.toLowerCase())
        );
    }, [patientUsers, userSearch]);
    
    const filteredDoctors = useMemo(() => {
         return doctorUsers.filter(doctor =>
            doctor.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            (doctor.specialization && doctor.specialization.toLowerCase().includes(doctorSearch.toLowerCase()))
        );
    }, [doctorUsers, doctorSearch]);

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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
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
                            <Tabs defaultValue="pending">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="all">All ({filteredDoctors.length})</TabsTrigger>
                                    <TabsTrigger value="pending">Pending ({filteredDoctors.filter(d => d.status === 'Pending').length})</TabsTrigger>
                                    <TabsTrigger value="verified">Verified ({filteredDoctors.filter(d => d.status === 'Verified').length})</TabsTrigger>
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
                            <CardTitle>Patient Management</CardTitle>
                            <CardDescription>Oversee all registered patient users on the platform.</CardDescription>
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
                                        <TableHead>Joined Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length > 0 ? filteredUsers.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="font-medium">{user.name}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
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
                                                            This action cannot be undone. This will permanently delete this user's record from Firestore.
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
                                    )) : (
                                         <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
                                                No patients found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
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
                                    <AvatarImage src={selectedUser.photoURL || `https://placehold.co/100x100.png?text=${selectedUser.name.charAt(0)}`} data-ai-hint="user portrait" />
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
                                {renderDetail("Blood Group", selectedUser.bloodGroup)}
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
                                    {renderDetail("Medical ID", selectedUser.medicalId)}
                                    {renderDetail("Verification",  <Badge variant={selectedUser.verified ? 'default' : selectedUser.verificationPending ? 'secondary' : 'destructive'}>{selectedUser.verified ? 'Verified' : selectedUser.verificationPending ? 'Pending' : 'Not Verified'}</Badge>)}
                                    {selectedUser.certificateUrl && renderDetail("Certificate", <Link href={selectedUser.certificateUrl} target="_blank" className="text-primary hover:underline">View Document</Link>)}
                                </div>
                                </>
                            )}
                            <Separator />
                             <div className="space-y-3 text-sm">
                                <h4 className="font-semibold text-base">Account & Preferences</h4>
                                {renderDetail("Subscription", selectedUser.subscriptionPlan)}
                                {renderDetail("Data Sharing", selectedUser.allowDataSharing ? "Allowed" : "Disallowed")}
                                {renderDetail("Notifications", selectedUser.emailNotifications ? "Enabled" : "Disabled")}
                            </div>
                        </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Platform Analytics</CardTitle>
                    <CardDescription>An overview of platform growth and activity.</CardDescription>
                </CardHeader>
                <CardContent>
                    {analyticsData.length > 0 ? (
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
                    ) : (
                        <div className="flex h-[300px] w-full items-center justify-center text-muted-foreground">
                            No analytics data available.
                        </div>
                    )}
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
                            <Badge variant={doctor.status === 'Verified' ? 'default' : doctor.status === 'Pending' ? 'secondary' : 'destructive'}>{doctor.status}</Badge>
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
                                            <DropdownMenuItem onSelect={() => setSelectedUser(doctor)}>
                                                <UserIcon className="mr-2 h-4 w-4" /> View Profile
                                            </DropdownMenuItem>
                                        </DialogTrigger>
                                        {doctor.status === 'Pending' && (
                                            <>
                                                <DropdownMenuItem asChild>
                                                    <Link href={doctor.certificateUrl || '#'} target="_blank" className="cursor-pointer">
                                                        View Certificate
                                                    </Link>
                                                </DropdownMenuItem>
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
                                            This will reject the verification request for Dr. {doctor.name}. They will need to re-upload their certificate to apply again.
                                        </AlertDialogDescription>
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

    