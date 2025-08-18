
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertTriangle, Upload, XCircle, ShieldCheck, ShieldAlert, Loader2, BadgeHelp } from "lucide-react";
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
import { uploadFile } from "@/lib/actions";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type VerificationStatus = 'Verified' | 'Pending' | 'Not Verified';

export default function DoctorProfilePage() {
    const { user, userData, loading, forceReload } = useAuth();
    const { toast } = useToast();

    // Profile State
    const [name, setName] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [bio, setBio] = useState("");
    const [location, setLocation] = useState("");
    const [phone, setPhone] = useState("");
    
    // Settings State
    const [notifications, setNotifications] = useState(true);
    
    // Verification State
    const [signature, setSignature] = useState<string | null>(null);
    const [certificate, setCertificate] = useState<string | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('Not Verified');

    // Loading States
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isUploadingSignature, setIsUploadingSignature] = useState(false);
    const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);

    const signatureInputRef = useRef<HTMLInputElement>(null);
    const certificateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (userData) {
            setName(userData.displayName || '');
            setSpecialization(userData.specialization || 'General Dermatology');
            setBio(userData.bio || '');
            setLocation(userData.location || '');
            setPhone(userData.phone || '');
            setSignature(userData.signatureUrl || null);
            setCertificate(userData.certificateUrl || null);
            if (userData.verified) {
                setVerificationStatus('Verified');
            } else if (userData.verificationPending) {
                setVerificationStatus('Pending');
            } else {
                setVerificationStatus('Not Verified');
            }
        }
    }, [userData]);


    const handleProfileSave = async () => {
        if (!user) return;
        setIsSavingProfile(true);
        try {
            const updatedData = {
                displayName: name,
                specialization,
                bio,
                location,
                phone,
            };
            await updateDoc(doc(db, 'users', user.uid), updatedData);
            toast({
                title: "Profile Saved",
                description: "Your professional information has been updated.",
            });
            forceReload();
        } catch (error) {
            toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
        } finally {
            setIsSavingProfile(false);
        }
    };
    
    const handleSettingsSave = () => {
        // This is a mock for now as we don't have a field for it
        console.log("Saving settings:", { notifications });
        setIsSavingSettings(true);
        toast({
            title: "Settings Updated",
            description: "Your account settings have been saved.",
        });
        setTimeout(() => setIsSavingSettings(false), 1000);
    };

     const handleFileUpload = async (file: File, type: 'signature' | 'certificate') => {
        if (!user) return;
        const stateSetter = type === 'signature' ? setIsUploadingSignature : setIsUploadingCertificate;
        const urlField = type === 'signature' ? 'signatureUrl' : 'certificateUrl';
        const stateUrlSetter = type === 'signature' ? setSignature : setCertificate;
        
        stateSetter(true);

        const formData = new FormData();
        formData.append('file', file);
        const result = await uploadFile(formData);

        if (result.success && result.url) {
            try {
                await updateDoc(doc(db, 'users', user.uid), { [urlField]: result.url });
                stateUrlSetter(result.url);
                toast({ title: "Upload Successful", description: `Your ${type} has been updated.` });
                forceReload();
            } catch (error) {
                toast({ title: "Database Error", description: `Failed to save ${type} URL.`, variant: "destructive" });
            }
        } else {
            toast({ title: "Upload Failed", description: result.message || "Upload failed", variant: "destructive" });
        }
        stateSetter(false);
    };
    
    const handleRequestVerification = async () => {
        if (!certificate) {
            toast({
                title: "Certificate Required",
                description: "Please upload your medical certificate before requesting verification.",
                variant: "destructive",
            });
            return;
        }
        if (!user) return;
        
        try {
            await updateDoc(doc(db, 'users', user.uid), { verificationPending: true });
            setVerificationStatus('Pending');
            toast({
                title: "Verification Request Sent",
                description: "Your request has been submitted for admin review. This may take 2-3 business days.",
            });
            forceReload();
        } catch (error) {
             toast({ title: "Error", description: "Failed to submit verification request.", variant: "destructive" });
        }
    }
    
     if (loading) {
      return (
        <div className="container mx-auto p-4 md:p-8 flex justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )
    }

    if (!user || !userData) return null;
    
    const isProfileComplete = !!(userData.specialization && userData.location && userData.phone && userData.signatureUrl);

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

            {!isProfileComplete && verificationStatus !== 'Verified' && (
                <Alert className="mb-8">
                    <BadgeHelp className="h-4 w-4" />
                    <AlertTitle>Complete Your Profile!</AlertTitle>
                    <AlertDescription>
                       Please fill out all fields in your professional information, including your signature, to be eligible for verification.
                    </AlertDescription>
                </Alert>
            )}

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
                                    <Button variant="outline" onClick={() => signatureInputRef.current?.click()} disabled={isUploadingSignature}>
                                        {isUploadingSignature ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                        Upload Signature
                                    </Button>
                                )}
                                <Input ref={signatureInputRef} type="file" className="hidden" accept="image/png, image/jpeg" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'signature')} />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleProfileSave} disabled={isSavingProfile}>
                            {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Profile
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Verification Status</CardTitle>
                        <CardDescription>Complete verification to build trust with patients.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         {verificationStatus === 'Verified' && (
                             <div className="flex items-center space-x-2 p-4 bg-green-500/10 rounded-lg">
                                <ShieldCheck className="h-6 w-6 text-green-600" />
                                <div >
                                    <p className="font-semibold text-green-700 dark:text-green-400">Your Identity is Verified</p>
                                    <p className="text-sm text-muted-foreground">Your profile is visible to patients and you have full access.</p>
                                </div>
                            </div>
                        )}
                         {verificationStatus === 'Pending' && (
                             <div className="flex items-center space-x-2 p-4 bg-yellow-500/10 rounded-lg">
                                <ShieldAlert className="h-6 w-6 text-yellow-600" />
                                <div >
                                    <p className="font-semibold text-yellow-700 dark:text-yellow-400">Verification Pending</p>
                                    <p className="text-sm text-muted-foreground">Your request is under review by our admin team.</p>
                                </div>
                            </div>
                        )}
                        {verificationStatus === 'Not Verified' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="certificate">Medical Certificate</Label>
                                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                                        {certificate ? (
                                            <div className="relative inline-block">
                                                <Link href={certificate} target="_blank" className="text-primary underline font-medium">View Certificate</Link>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="relative -top-2 left-2 bg-background/50 hover:bg-background/80 rounded-full h-7 w-7"
                                                    onClick={() => setCertificate(null)}
                                                >
                                                    <XCircle className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="outline" onClick={() => certificateInputRef.current?.click()} disabled={isUploadingCertificate}>
                                                {isUploadingCertificate ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                                Upload Certificate
                                            </Button>
                                        )}
                                        <Input ref={certificateInputRef} type="file" className="hidden" accept="image/png, image/jpeg, application/pdf" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'certificate')} />
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-l-4 border-primary bg-secondary/50 rounded-lg">
                                    <div>
                                        <h3 className="font-semibold">Complete Your Verification</h3>
                                        <p className="text-sm text-muted-foreground">Upload your certificate and submit for review.</p>
                                    </div>
                                    <Button className="mt-4 sm:mt-0" onClick={handleRequestVerification} disabled={!certificate || !isProfileComplete}>Request Verification</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Account Settings</CardTitle>
                        <CardDescription>Manage your login and notification preferences.</CardDescription>
                    </CardHeader>
                     <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={user.email || ''} disabled />
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
                        <Button onClick={handleSettingsSave} disabled={isSavingSettings}>
                             {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Update Settings
                        </Button>
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
