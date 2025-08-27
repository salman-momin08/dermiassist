
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
import { uploadFile, deleteFile } from "@/lib/actions";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "firebase/auth";


type VerificationStatus = 'Verified' | 'Pending' | 'Not Verified';

// Combined state for the entire form to make it easier to manage
type ProfileFormState = {
    displayName: string;
    specialization: string;
    bio: string;
    location: string;
    phone: string;
    signatureUrl: string | null;
    signaturePublicId: string | null;
    newSignatureFile: File | null;
};

export default function DoctorProfilePage() {
    const { user, userData, loading, forceReload } = useAuth();
    const { toast } = useToast();

    // Single state object for profile form
    const [formState, setFormState] = useState<ProfileFormState>({
        displayName: "",
        specialization: "General Dermatology",
        bio: "",
        location: "",
        phone: "",
        signatureUrl: null,
        signaturePublicId: null,
        newSignatureFile: null,
    });
    
    // State for verification section
    const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
    const [newCertificateFile, setNewCertificateFile] = useState<File | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('Not Verified');
    
    // State for account settings
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Loading states
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const signatureInputRef = useRef<HTMLInputElement>(null);
    const certificateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (userData) {
            setFormState({
                displayName: userData.displayName || '',
                specialization: userData.specialization || 'General Dermatology',
                bio: userData.bio || '',
                location: userData.location || '',
                phone: userData.phone || '',
                signatureUrl: userData.signatureUrl || null,
                signaturePublicId: userData.signaturePublicId || null,
                newSignatureFile: null, // Always reset on load
            });
            setCertificateUrl(userData.certificateUrl || null);
            
            if (userData.verified) {
                setVerificationStatus('Verified');
            } else if (userData.verificationPending) {
                setVerificationStatus('Pending');
            } else {
                setVerificationStatus('Not Verified');
            }
        }
    }, [userData]);

    const handleProfileInputChange = (field: keyof ProfileFormState, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
             // Store the file object and the preview URL
            handleProfileInputChange('newSignatureFile', file);
            handleProfileInputChange('signatureUrl', reader.result as string);
        };
        reader.readAsDataURL(file);
    };
    
    const handleCertificateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewCertificateFile(file);
            setCertificateUrl(reader.result as string); // For preview
        };
        reader.readAsDataURL(file);
    };

    const handleProfileSave = async () => {
        if (!user) return;
        setIsSavingProfile(true);

        const dataToSave = { ...formState };
        const oldSignaturePublicId = userData?.signaturePublicId;

        try {
             // 1. Handle signature upload if a new one is staged
            if (dataToSave.newSignatureFile) {
                // If an old signature existed, delete it from Cloudinary
                if (oldSignaturePublicId) {
                    await deleteFile(oldSignaturePublicId);
                }
                const formData = new FormData();
                formData.append('file', dataToSave.newSignatureFile);
                const uploadResult = await uploadFile(formData);
                if (!uploadResult.success) throw new Error(uploadResult.message || "Signature upload failed");
                dataToSave.signatureUrl = uploadResult.url!;
                dataToSave.signaturePublicId = uploadResult.publicId!;
            }
            
            // 2. Prepare data for Firestore
            const firestoreUpdateData = {
                displayName: dataToSave.displayName,
                specialization: dataToSave.specialization,
                bio: dataToSave.bio,
                location: dataToSave.location,
                phone: dataToSave.phone,
                signatureUrl: dataToSave.signatureUrl,
                signaturePublicId: dataToSave.signaturePublicId,
            };

            // 3. Save all data to Firestore
            await updateDoc(doc(db, 'users', user.uid), firestoreUpdateData);

            toast({
                title: "Profile Saved",
                description: "Your professional information has been updated.",
            });
            forceReload();
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
             toast({ title: "Error Saving Profile", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSavingProfile(false);
        }
    };
    
    const handleRequestVerification = async () => {
        if (!newCertificateFile || !user) {
            toast({ title: "Certificate Required", description: "Please select your medical certificate file.", variant: "destructive" });
            return;
        }

        setIsSubmittingVerification(true);
        try {
            // Upload certificate
            const formData = new FormData();
            formData.append('file', newCertificateFile);
            const uploadResult = await uploadFile(formData);

            if (!uploadResult.success) throw new Error(uploadResult.message || "Certificate upload failed");
            
            // Update Firestore with new certificate URL and pending status
            await updateDoc(doc(db, 'users', user.uid), { 
                certificateUrl: uploadResult.url,
                verificationPending: true 
            });

            setVerificationStatus('Pending');
            toast({
                title: "Verification Request Sent",
                description: "Your request has been submitted for admin review.",
            });
            forceReload(); // Re-fetch user data to get the latest state
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Verification Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSubmittingVerification(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!user || !user.email) return;

        if (newPassword !== confirmPassword) {
            toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
            return;
        }
        if (newPassword.length < 8) {
            toast({ title: "Error", description: "New password must be at least 8 characters long.", variant: "destructive" });
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);

            toast({ title: "Success", description: "Your password has been updated." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            let description = "An unexpected error occurred.";
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                description = "The current password you entered is incorrect.";
            }
            toast({ title: "Password Change Failed", description, variant: "destructive"});
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleForgotPassword = () => {
        if (!user?.email) return;
        sendPasswordResetEmail(auth, user.email)
            .then(() => {
                toast({
                    title: "Password Reset Email Sent",
                    description: `An email has been sent to ${user.email} with instructions.`
                });
            })
            .catch(() => {
                toast({
                    title: "Error",
                    description: "Could not send password reset email.",
                    variant: "destructive"
                });
            });
    };
    
     if (loading) {
      return (
        <div className="container mx-auto p-4 md:p-8 flex justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )
    }

    if (!user || !userData) return null;
    
    const isProfileComplete = !!(formState.displayName && formState.specialization && formState.location && formState.phone && formState.signatureUrl);

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
                                <Input id="name" value={formState.displayName} onChange={(e) => handleProfileInputChange('displayName', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="specialization">Specialization</Label>
                                <Input id="specialization" value={formState.specialization} onChange={(e) => handleProfileInputChange('specialization', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bio">Professional Bio</Label>
                            <Textarea id="bio" placeholder="A short bio about your expertise and experience." value={formState.bio} onChange={(e) => handleProfileInputChange('bio', e.target.value)} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="location">Clinic Location</Label>
                                <Input id="location" value={formState.location} onChange={(e) => handleProfileInputChange('location', e.target.value)} placeholder="e.g. 123 Health St, Medtown" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" value={formState.phone} onChange={(e) => handleProfileInputChange('phone', e.target.value)} placeholder="+1 (555) 123-4567"/>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Digital Signature</Label>
                            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                                {formState.signatureUrl ? (
                                     <div className="relative inline-block">
                                        <Image
                                            src={formState.signatureUrl}
                                            alt="Doctor's signature"
                                            width={200}
                                            height={75}
                                            className="mx-auto rounded-lg bg-white"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-0 right-0 bg-background/50 hover:bg-background/80 rounded-full h-7 w-7"
                                            onClick={() => {
                                                handleProfileInputChange('signatureUrl', null);
                                                handleProfileInputChange('newSignatureFile', null);
                                            }}
                                        >
                                            <XCircle className="h-5 w-5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" onClick={() => signatureInputRef.current?.click()}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload Signature
                                    </Button>
                                )}
                                <Input ref={signatureInputRef} type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleSignatureFileChange} />
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
                                        {certificateUrl && !newCertificateFile && (
                                             <div className="relative inline-block">
                                                <Link href={certificateUrl} target="_blank" className="text-primary underline font-medium">View Uploaded Certificate</Link>
                                            </div>
                                        )}
                                        {newCertificateFile && certificateUrl && (
                                            <div className="relative inline-block">
                                                <Image src={certificateUrl} alt="Certificate preview" width={200} height={140} className="mx-auto" />
                                            </div>
                                        )}
                                        {!certificateUrl && (
                                            <Button variant="outline" onClick={() => certificateInputRef.current?.click()} disabled={isSubmittingVerification}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Upload Certificate
                                            </Button>
                                        )}
                                        <Input ref={certificateInputRef} type="file" className="hidden" accept="image/png, image/jpeg, application/pdf" onChange={handleCertificateFileChange} />
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-l-4 border-primary bg-secondary/50 rounded-lg">
                                    <div>
                                        <h3 className="font-semibold">Complete Your Verification</h3>
                                        <p className="text-sm text-muted-foreground">Upload your certificate and submit for review.</p>
                                    </div>
                                    <Button className="mt-4 sm:mt-0" onClick={handleRequestVerification} disabled={!newCertificateFile || isSubmittingVerification || !isProfileComplete}>
                                        {isSubmittingVerification && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Submit for Verification
                                    </Button>
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
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input id="current-password" type="password" placeholder="Enter your current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input id="new-password" type="password" placeholder="Enter a new strong password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input id="confirm-password" type="password" placeholder="Confirm your new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        </div>
                        <div className="text-right">
                             <Button variant="link" className="text-sm p-0 h-auto" onClick={handleForgotPassword}>
                                Forgot Password?
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handlePasswordChange} disabled={isUpdatingPassword}>
                             {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Update Password
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

    