"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Clock3, Copy, FileText, Loader2, Search, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getPatientHistory, type PatientHistory } from '@/lib/patient-history-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const recordLabels = { consultation: 'Consultation', case: 'Clinical case', analysis: 'AI analysis' };

function displayDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    });
}

export function PatientHistoryView({ mode }: { mode: 'patient' | 'staff' }) {
    const { user, role, loading: authLoading } = useAuth();
    const [patientId, setPatientId] = useState('');
    const [history, setHistory] = useState<PatientHistory | null>(null);
    const [page, setPage] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const requestVersion = useRef(0);
    const staff = role === 'doctor' || role === 'admin';

    useEffect(() => {
        const version = ++requestVersion.current;
        setHistory(null);
        setError('');
        setPatientId('');
        setPage(0);
        setBusy(false);
        if (authLoading || !user || mode !== 'patient') return;
        setBusy(true);
        getPatientHistory().then(result => {
            if (version !== requestVersion.current) return;
            if (result.success) setHistory(result.history);
            else setError(result.message);
        }).catch(() => {
            if (version === requestVersion.current) setError('History could not be loaded. Please try again.');
        }).finally(() => {
            if (version === requestVersion.current) setBusy(false);
        });
        return () => { requestVersion.current++; };
    }, [user?.id, role, authLoading, mode]);

    async function loadHistory(nextPage = 0) {
        const version = ++requestVersion.current;
        const targetId = nextPage > 0 ? history?.patient.id : mode === 'staff' ? patientId.trim() : undefined;
        if (mode === 'staff' && !targetId) {
            setHistory(null);
            setError('Enter a patient UUID.');
            return;
        }
        setError('');
        setBusy(true);
        if (nextPage === 0) setHistory(null);
        try {
            const result = await getPatientHistory({ patientId: targetId, page: nextPage });
            if (version !== requestVersion.current) return;
            if (!result.success) {
                setHistory(null);
                setError(result.message);
                return;
            }
            setHistory(previous => ({
                ...result.history,
                entries: nextPage > 0 ? [...(previous?.entries ?? []), ...result.history.entries] : result.history.entries,
            }));
            setPage(nextPage);
        } catch {
            if (version === requestVersion.current) {
                setHistory(null);
                setError('History could not be loaded. Please try again.');
            }
        } finally {
            if (version === requestVersion.current) setBusy(false);
        }
    }

    function search(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void loadHistory();
    }

    async function copyPatientId() {
        try {
            await navigator.clipboard.writeText(user!.id);
            setCopied(true);
        } catch {
            setError('The UUID could not be copied. Select and copy it manually.');
        }
    }

    if (authLoading) return <div className="flex justify-center p-12" role="status"><Loader2 className="h-6 w-6 animate-spin" /><span className="sr-only">Loading history</span></div>;
    if (!user) return <p className="p-8" role="alert">Sign in to view patient history.</p>;
    if (mode === 'staff' && !staff) return <p className="p-8" role="alert">This page is restricted to doctors and administrators.</p>;

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
            <header className="space-y-3 border-b pb-6">
                <h1 className="font-headline text-2xl font-semibold md:text-3xl">{mode === 'patient' ? 'My Medical History' : 'Patient History'}</h1>
                {mode === 'patient' && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Patient UUID</span>
                        <code className="break-all">{user.id}</code>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyPatientId} title={copied ? 'UUID copied' : 'Copy patient UUID'} aria-label={copied ? 'UUID copied' : 'Copy patient UUID'}>
                            <Copy className="h-4 w-4" />
                        </Button>
                        {copied && <span role="status" className="text-muted-foreground">Copied</span>}
                    </div>
                )}
                {mode === 'staff' && (
                    <form onSubmit={search} className="max-w-2xl space-y-2">
                        <Label htmlFor="patient-history-uuid">Patient UUID</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input id="patient-history-uuid" value={patientId} onChange={event => setPatientId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" spellCheck={false} required className="min-w-0 font-mono text-sm" />
                            <Button type="submit" disabled={busy} className="shrink-0 gap-2">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search
                            </Button>
                        </div>
                    </form>
                )}
            </header>

            {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 p-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => loadHistory()}>Retry</Button></div>}
            {busy && !history && <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading records</div>}
            {history && (
                <section aria-label="Patient records" className="min-w-0 space-y-5">
                    <div className="space-y-1">
                        <h2 className="break-words text-xl font-semibold">{history.patient.name}</h2>
                        {mode === 'staff' && <p className="break-all font-mono text-xs text-muted-foreground">{history.patient.id}</p>}
                    </div>
                    {history.entries.length === 0 && <p className="border-y py-10 text-center text-sm text-muted-foreground">No medical records found.</p>}
                    <div className="divide-y border-y">
                        {history.entries.map(entry => (
                            <article key={`${entry.kind}-${entry.id}`} className="min-w-0 space-y-3 py-5">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    <time dateTime={entry.occurredAt}>{displayDate(entry.occurredAt)}</time>
                                    <Badge variant="outline">{recordLabels[entry.kind]}</Badge>
                                    <span className="capitalize">{entry.status.replaceAll('_', ' ')}</span>
                                </div>
                                <h3 className="break-words font-semibold">{entry.title}</h3>
                                {entry.doctor ? (
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="link" className="h-auto max-w-full justify-start gap-2 whitespace-normal p-0 text-left">
                                                <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={entry.doctor.photoUrl ?? undefined} alt="" /><AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback></Avatar>
                                                <span className="min-w-0 break-words">{entry.doctor.name}</span>
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md" aria-describedby={undefined}>
                                            <DialogHeader><DialogTitle>Consulted Doctor</DialogTitle></DialogHeader>
                                            <div className="flex min-w-0 items-center gap-3">
                                                <Avatar className="h-14 w-14 shrink-0"><AvatarImage src={entry.doctor.photoUrl ?? undefined} alt="" /><AvatarFallback><UserRound /></AvatarFallback></Avatar>
                                                <div className="min-w-0"><p className="break-words font-semibold">{entry.doctor.name}</p><p className="break-words text-sm text-muted-foreground">{entry.doctor.specialization ?? 'Specialization not recorded'}</p></div>
                                            </div>
                                            <dl className="space-y-2 text-sm"><dt className="text-muted-foreground">Doctor reference UUID</dt><dd className="break-all font-mono text-xs">{entry.doctor.id}</dd><dt className="text-muted-foreground">Record date</dt><dd>{displayDate(entry.occurredAt)}</dd></dl>
                                        </DialogContent>
                                    </Dialog>
                                ) : <p className="text-sm text-muted-foreground">{entry.kind === 'analysis' ? 'No clinician review recorded' : 'Doctor reference unavailable'}</p>}
                                <details className="group">
                                    <summary className="flex w-fit cursor-pointer items-center gap-2 rounded-sm text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2"><FileText className="h-4 w-4" />Record details</summary>
                                    <dl className="mt-4 grid min-w-0 gap-4 border-l-2 pl-4">
                                        <div><dt className="text-xs text-muted-foreground">Record UUID</dt><dd className="break-all font-mono text-xs">{entry.id}</dd></div>
                                        {entry.details.map(detail => <div key={detail.label} className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{detail.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{detail.value}</dd></div>)}
                                    </dl>
                                </details>
                            </article>
                        ))}
                    </div>
                    {history.hasMore && <Button variant="outline" disabled={busy} onClick={() => loadHistory(page + 1)} className="gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Load Older Records</Button>}
                </section>
            )}
        </div>
    );
}