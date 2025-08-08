
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function DoctorProfilePage() {
    return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl">
             <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/doctor/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <div className="space-y-2 mb-8">
                 <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Doctor Profile & Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your professional profile and account settings.
                </p>
            </div>
             <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Professional Information</CardTitle>
                        <CardDescription>This information will be visible to patients.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" defaultValue="Dr. Alan Grant" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="specialization">Specialization</Label>
                            <Input id="specialization" defaultValue="General Dermatology" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bio">Professional Bio</Label>
                            <Textarea id="bio" placeholder="A short bio about your expertise and experience." defaultValue="An experienced dermatologist with over 15 years of practice, specializing in a wide range of skin conditions. Committed to providing compassionate and comprehensive care to all patients." />
                        </div>
                         <div className="flex items-center space-x-2 pt-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium text-muted-foreground">Your identity is verified.</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button>Save Profile</Button>
                    </CardFooter>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Account Settings</CardTitle>
                        <CardDescription>Manage your login and notification preferences.</CardDescription>
                    </CardHeader>
                     <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" defaultValue="dralan.grant@skinwise.com" disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input id="new-password" type="password" />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <Label htmlFor="notifications" className="flex flex-col space-y-1">
                                <span>Email Notifications</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Receive email notifications for new appointment requests.
                                </span>
                            </Label>
                            <Switch id="notifications" defaultChecked />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button>Update Settings</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

