
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Users, UserCheck, FileClock, Trash2, CheckCircle, XCircle } from "lucide-react";

const mockUsers = [
    { id: 'usr_1', name: 'Patient One', email: 'patient1@example.com', role: 'patient', joined: '2024-07-20' },
    { id: 'usr_2', name: 'Dr. Emily Carter', email: 'dremily.carter@skinwise.com', role: 'doctor', joined: '2024-07-19' },
    { id: 'usr_3', name: 'Patient Two', email: 'patient2@example.com', role: 'patient', joined: '2024-07-18' },
];

const mockDoctors = [
    { id: 'doc_1', name: 'Dr. Ben Adams', specialization: 'Pediatric Dermatology', joined: '2024-07-15', status: 'Verified' },
    { id: 'doc_2', name: 'Dr. Olivia Chen', specialization: 'Cosmetic Dermatology', joined: '2024-07-12', status: 'Verified' },
    { id: 'doc_3', name: 'Dr. Sarah Jenkins', specialization: 'General Dermatology', joined: '2024-07-21', status: 'Pending' },
];


export default function AdminDashboardPage() {
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
                        <div className="text-2xl font-bold">150</div>
                        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Doctors</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">15</div>
                        <p className="text-xs text-muted-foreground">+3 this month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
                        <FileClock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1</div>
                        <p className="text-xs text-muted-foreground">Action required</p>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid gap-8 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Doctor Management</CardTitle>
                        <CardDescription>Review and manage doctor profiles and verifications.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Doctor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockDoctors.map(doctor => (
                                <TableRow key={doctor.id}>
                                    <TableCell>
                                        <div className="font-medium">{doctor.name}</div>
                                        <div className="text-sm text-muted-foreground">{doctor.specialization}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={doctor.status === 'Verified' ? 'default' : 'secondary'}>{doctor.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {doctor.status === 'Pending' ? (
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="outline" className="text-red-600 border-red-600/50 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20">
                                                    <XCircle className="mr-1 h-4 w-4" /> Reject
                                                </Button>
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600 dark:text-black">
                                                    <CheckCircle className="mr-1 h-4 w-4" /> Approve
                                                </Button>
                                            </div>
                                        ) : (
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>View Profile</DropdownMenuItem>
                                                    <DropdownMenuItem>Suspend</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>Oversee all registered users on the platform.</CardDescription>
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
                                {mockUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="font-medium">{user.name}</div>
                                        <div className="text-sm text-muted-foreground">{user.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'doctor' ? 'secondary' : 'outline'}>{user.role}</Badge>
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
                                                <DropdownMenuItem>View Profile</DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600 dark:text-red-500 focus:text-red-600 focus:dark:text-red-500">
                                                    <Trash2 className="mr-2 h-4 w-4" />Delete User
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
        </div>
    );
}
