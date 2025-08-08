
"use client";

import { useState, useEffect, useCallback } from 'react';

// Define the structure of a single analysis report
export interface AnalysisReport {
    id: string;
    condition: string;
    date: string;
    severity: string; // This can be derived or a static value for now
    image: string; // data URI
    recommendations: string;
    dos: string[];
    donts: string[];
    submittedInfo: {
        preMedication: string;
        diseaseDuration: string;
    };
}


const STORAGE_KEY = 'skinwise-analyses';

export function useAnalyses() {
    const [analyses, setAnalyses] = useState<AnalysisReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(STORAGE_KEY);
            if (item) {
                setAnalyses(JSON.parse(item));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
        }
        setIsLoading(false);
    }, []);

    const addAnalysis = useCallback((newAnalysis: Omit<AnalysisReport, 'id' | 'date' | 'severity'>) => {
        const report: AnalysisReport = {
            ...newAnalysis,
            id: new Date().getTime().toString(),
            date: new Date().toISOString().split('T')[0],
            severity: 'Mild', // AI doesn't provide severity, so mocking it.
        };

        setAnalyses(prevAnalyses => {
            const updatedAnalyses = [report, ...prevAnalyses];
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAnalyses));
            } catch (error) {
                console.warn(`Error writing to localStorage key “${STORAGE_KEY}”:`, error);
            }
            return updatedAnalyses;
        });

        return report;
    }, []);

    const getAnalysisById = useCallback((id: string): AnalysisReport | undefined => {
        return analyses.find(a => a.id === id);
    }, [analyses]);

    const deleteAnalysis = useCallback((id: string) => {
        setAnalyses(prevAnalyses => {
            const updatedAnalyses = prevAnalyses.filter(a => a.id !== id);
             try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAnalyses));
            } catch (error) {
                console.warn(`Error writing to localStorage key “${STORAGE_KEY}”:`, error);
            }
            return updatedAnalyses;
        });
    }, []);

    return { analyses, addAnalysis, getAnalysisById, deleteAnalysis, isLoading };
}
