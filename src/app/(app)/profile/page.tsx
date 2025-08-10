
"use client"

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowLeft, Loader2, Upload } from "lucide-react";
import Link from "next/link";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadFile } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";


export default function ProfilePage() {
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        const result = await uploadFile(formData);

        setIsUploading(false);
        if (result.success && result.url) {
            setProfileImage(result.url);
            toast({
                title: "Image Uploaded",
                description: "Your profile picture has been updated.",
            });
        } else {
            toast({
                title: "Upload Failed",
                description: result.message || "An error occurred during upload.",
                variant: "destructive",
            });
        }
    };


    return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl">
            <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <div className="space-y-2 mb-8">
                 <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Profile & Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your account details and preferences.
                </p>
            </div>
           
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your personal details here.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center space-x-6">
                            <div className="relative">
                                <Avatar className="h-24 w-24">
                                    <AvatarImage src={profileImage || "https://placehold.co/100x100.png?text=P"} alt="Patient" />
                                    <AvatarFallback>P</AvatarFallback>
                                </Avatar>
                                <Button size="icon" variant="outline" className="absolute bottom-0 right-0 rounded-full h-8 w-8" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    <span className="sr-only">Upload Profile Picture</span>
                                </Button>
                                <Input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold">Patient</h3>
                                <p className="text-muted-foreground">patient@example.com</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" defaultValue="Patient" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" defaultValue="patient@example.com" disabled />
                            <p className="text-xs text-muted-foreground">Your email address is used for logging in and cannot be changed.</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button>Save Changes</Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>For your security, we recommend using a strong password.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input id="current-password" type="password" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input id="new-password" type="password" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input id="confirm-password" type="password" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button>Update Password</Button>
                    </CardFooter>
                </Card>
                
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle />
                            Danger Zone
                        </CardTitle>
                        <CardDescription>These actions are irreversible. Please be certain.</CardDescription>
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
    )
}
