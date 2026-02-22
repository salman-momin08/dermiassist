import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse text-lg font-medium">Loading DermiAssist...</p>
        </div>
    );
}
