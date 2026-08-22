"use client"

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowLeft, Loader2, Upload, CalendarIcon, Lock, Trash2, X, User } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadFile, deleteFile } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { indianStates } from "@/lib/indian-states";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// This will hold all form data, including image info
type ProfileFormState = {
    displayName: string;
    phone: string;
    dob?: Date;
    gender: string;
    bloodGroup: string;
    state: string;
    city: string;
    otherState: string;
    otherCity: string;
    allowDataSharing: boolean;
    emailNotifications: boolean;
    photoURL: string | null;
    photoPublicId: string | null;
    // For pending uploads
    newImageFile: File | null;
};


export default function ProfilePage() {
    const { user, userData, loading, forceReload } = useAuth();
    const { toast } = useToast();

    // Single state object for the form
    const [formState, setFormState] = useState<ProfileFormState>({
        displayName: '',
        phone: '',
        dob: undefined,
        gender: '',
        bloodGroup: '',
        state: '',
        city: '',
        otherState: '',
        otherCity: '',
        allowDataSharing: true,
        emailNotifications: true,
        photoURL: null,
        photoPublicId: null,
        newImageFile: null,
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string>("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [deleteConfirmName, setDeleteConfirmName] = useState("");
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    useEffect(() => {
        if (userData) {
            const userDob = userData.dob ? new Date(userData.dob) : undefined;
            if (userDob) setCalendarMonth(userDob);

            const userState = userData.state || '';
            const isKnownState = Object.keys(indianStates).includes(userState);
            const userCity = userData.city || '';
            const isKnownCity = userState && isKnownState && indianStates[userState as keyof typeof indianStates]?.includes(userCity);

            setFormState({
                displayName: userData.displayName || '',
                phone: userData.phone || userData.mobile || '',
                dob: userDob,
                gender: userData.gender || '',
                bloodGroup: userData.blood_group || '',
                state: isKnownState ? userState : (userState ? 'Other' : ''),
                city: isKnownCity ? userCity : (userCity ? 'Other' : ''),
                otherState: isKnownState ? '' : userState,
                otherCity: isKnownCity ? '' : userCity,
                allowDataSharing: userData.allow_data_sharing !== false,
                emailNotifications: userData.email_notifications !== false,
                photoURL: userData.photo_url || null,
                photoPublicId: userData.photo_public_id || null,
                newImageFile: null,
            });
        }
    }, [userData]);

    const handleInputChange = (field: keyof ProfileFormState, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setImageToCrop(reader.result as string);
            setIsCropDialogOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedBlob: Blob) => {
        const file = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
        setFormState(prev => ({
            ...prev,
            newImageFile: file,
            photoURL: URL.createObjectURL(croppedBlob),
        }));
        setIsCropDialogOpen(false);
    };

    const handleDeleteImage = () => {
        // Clear the image fields in the state
        setFormState(prev => ({
            ...prev,
            photoURL: null,
            newImageFile: null, // Cancel any pending upload
        }));
    };

    const handleSaveChanges = async () => {
        if (!user || !formState.displayName.trim()) {
            toast({
                title: "Validation Error",
                description: "Display name is required.",
                variant: "destructive"
            });
            return;
        }

        const supabase = createClient();
        setIsSaving(true);

        const finalFormState = { ...formState };
        const oldPublicId = userData?.photo_public_id;

        try {
            // 1. Handle image deletion
            if (oldPublicId && !finalFormState.photoURL) {
                await deleteFile(oldPublicId);
                finalFormState.photoPublicId = null;
            }

            // 2. Handle image upload
            if (finalFormState.newImageFile) {
                if (oldPublicId) {
                    await deleteFile(oldPublicId);
                }

                const formData = new FormData();
                formData.append('file', finalFormState.newImageFile);
                const result = await uploadFile(formData);

                if (result.success && result.url && result.publicId) {
                    finalFormState.photoURL = result.url;
                    finalFormState.photoPublicId = result.publicId;
                } else {
                    throw new Error(result.message || 'Image upload failed.');
                }
            }

            // 3. Prepare data for Supabase update
            const profileData = {
                display_name: finalFormState.displayName,
                phone: finalFormState.phone,
                dob: finalFormState.dob ? finalFormState.dob.toISOString() : null,
                gender: finalFormState.gender,
                blood_group: finalFormState.bloodGroup,
                state: finalFormState.state === 'Other' ? finalFormState.otherState.trim() : finalFormState.state,
                city: finalFormState.city === 'Other' ? finalFormState.otherCity.trim() : finalFormState.city,
                allow_data_sharing: finalFormState.allowDataSharing,
                email_notifications: finalFormState.emailNotifications,
                photo_url: finalFormState.photoURL,
                photo_public_id: finalFormState.photoPublicId,
            };

            // 4. Update Supabase profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update(profileData)
                .eq('id', user.id);

            if (profileError) {
                throw profileError;
            }

            // 5. Update Supabase Auth metadata as well
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    display_name: finalFormState.displayName,
                    photo_url: finalFormState.photoURL,
                }
            });

            if (authError) {
                console.error("Auth metadata update error:", authError);
                // Don't throw here, auth metadata is optional
            }

            // 6. Update local state with final values and clear pending upload
            setFormState(prev => ({
                ...prev,
                photoURL: finalFormState.photoURL,
                photoPublicId: finalFormState.photoPublicId,
                newImageFile: null, // Clear the pending file
            }));

            toast({ title: "Profile Updated", description: "Your information has been successfully saved." });
            forceReload();
        } catch (error: any) {
            console.error("Profile update error:", error);
            const errorMessage = error?.message || error?.error_description || error?.hint || "Could not update your profile. Please try again.";
            toast({
                title: "Error Saving Profile",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    }

    const handlePasswordChange = async () => {
        if (!user || !user.email) return;
        const supabase = createClient();

        if (confirmPassword !== newPassword) {
            toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
            return;
        }

        if (newPassword.length < 8) {
            toast({ title: "Error", description: "New password must be at least 8 characters long.", variant: "destructive" });
            return;
        }

        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

        if (!hasUpperCase || !hasNumber || !hasSpecialChar) {
            toast({
                title: "Weak Password",
                description: "Password must contain at least one uppercase letter, one number, and one special character.",
                variant: "destructive"
            });
            return;
        }

        setIsUpdatingPassword(true);

        try {
            // Re-authenticate by signing in again
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (authError) throw authError;

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            toast({ title: "Success", description: "Your password has been updated." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

        } catch (error: any) {
            console.error("Password update failed:", error);
            toast({ title: "Password Change Failed", description: error.message || "Could not update password.", variant: "destructive" });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!user || !user.email) return;
        const supabase = createClient();

        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) {
            console.error("Forgot password error:", error);
            toast({
                title: "Error",
                description: "Could not send password reset email. Please try again.",
                variant: "destructive"
            });
        } else {
            toast({
                title: "Password Reset Email Sent",
                description: `An email has been sent to ${user.email} with instructions to reset your password.`
            });
        }
    }

    const handleDeleteAccount = async () => {
        if (!user) return
        const supabase = createClient()

        try {
            // Delete user profile from database
            const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id)

            if (profileError) throw profileError

            // Sign out the user
            await supabase.auth.signOut()

            toast({
                title: "Account Deleted",
                description: "Your account has been permanently deleted.",
            })

            // Redirect to home page
            window.location.href = '/'
        } catch (error: any) {
            console.error("Delete account error:", error)
            toast({
                title: "Error Deleting Account",
                description: error.message || "Could not delete your account.",
                variant: "destructive"
            })
        }
    }

    if (!user) return null;

    return (
        <>
            <ImageCropDialog
                open={isCropDialogOpen}
                onOpenChange={setIsCropDialogOpen}
                imageSrc={imageToCrop}
                onCropComplete={handleCropComplete}
            />
            <div className="container mx-auto p-4 md:p-8 max-w-4xl">
                <div className="space-y-2 mb-8">
                    <h1 className="text-3xl font-bold tracking-tight font-headline">
                        Profile & Settings
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your account details and preferences.
                    </p>
                </div>

                <div className="space-y-6">

                    {/* Row 1: Personal Information - full width */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>Update your personal details here.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center space-x-6">
                                <div className="relative">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Avatar className="h-24 w-24 cursor-pointer">
                                                <AvatarImage src={formState.photoURL || `https://placehold.co/100x100.png?text=${formState.displayName.charAt(0)}`} alt={formState.displayName} data-ai-hint="person portrait" />
                                                <AvatarFallback>{formState.displayName.charAt(0) || <User />}</AvatarFallback>
                                            </Avatar>
                                        </DialogTrigger>
                                        <DialogContent className="w-auto bg-transparent border-none shadow-none flex items-center justify-center">
                                            <DialogHeader className="sr-only">
                                                <DialogTitle>Profile Picture</DialogTitle>
                                                <DialogDescription>A larger view of your current profile picture.</DialogDescription>
                                            </DialogHeader>
                                            <div className="relative">
                                                <Avatar className="h-64 w-64 border-4 border-background shadow-lg">
                                                    <AvatarImage src={formState.photoURL || `https://placehold.co/256x256.png`} alt={formState.displayName} className="object-cover" data-ai-hint="person portrait" />
                                                    <AvatarFallback><User className="w-32 h-32" /></AvatarFallback>
                                                </Avatar>
                                                {formState.photoURL && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="destructive" className="absolute bottom-4 right-4 rounded-full h-10 w-10">
                                                                <Trash2 className="h-5 w-5" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Profile Picture?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will remove your profile picture. This action will be saved when you click &quot;Save All Changes&quot;.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <DialogClose asChild>
                                                                    <AlertDialogAction onClick={handleDeleteImage} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                                </DialogClose>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    <div className="absolute bottom-0 right-0 flex gap-1">
                                        <Button size="icon" variant="outline" className="rounded-full h-8 w-8" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                                            <Upload className="h-4 w-4" />
                                            <span className="sr-only">Upload Profile Picture</span>
                                        </Button>
                                    </div>
                                    <Input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold">{formState.displayName}</h3>
                                    <p className="text-muted-foreground">{user.email}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" value={formState.displayName} onChange={(e) => handleInputChange('displayName', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input id="phone" value={formState.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="Your phone number" />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="dob">Date of Birth</Label>
                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formState.dob && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formState.dob ? format(formState.dob, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formState.dob}
                                                onSelect={(date) => { handleInputChange('dob', date); setIsCalendarOpen(false); }}
                                                month={calendarMonth}
                                                onMonthChange={setCalendarMonth}
                                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                                initialFocus
                                                captionLayout="dropdown"
                                                fromYear={1920}
                                                toYear={new Date().getFullYear()}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">Gender</Label>
                                    <Select value={formState.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                                        <SelectTrigger id="gender"><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                            <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="blood-group">Blood Group</Label>
                                    <Select value={formState.bloodGroup} onValueChange={(value) => handleInputChange('bloodGroup', value)}>
                                        <SelectTrigger id="blood-group"><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                                                <SelectItem key={group} value={group}>{group}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="state">State</Label>
                                    <Select value={formState.state} onValueChange={(value) => { handleInputChange('state', value); handleInputChange('city', ''); handleInputChange('otherState', ''); handleInputChange('otherCity', ''); }}>
                                        <SelectTrigger id="state"><SelectValue placeholder="Select state..." /></SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(indianStates).map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formState.state === 'Other' ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="other-state">Please specify your state</Label>
                                        <Input id="other-state" value={formState.otherState} onChange={(e) => handleInputChange('otherState', e.target.value)} />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor="city">City</Label>
                                        <Select value={formState.city} onValueChange={(value) => { handleInputChange('city', value); handleInputChange('otherCity', ''); }} disabled={!formState.state}>
                                            <SelectTrigger id="city"><SelectValue placeholder="Select city..." /></SelectTrigger>
                                            <SelectContent>
                                                {formState.state && indianStates[formState.state as keyof typeof indianStates]?.filter(c => c !== 'Other').map(c => (
                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            {formState.state !== 'Other' && formState.city === 'Other' && (
                                <div className="space-y-2">
                                    <Label htmlFor="other-city">Please specify your city</Label>
                                    <Input id="other-city" value={formState.otherCity} onChange={(e) => handleInputChange('otherCity', e.target.value)} />
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Row 2: Account Security + Settings & Privacy - side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Account Security</CardTitle>
                                <CardDescription>Manage your account security settings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
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

                        <Card>
                            <CardHeader>
                                <CardTitle>Settings &amp; Privacy</CardTitle>
                                <CardDescription>Manage your notification and data sharing preferences.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="email-notifications">Email Notifications</Label>
                                        <p className="text-xs text-muted-foreground">Receive emails about appointments and platform updates.</p>
                                    </div>
                                    <Switch id="email-notifications" checked={formState.emailNotifications} onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)} />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="data-sharing">Share Data with Doctors</Label>
                                        <p className="text-xs text-muted-foreground">Allow your analysis reports to be shared with doctors during consultations.</p>
                                    </div>
                                    <Switch id="data-sharing" checked={formState.allowDataSharing} onCheckedChange={(checked) => handleInputChange('allowDataSharing', checked)} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 3: Subscription & Billing - full width */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription &amp; Billing</CardTitle>
                            <CardDescription>Manage your plan and view payment history.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-semibold">Current Plan</Label>
                                    <p className="text-2xl font-bold">{userData?.subscription_plan || 'Free'}</p>
                                </div>
                                <Button variant="outline" asChild>
                                    <Link href="/subscription">Change Plan</Link>
                                </Button>
                            </div>
                            <div>
                                <Label className="text-lg font-semibold flex items-center gap-2 mb-2">Payment History</Label>
                                <div className="rounded-md border p-8 text-center text-muted-foreground">
                                    <p>You have no payment history.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Row 4: Danger Zone - full width */}
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive flex items-center gap-2">
                                <AlertTriangle /> Danger Zone
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold">Delete Your Account</h3>
                                    <p className="text-sm text-muted-foreground">Permanently remove your account and all of your data.</p>
                                </div>
                                <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setDeleteConfirmName(''); }}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">Delete Account</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete your account, subscription, and all of your data.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-2 py-2">
                                            <Label htmlFor="delete-confirm" className="text-sm font-medium">
                                                Type your name <span className="font-bold text-foreground">{formState.displayName}</span> to confirm:
                                            </Label>
                                            <Input
                                                id="delete-confirm"
                                                value={deleteConfirmName}
                                                onChange={(e) => setDeleteConfirmName(e.target.value)}
                                                placeholder="Type your name here"
                                            />
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteAccount}
                                                className="bg-destructive hover:bg-destructive/90"
                                                disabled={deleteConfirmName !== formState.displayName}
                                            >
                                                Delete Account
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
