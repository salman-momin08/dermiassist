"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  CheckCircle2,
  Clock,
  Search,
  ShieldCheck,
  Eye,
  Loader2,
  RefreshCw,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { mapAnalysisRow } from "@/lib/analysis-report";

interface TriageCase {
  id: string;
  patient_id?: string;
  patient_name: string;
  condition_name: string;
  confidence_score: number | null;
  image: string;
  created_at: string;
  review_status: 'pending_review' | 'in_review' | 'released' | 'rejected';
  severity: 'Urgent' | 'Moderate' | 'Mild' | 'Not assessed';
  icd10_code: string;
  wait_time_minutes: number;
}

export default function DoctorReviewQueuePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<TriageCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'wait_time' | 'confidence' | 'severity'>('wait_time');
  const supabase = useMemo(() => createClient(), []);

  const fetchTriageQueue = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      if (data && data.length > 0) {
        const now = Date.now();
        const mapped: TriageCase[] = data.map((item: any) => {
          const report = mapAnalysisRow(item);
          const createdAtMs = new Date(item.created_at || Date.now()).getTime();
          const waitMins = Math.max(1, Math.round((now - createdAtMs) / 60000));
          
          const sev: TriageCase['severity'] = ['Severe', 'Critical', 'Urgent'].includes(report.severity)
            ? 'Urgent' : report.severity === 'Mild' || report.severity === 'Moderate' ? report.severity : 'Not assessed';

          return {
            id: item.id,
            patient_id: item.user_id,
            patient_name: item.user_name || 'Anonymous Patient',
            condition_name: item.condition_name || 'Unclassified Lesion',
            confidence_score: report.confidenceScore ?? null,
            image: item.image || 'https://placehold.co/200x200.png?text=Specimen',
            created_at: item.created_at,
            review_status: item.review_status || 'pending_review',
            severity: sev,
            icd10_code: report.icd10Code || 'Not assigned',
            wait_time_minutes: waitMins,
          };
        });
        setCases(mapped);
      } else {
        setCases([]);
      }
    } catch (err: any) {
      console.warn("Triage fetch note:", err?.message || err);
      setLoadError('Could not load triage cases. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTriageQueue();
  }, [fetchTriageQueue]);

  // Filtering & Sorting
  const filteredCases = useMemo(() => {
    return cases
      .filter(c => {
        if (filterStatus === 'pending' && c.review_status !== 'pending_review' && c.review_status !== 'in_review') return false;
        if (filterStatus === 'released' && c.review_status !== 'released') return false;
        if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return c.patient_name.toLowerCase().includes(q) || c.condition_name.toLowerCase().includes(q) || c.icd10_code.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'wait_time') {
          // Urgent severity always bubbles up first
          if (a.severity === 'Urgent' && b.severity !== 'Urgent') return -1;
          if (b.severity === 'Urgent' && a.severity !== 'Urgent') return 1;
          return b.wait_time_minutes - a.wait_time_minutes;
        }
        if (sortBy === 'confidence') return (b.confidence_score ?? -1) - (a.confidence_score ?? -1);
        if (sortBy === 'severity') {
          const rank = { Urgent: 3, Moderate: 2, Mild: 1, 'Not assessed': 0 };
          return rank[b.severity] - rank[a.severity];
        }
        return 0;
      });
  }, [cases, filterStatus, filterSeverity, searchQuery, sortBy]);

  const pendingCount = cases.filter(c => c.review_status === 'pending_review' || c.review_status === 'in_review').length;
  const urgentCount = cases.filter(c => (c.review_status === 'pending_review' || c.review_status === 'in_review') && c.severity === 'Urgent').length;

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-7xl">
      {/* Top Ledger Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-border/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-clinical-mono text-xs font-bold text-primary uppercase tracking-wider">
              CLINICAL DECISION SUPPORT · CLINICIAN GATEWAY
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-headline flex items-center gap-3">
            <span>Dermatology Clinical Triage Ledger</span>
            <Badge variant="outline" className="text-xs font-clinical-mono border-primary/40 text-primary">
              {pendingCount} Active Cases
            </Badge>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Scannable priority queue. Review automated AI differentials, annotate ICD-10 findings, and release confirmed diagnostic reports.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTriageQueue}
            className="h-9 px-3.5 rounded-full text-xs font-semibold gap-1.5 border-border/80 shadow-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-primary", isLoading && "animate-spin")} />
            <span>Sync Ledger</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            asChild
            className="h-9 px-4 rounded-full text-xs font-semibold gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-indigo-600/20"
          >
            <Link href={filteredCases.length > 0 ? `/doctor/cases/${filteredCases[0].id}` : '#'}>
              <Zap className="h-3.5 w-3.5" />
              <span>Review Next Priority Case</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-card/90 border border-border/80 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patient name, condition, or ICD-10 code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-full text-xs bg-muted/30"
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-36 rounded-full text-xs font-medium">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cases</SelectItem>
              <SelectItem value="pending">Pending Triage ({pendingCount})</SelectItem>
              <SelectItem value="released">Released</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="h-9 w-40 rounded-full text-xs font-medium">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="Urgent">Urgent Malignancy ({urgentCount})</SelectItem>
              <SelectItem value="Moderate">Moderate</SelectItem>
              <SelectItem value="Mild">Mild</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sort:</span>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-9 w-36 rounded-full text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wait_time">Wait Time / Risk</SelectItem>
              <SelectItem value="confidence">AI Certainty</SelectItem>
              <SelectItem value="severity">Severity Rank</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* High-Density Triage Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/70 text-muted-foreground font-semibold uppercase tracking-wider text-[10.5px]">
                <th className="py-3.5 px-4 w-12 text-center">Pri</th>
                <th className="py-3.5 px-4">Patient & Specimen</th>
                <th className="py-3.5 px-4">AI Differential & ICD-10</th>
                <th className="py-3.5 px-4 text-center">AI Certainty</th>
                <th className="py-3.5 px-4">Wait Time</th>
                <th className="py-3.5 px-4">Discordance Risk</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Clinical Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading verified clinical ledger...</span>
                  </td>
                </tr>
              ) : loadError ? (
                <tr><td colSpan={8} role="alert" className="py-12 text-center text-destructive">{loadError}</td></tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-foreground text-sm">No Pending Triage Cases</p>
                    <p className="text-xs text-muted-foreground mt-1">No cases match the current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredCases.map((item) => {
                  const isUrgent = item.severity === 'Urgent';
                  const isReleased = item.review_status === 'released';

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-muted/25 transition-colors group",
                        isUrgent && !isReleased && "bg-destructive/5 hover:bg-destructive/10"
                      )}
                    >
                      {/* Priority Flag */}
                      <td className="py-3.5 px-4 text-center">
                        {isUrgent ? (
                          <span className="inline-flex h-6 w-6 rounded-full bg-destructive/15 text-destructive font-bold items-center justify-center text-xs shadow-xs animate-pulse">
                            !
                          </span>
                        ) : (
                          <span className="inline-flex h-6 w-6 rounded-full bg-muted/60 text-muted-foreground font-medium items-center justify-center text-xs">
                            —
                          </span>
                        )}
                      </td>

                      {/* Patient & Specimen Thumbnail */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-11 w-11 rounded-xl overflow-hidden border border-border/80 shadow-xs shrink-0 bg-black">
                            <Image
                              src={item.image}
                              alt="Lesion specimen"
                              width={44}
                              height={44}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-xs">{item.patient_name}</p>
                            <p className="font-clinical-mono text-[10px] text-muted-foreground">
                              ID: #{item.id.substring(0, 7).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* AI Differential & ICD-10 */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground text-xs">{item.condition_name}</p>
                          <span className="font-clinical-mono text-[10.5px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                            ICD-10: {item.icd10_code}
                          </span>
                        </div>
                      </td>

                      {/* Confidence Score */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-clinical-mono font-bold text-xs text-foreground">
                            {item.confidence_score == null ? 'Not assessed' : `${item.confidence_score}%`}
                          </span>
                          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden mt-1">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                (item.confidence_score ?? 0) > 85 ? "bg-emerald-500" : "bg-amber-500"
                              )}
                              style={{ width: `${item.confidence_score ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Wait Time */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-clinical-mono text-muted-foreground text-[11px]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {item.wait_time_minutes < 60
                              ? `${item.wait_time_minutes}m`
                              : `${Math.floor(item.wait_time_minutes / 60)}h ${item.wait_time_minutes % 60}m`}
                          </span>
                        </div>
                      </td>

                      {/* Discordance Risk */}
                      <td className="py-3.5 px-4">
                        <span className="text-muted-foreground">Not assessed</span>
                      </td>

                      {/* Review Status */}
                      <td className="py-3.5 px-4">
                        {isReleased ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Released</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Pending Review</span>
                          </span>
                        )}
                      </td>

                      {/* Review Action */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          asChild
                          className={cn(
                            "h-8 px-3.5 rounded-full text-xs font-semibold gap-1.5 shadow-xs transition-all",
                            isUrgent && !isReleased
                              ? "bg-destructive hover:bg-destructive/90 text-white"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          )}
                        >
                          <Link href={`/doctor/cases/${item.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                            <span>{isReleased ? "View Folio" : "Review & Release"}</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
