
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { createClient } from '@/lib/supabase/client';


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
    const supabase = createClient();

    useEffect(() => {
        if (!user) {
            setAnalyses([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        async function fetchAnalyses() {
            // Supabase ID matches Auth ID
            const { data, error } = await supabase
                .from('analyses')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false });

            if (error) {
                // Ignore silent fetch errors on load
            } else if (data) {
                // Map snake_case DB to camelCase Interface
                const mappedAnalyses: AnalysisReport[] = data.map(item => ({
                    id: item.id,
                    userId: item.user_id,
                    userName: item.user_name,
                    conditionName: item.condition_name,
                    condition: item.condition_description || item.condition_name, // fallback
                    date: item.created_at,
                    severity: item.severity,
                    image: item.image,
                    recommendations: item.recommendations,
                    dos: item.dos,
                    donts: item.donts,
                    submittedInfo: {
                        initialCondition: item.submitted_info?.initialCondition,
                        otherConsiderations: item.submitted_info?.otherConsiderations,
                        proformaAnswers: item.submitted_info?.proformaAnswers,
                    },
                    explanations: item.explanations
                }));
                setAnalyses(mappedAnalyses);
            }
            setIsLoading(false);
        }

        fetchAnalyses();

        // Supabase Realtime Subscription
        const channel = supabase
            .channel('analyses-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'analyses',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                // Simple approach: re-fetch on any change
                fetchAnalyses();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, supabase]);

    const addAnalysis = useCallback(async (userId: string, userName: string, newAnalysis: Omit<AnalysisReport, 'id' | 'date' | 'severity' | 'userId' | 'userName'>) => {
        // Map camelCase to snake_case
        const dbRow = {
            user_id: userId,
            user_name: userName,
            condition_name: newAnalysis.conditionName,
            condition_description: newAnalysis.condition,
            severity: 'Mild', // Mock
            image: newAnalysis.image,
            recommendations: newAnalysis.recommendations,
            dos: newAnalysis.dos,
            donts: newAnalysis.donts,
            submitted_info: newAnalysis.submittedInfo,
        };

        const { data, error } = await supabase
            .from('analyses')
            .insert(dbRow)
            .select()
            .single();

        if (error) throw new Error(error.message);

        const item = data;
        return {
            id: item.id,
            userId: item.user_id,
            userName: item.user_name,
            conditionName: item.condition_name,
            condition: item.condition_description,
            date: item.created_at,
            severity: item.severity,
            image: item.image,
            recommendations: item.recommendations,
            dos: item.dos,
            donts: item.donts,
            submittedInfo: item.submitted_info,
            explanations: item.explanations
        } as AnalysisReport;
    }, [supabase]);

    const getAnalysisById = useCallback(async (userId: string, analysisId: string): Promise<AnalysisReport | undefined> => {
        if (!userId || !analysisId) return undefined;

        try {
            const { data: item, error } = await supabase
                .from('analyses')
                .select('*')
                .eq('id', analysisId)
                .single();

            if (error || !item) return undefined;

            return {
                id: item.id,
                userId: item.user_id,
                userName: item.user_name,
                conditionName: item.condition_name,
                condition: item.condition_description,
                date: item.created_at,
                severity: item.severity,
                image: item.image,
                recommendations: item.recommendations,
                dos: item.dos,
                donts: item.donts,
                submittedInfo: item.submitted_info,
                explanations: item.explanations
            } as AnalysisReport;
        } catch (error) {
            return undefined;
        }
    }, [supabase]);

    const updateAnalysis = useCallback(async (userId: string, analysisId: string, data: Partial<AnalysisReport>) => {
        if (!userId || !analysisId) return;

        // Map specific fields if needed, or rely on partial updates being careful
        const updates: any = {};
        if (data.explanations) updates.explanations = data.explanations;

        // For now only likely to update explanations, but can add more mapping if needed

        const { error } = await supabase
            .from('analyses')
            .update(updates)
            .eq('id', analysisId);
    }, [supabase]);

    const deleteAnalysis = useCallback(async (userId: string, id: string) => {
        if (!userId) throw new Error("User not authenticated.");
        await supabase.from('analyses').delete().eq('id', id);
    }, [supabase]);

    const forceAnalysisReload = useCallback(async (analysisId: string) => {
        // Handled by realtime subscription usually, but logic remains same if manual
    }, []);

    return { analyses, addAnalysis, getAnalysisById, updateAnalysis, deleteAnalysis, isLoading, forceAnalysisReload };
}
