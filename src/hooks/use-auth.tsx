
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

type UserRole = 'patient' | 'doctor' | 'admin';

interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
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

    const fetchUserData = useCallback(async (firebaseUser: User) => {
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                setUserData(userDoc.data() as UserData);
            } else {
                console.warn("No user data found in Firestore for UID:", firebaseUser.uid, "Creating new document.");
                
                // If user exists in Auth but not Firestore, create a basic user doc.
                // This can happen with social logins or if the signup process was interrupted.
                const newUser: UserData = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    role: 'patient', // Default role
                    createdAt: new Date().toISOString(),
                    subscriptionPlan: 'Free',
                };
                
                await setDoc(userDocRef, newUser);
                setUserData(newUser);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUserData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setLoading(true);
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
    }, [fetchUserData]);

    const forceReload = useCallback(() => {
        if (user) {
            setLoading(true);
            fetchUserData(user);
        }
    }, [user, fetchUserData]);

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
