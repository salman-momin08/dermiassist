"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import { createClient } from '@/lib/supabase/client';
import { mapAnalysisRow } from '@/lib/analysis-report';
import { useToast } from './use-toast';


import { ReviewStatus, ClinicianOverrides } from '@/types/review-types';

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
    reviewStatus?: ReviewStatus;
    reviewerId?: string;
    reviewerName?: string;
    reviewerBadgeNumber?: string;
    reviewerNotes?: string;
    clinicianOverrides?: ClinicianOverrides;
    reviewedAt?: string;
    confidenceScore?: number;
    icd10Code?: string;
    /** HMAC signature computed at release time; see src/lib/case-review-actions.ts. */
    verificationSignature?: string;
}

export function useAnalyses() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [analyses, setAnalyses] = useState<AnalysisReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // Stable reference — prevents a new Supabase client on every render
    const supabase = useMemo(() => createClient(), []);

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
                toast({ title: 'Could not load analyses', description: error.message, variant: 'destructive' });
            } else if (data) {
                setAnalyses(data.map(mapAnalysisRow));
            }
            setIsLoading(false);
        }

        fetchAnalyses();

        // Supabase Realtime Subscription
        // Use optimistic updates from the payload to avoid a full refetch on every change.
        const channel = supabase
            .channel(`analyses-changes-${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'analyses',
                filter: `user_id=eq.${user.id}`,
            }, (payload: any) => {
                if (payload.eventType === 'INSERT') {
                    setAnalyses(prev => [mapAnalysisRow(payload.new), ...prev.filter(a => a.id !== payload.new.id)]);
                } else if (payload.eventType === 'DELETE') {
                    setAnalyses(prev => prev.filter(a => a.id !== payload.old.id));
                } else if (payload.eventType === 'UPDATE') {
                    setAnalyses(prev =>
                        prev.map(a => a.id === payload.new.id ? mapAnalysisRow(payload.new) : a)
                    );
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, supabase, toast]);

    const addAnalysis = useCallback(async (userId: string, userName: string, newAnalysis: Omit<AnalysisReport, 'id' | 'date' | 'severity' | 'userId' | 'userName'>) => {
        // Map camelCase to snake_case
        const dbRow = {
            user_id: userId,
            user_name: userName,
            condition_name: newAnalysis.conditionName,
            condition_description: newAnalysis.condition,
            severity: 'Not assessed',
            image: newAnalysis.image,
            image_url: newAnalysis.image,
            recommendations: newAnalysis.recommendations,
            dos: newAnalysis.dos,
            donts: newAnalysis.donts,
            submitted_info: newAnalysis.submittedInfo,
            review_status: 'pending_review',
        };

        const { data, error } = await supabase
            .from('analyses')
            .insert(dbRow)
            .select()
            .single();

        if (error) throw new Error(error.message);

        return mapAnalysisRow(data);
    }, [supabase]);

    const getAnalysisById = useCallback(async (userId: string, analysisId: string): Promise<AnalysisReport | undefined> => {
        if (!userId || !analysisId) return undefined;

        const { data: item, error } = await supabase
                .from('analyses')
                .select('*')
                .eq('id', analysisId)
                .eq('user_id', userId)
                .maybeSingle();
        if (error) throw new Error(error.message);
        return item ? mapAnalysisRow(item) : undefined;
    }, [supabase]);

    const updateAnalysis = useCallback(async (userId: string, analysisId: string, data: Partial<AnalysisReport>) => {
        if (!userId || !analysisId) return;

        // Map specific fields if needed, or rely on partial updates being careful
        const updates: { explanations?: AnalysisReport['explanations'] } = {};
        if (data.explanations) updates.explanations = data.explanations;

        // For now only likely to update explanations, but can add more mapping if needed

        const { error } = await supabase
            .from('analyses')
            .update(updates)
            .eq('id', analysisId)
            .eq('user_id', userId)
            .select('id')
            .single();
        if (error) throw new Error(error.message);
    }, [supabase]);

    const deleteAnalysis = useCallback(async (userId: string, id: string) => {
        if (!userId) throw new Error("User not authenticated.");
        const { error } = await supabase.from('analyses').delete().eq('id', id).eq('user_id', userId).select('id').single();
        if (error) throw new Error(error.message);
    }, [supabase]);

    return { analyses, addAnalysis, getAnalysisById, updateAnalysis, deleteAnalysis, isLoading };
}
