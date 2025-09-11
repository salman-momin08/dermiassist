
"use client";

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
}

export function LoadingOverlay({ isLoading, message = "Loading..." }: LoadingOverlayProps) {
    if (!isLoading) {
        return null;
    }

    return (
        <div 
            className={cn(
                "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 transition-opacity duration-300",
                isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{ backdropFilter: 'blur(4px)' }}
        >
            <div className="flex items-center gap-4 rounded-lg bg-popover p-6 shadow-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-lg font-medium text-popover-foreground">{message}</p>
            </div>
        </div>
    );
}
