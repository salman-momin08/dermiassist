
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type UserRole = 'patient' | 'doctor' | 'admin';

interface UserData {
    uid: string; // Keep 'uid' for compatibility with rest of app, map to Supabase 'id'
    email: string | null;
    displayName: string | null;
    role: UserRole;
    subscriptionPlan?: string;
    [key: string]: any;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    role: UserRole;
    loading: boolean;
    signOut: () => Promise<void>;
    forceReload: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    const fetchUserData = useCallback(async (supabaseUser: User) => {
        try {
            // Use cached profile fetch (server action)
            const { getCachedUserProfile } = await import('@/lib/redis/user-cache');
            const data = await getCachedUserProfile(supabaseUser.id);

            if (data) {
                setUserData({
                    ...data,
                    uid: data.id, // Map Supabase 'id' to 'uid'
                    displayName: data.display_name,
                    subscriptionPlan: data.subscription_plan,
                    // role is already in data
                } as UserData);
            } else {
                // Handle case where profile might be missing temporarily or creating
                setUserData(null);
            }
        } catch (error) {
            setUserData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const currentUserRef = useRef<string | null>(null);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const isNewUser = session?.user?.id !== currentUserRef.current;

            // Only block the UI on initial load, sign out, or if a completely new user signs in.
            // Ignore background token syncs or tab-switch SIGNED_IN events for the same user.
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && isNewUser)) {
                setLoading(true);
            }

            if (session?.user) {
                currentUserRef.current = session.user.id;
                setUser(session.user);
                // fetchUserData handles setting loading to false in its finally block
                fetchUserData(session.user);
            } else {
                currentUserRef.current = null;
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, fetchUserData]);

    const forceReload = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setLoading(true);
            fetchUserData(user);
        }
    }, [supabase, fetchUserData]);

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            // Ignore 403 errors - session is already invalid
            // User will still be logged out locally
        } finally {
            // Always redirect to login, even if server logout fails
            router.push('/login');
        }
    };

    const role: UserRole = (userData?.role as UserRole) || 'patient';

    return (
        <AuthContext.Provider value={{ user, userData, role, loading, signOut, forceReload }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
