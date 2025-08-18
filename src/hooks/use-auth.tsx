
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

type UserRole = 'patient' | 'doctor' | 'admin';

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    subscriptionPlan?: string;
    [key: string]: any; // Allow other properties
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

    const fetchUserData = async (firebaseUser: User) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                setUserData(userDoc.data() as UserData);
            } else {
                console.error("No user data found in Firestore for UID:", firebaseUser.uid);
                // Handle case where user exists in Auth but not Firestore
                setUserData(null);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUserData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                fetchUserData(firebaseUser);
            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const forceReload = () => {
        if (user) {
            setLoading(true);
            fetchUserData(user);
        }
    }

    const signOut = async () => {
        await firebaseSignOut(auth);
        router.push('/');
    };
    
    const role: UserRole = userData?.role || 'patient';

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
