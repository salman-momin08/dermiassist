
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { collection, doc, addDoc, getDoc, getDocs, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';


export interface Explanation {
    explanationText: string;
    audioUrl: string;
    chatHistory?: { sender: 'user' | 'bot'; text: string }[];
}

// Define the structure of a single analysis report
export interface AnalysisReport {
    id: string;
    userId: string;
    userName: string;
    conditionName: string;
    condition: string;
    date: string;
    severity: string;
    image: string; // data URI
    recommendations: string;
    dos: string[];
    donts: string[];
    submittedInfo: {
        initialCondition?: string;
        otherConsiderations?: string;
        proformaAnswers?: { question: string; answer: string }[];
    };
    explanations?: {
        [language: string]: Explanation;
    };
}

export function useAnalyses() {
    const { user } = useAuth();
    const [analyses, setAnalyses] = useState<AnalysisReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const forceAnalysisReload = useCallback(async (userId: string, analysisId: string) => {
        const docRef = doc(db, 'users', userId, 'analyses', analysisId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const updatedAnalysis = { id: docSnap.id, ...docSnap.data() } as AnalysisReport;
            setAnalyses(prev => prev.map(a => a.id === analysisId ? updatedAnalysis : a));
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setAnalyses([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const analysesColRef = collection(db, 'users', user.uid, 'analyses');
        const q = query(analysesColRef, orderBy('date', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const userAnalyses = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AnalysisReport));
            setAnalyses(userAnalyses);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching analyses:", error);
            setIsLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [user]);

    const addAnalysis = useCallback(async (userId: string, userName: string, newAnalysis: Omit<AnalysisReport, 'id' | 'date' | 'severity' | 'userId' | 'userName'>) => {
        if (!userId) throw new Error("User not authenticated.");

        const report: Omit<AnalysisReport, 'id'> = {
            ...newAnalysis,
            userId,
            userName,
            date: new Date().toISOString(),
            severity: 'Mild', // AI doesn't provide severity, so mocking it.
        };

        const analysesColRef = collection(db, 'users', userId, 'analyses');
        const docRef = await addDoc(analysesColRef, report);

        return { ...report, id: docRef.id } as AnalysisReport;
    }, []);

    const getAnalysisById = useCallback(async (userId: string, analysisId: string): Promise<AnalysisReport | undefined> => {
        if (!userId || !analysisId) return undefined;
        
        // Check local state first for speed
        const localAnalysis = analyses.find(a => a.id === analysisId);
        if (localAnalysis) return localAnalysis;

        try {
            const docRef = doc(db, 'users', userId, 'analyses', analysisId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as AnalysisReport;
            } else {
                console.log("No such document!");
                return undefined;
            }
        } catch (error) {
            console.error("Error fetching document:", error);
            return undefined;
        }
    }, [analyses]);

    const deleteAnalysis = useCallback(async (userId: string, id: string) => {
        if (!userId) throw new Error("User not authenticated.");
        const docRef = doc(db, 'users', userId, 'analyses', id);
        await deleteDoc(docRef);
        // The onSnapshot listener will automatically update the local state
    }, []);

    return { analyses, addAnalysis, getAnalysisById, deleteAnalysis, isLoading, forceAnalysisReload };
}
