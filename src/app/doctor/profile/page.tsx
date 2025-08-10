
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, AlertTriangle, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
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
import Image from "next/image";

export default function DoctorProfilePage() {
    const { toast } = useToast();
    const [name, setName] = useState("Dr. Alan Grant");
    const [specialization, setSpecialization] = useState("General Dermatology");
    const [bio, setBio] = useState("An experienced dermatologist with over 15 years of practice, specializing in a wide range of skin conditions. Committed to providing compassionate and comprehensive care to all patients.");
    const [notifications, setNotifications] = useState(true);
    const [location, setLocation] = useState("123 Skin Care Ave, Dermville, 12345");
    const [phone, setPhone] = useState("+1 (555) 987-6543");
    const [signature, setSignature] = useState<string | null>("https://placehold.co/150x50.png?text=Dr.+Alan+Grant");
    const signatureInputRef = useRef<HTMLInputElement>(null);

    const handleProfileSave = () => {
        // In a real app, you would make an API call here.
        console.log("Saving profile:", { name, specialization, bio, location, phone, signature });
        toast({
            title: "Profile Saved",
            description: "Your professional information has been updated.",
        });
    };
    
    const handleSettingsSave = () => {
        // In a real app, you would make an API call here.
        console.log("Saving settings:", { notifications });
        toast({
            title: "Settings Updated",
            description: "Your account settings have been saved.",
        });
    };

     const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSignature(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };


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
                        <CardDescription>This information will be visible to patients and used in appointment letters.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="specialization">Specialization</Label>
                                <Input id="specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bio">Professional Bio</Label>
                            <Textarea id="bio" placeholder="A short bio about your expertise and experience." value={bio} onChange={(e) => setBio(e.target.value)} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="location">Clinic Location</Label>
                                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. 123 Health St, Medtown" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567"/>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Digital Signature</Label>
                            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                                {signature ? (
                                     <div className="relative inline-block">
                                        <Image
                                            src={signature}
                                            alt="Doctor's signature"
                                            width={200}
                                            height={75}
                                            className="mx-auto rounded-lg bg-white"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-0 right-0 bg-background/50 hover:bg-background/80 rounded-full h-7 w-7"
                                            onClick={() => setSignature(null)}
                                        >
                                            <XCircle className="h-5 w-5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2 cursor-pointer" onClick={() => signatureInputRef.current?.click()}>
                                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">
                                            Upload your signature image (PNG with transparent background is best)
                                        </p>
                                        <Input
                                            ref={signatureInputRef}
                                            id="signature-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/png, image/jpeg"
                                            onChange={handleSignatureUpload}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                         <div className="flex items-center space-x-2 pt-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium text-muted-foreground">Your identity is verified.</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleProfileSave}>Save Profile</Button>
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
                            <Label htmlFor="new-password">Change Password</Label>
                            <Input id="new-password" type="password" placeholder="Enter new password" />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <Label htmlFor="notifications" className="flex flex-col space-y-1">
                                <span>Email Notifications</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Receive email notifications for new appointment requests.
                                </span>
                            </Label>
                            <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSettingsSave}>Update Settings</Button>
                    </CardFooter>
                </Card>

                 <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle />
                            Danger Zone
                        </CardTitle>
                        <CardDescription>This action is irreversible. Please be certain.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Delete Your Account</h3>
                                <p className="text-sm text-muted-foreground">Permanently remove your account and all of your data.</p>
                            </div>
                           <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Delete Account</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90">Delete Account</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    