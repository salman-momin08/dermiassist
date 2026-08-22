
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminProfilePage() {
    const { user, forceReload } = useAuth();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Admin');
        }
    }, [user]);

    const handleSaveName = async () => {
        if (!user || !name.trim()) return;

        const supabase = createClient();
        setIsSavingName(true);

        try {
            // Update auth metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { display_name: name }
            });

            if (authError) throw authError;

            // Update profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ display_name: name })
                .eq('id', user.id);

            if (profileError) throw profileError;

            toast({
                title: "Profile Updated",
                description: "Your name has been successfully updated.",
            });

            forceReload();
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message || "Could not update your name.",
                variant: "destructive"
            });
        } finally {
            setIsSavingName(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!newPassword || !confirmPassword) {
            toast({
                title: "Missing Information",
                description: "Please fill in all password fields.",
                variant: "destructive"
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({
                title: "Passwords Don't Match",
                description: "New password and confirmation password must match.",
                variant: "destructive"
            });
            return;
        }

        // Strong password validation
        if (newPassword.length < 8) {
            toast({
                title: "Password Too Short",
                description: "Password must be at least 8 characters long.",
                variant: "destructive"
            });
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

        const supabase = createClient();
        setIsUpdatingPassword(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            toast({
                title: "Password Updated",
                description: "Your password has been successfully changed.",
            });

            // Clear form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message || "Could not update your password.",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (!user) return null;

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Admin Profile & Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your administrator account.
                </p>
            </div>

            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Account Information</CardTitle>
                        <CardDescription>Update your personal details here.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveName} disabled={isSavingName || !name.trim()}>
                            {isSavingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
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
                            <Input
                                id="current-password"
                                type="password"
                                placeholder="Enter your current password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                placeholder="Min. 8 chars, 1 uppercase, 1 number, 1 special char"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                placeholder="Re-enter your new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={handlePasswordChange}
                            disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                        >
                            {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
