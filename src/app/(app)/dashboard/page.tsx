"use client";

import { useAnalyses } from "@/hooks/use-analyses";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Calendar, 
  FileText, 
  PlusCircle, 
  ArrowUpRight, 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  ChevronRight, 
  TrendingUp,
  Award,
  CalendarDays
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, startOfMonth } from "date-fns";
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";

// recharts is only needed for this one card — split it into its own chunk
// instead of shipping it with the rest of the (above-the-fold) dashboard.
const AnalysisHistoryChart = dynamic(() => import('./analysis-history-chart'), {
  ssr: false,
  loading: () => <Skeleton className="lg:col-span-4 h-[380px] rounded-3xl" />,
});

const mockAppointments = {
  total: 0,
  upcoming: 0,
};

export default function DashboardPage() {
  const { analyses, isLoading } = useAnalyses();
  const { user, userData } = useAuth();
  const [timeRange, setTimeRange] = useState("Last 6 Months");

  const displayName = userData?.displayName?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Patient';

  const dashboardStats = useMemo(() => {
    const totalAnalyses = analyses.length;
    const analysesLastMonth = analyses.filter(a => {
      const analysisDate = new Date(a.date);
      const today = new Date();
      const lastMonth = new Date(today.setMonth(today.getMonth() - 1));
      return analysisDate > lastMonth;
    }).length;
    const recentAnalyses = analyses.slice(0, 4);

    return { totalAnalyses, analysesLastMonth, recentAnalyses };
  }, [analyses]);

  const chartData = useMemo(() => {
    if (isLoading) return [];

    const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    
    if (analyses.length === 0) {
      return months.map(m => ({ month: m, analyses: 0 }));
    }

    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    const monthlyCounts: { [key: string]: number } = {};

    for (let i = 5; i >= 0; i--) {
      const monthStr = format(subMonths(new Date(), i), 'MMM');
      monthlyCounts[monthStr] = 0;
    }

    analyses.forEach(analysis => {
      const analysisDate = new Date(analysis.date);
      if (analysisDate >= sixMonthsAgo) {
        const monthStr = format(analysisDate, 'MMM');
        if (monthlyCounts.hasOwnProperty(monthStr)) {
          monthlyCounts[monthStr]++;
        }
      }
    });

    // Ensure realistic presentation if sparse
    return Object.entries(monthlyCounts).map(([month, count]) => ({
      month,
      analyses: count,
    }));
  }, [analyses, isLoading]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-80 rounded-lg" />
          </div>
          <Skeleton className="h-11 w-48 rounded-2xl" />
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
          <Skeleton className="lg:col-span-4 h-96 rounded-3xl" />
          <Skeleton className="lg:col-span-3 h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  const statCardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-7xl space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-headline flex items-center gap-2">
            <span>Welcome back, {displayName}</span>
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Here's an overview of your skin health journey.
          </p>
        </div>
        
        <Button 
          asChild 
          className="h-11 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 border border-white/10 gap-2 transition-all active:scale-[0.98]"
        >
          <Link href="/analyze">
            <PlusCircle className="h-4 w-4" />
            <span>Start New Analysis</span>
            <Sparkles className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* 3 Metric Stat Cards */}
      <motion.div
        className="grid gap-5 md:grid-cols-3"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {/* Card 1: Total Analyses */}
        <motion.div variants={statCardVariants}>
          <div className="relative overflow-hidden rounded-3xl p-5 bg-card/70 border border-border/80 shadow-md backdrop-blur-md flex items-center justify-between group hover:border-blue-500/40 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Activity className="h-7 w-7" />
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Total Analyses</span>
                <span className="text-3xl font-black tracking-tight text-foreground font-headline">
                  {dashboardStats.totalAnalyses}
                </span>
                <span className="text-[11px] font-semibold text-emerald-500 block mt-0.5">
                  +{dashboardStats.analysesLastMonth} since last month
                </span>
              </div>
            </div>
            {/* Decorative mini spline curve */}
            <div className="w-16 h-8 opacity-60">
              <svg viewBox="0 0 100 40" className="w-full h-full stroke-blue-500 fill-none stroke-[3]">
                <path d="M0 35 Q 25 35, 45 20 T 90 5" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Appointments */}
        <motion.div variants={statCardVariants}>
          <div className="relative overflow-hidden rounded-3xl p-5 bg-card/70 border border-border/80 shadow-md backdrop-blur-md flex items-center justify-between group hover:border-purple-500/40 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                <Calendar className="h-7 w-7" />
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Appointments</span>
                <span className="text-3xl font-black tracking-tight text-foreground font-headline">
                  {mockAppointments.total}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground block mt-0.5">
                  {mockAppointments.upcoming} upcoming
                </span>
              </div>
            </div>
            {/* Progress Bar indicator */}
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 w-1/3 rounded-full" />
            </div>
          </div>
        </motion.div>

        {/* Card 3: Reports Generated */}
        <motion.div variants={statCardVariants}>
          <div className="relative overflow-hidden rounded-3xl p-5 bg-card/70 border border-border/80 shadow-md backdrop-blur-md flex items-center justify-between group hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
                <FileText className="h-7 w-7" />
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Reports Generated</span>
                <span className="text-3xl font-black tracking-tight text-foreground font-headline">
                  {dashboardStats.totalAnalyses}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground block mt-0.5">
                  All reports are downloadable
                </span>
              </div>
            </div>
            {/* Circular Gauge accent */}
            <div className="h-8 w-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin-slow opacity-80" />
          </div>
        </motion.div>
      </motion.div>

      {/* Main Grid: Analysis History Chart & Recent Analyses */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
        {/* Left: Analysis History Chart (4 cols) */}
        <AnalysisHistoryChart
          chartData={chartData}
          totalAnalyses={dashboardStats.totalAnalyses}
          timeRange={timeRange}
        />

        {/* Right: Recent Analyses (3 cols) */}
        <div className="lg:col-span-3 rounded-3xl border border-border/80 bg-card/70 backdrop-blur-md p-6 shadow-md flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground font-headline">Recent Analyses</h2>
              <p className="text-xs text-muted-foreground">An overview of your most recent skin analyses.</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-8 px-2.5 rounded-full text-xs font-semibold gap-1 text-primary hover:bg-primary/10">
              <Link href="/my-analyses">
                <span>View All</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {/* Analyses List */}
          <div className="space-y-2.5 flex-1">
            {dashboardStats.recentAnalyses.length > 0 ? (
              dashboardStats.recentAnalyses.map((analysis) => (
                <Link
                  key={analysis.id}
                  href={`/my-analyses/${analysis.id}`}
                  className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border/40 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-950/60 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {analysis.conditionName}
                      </h4>
                      <Badge variant="outline" className="text-[10px] px-2 py-0 h-4 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-medium">
                        {analysis.severity || 'Mild'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{format(new Date(analysis.date), "MMM d, yyyy")}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No recent analyses. Click "Start New Analysis" to assess your first skin condition.
              </div>
            )}
          </div>

          {/* Security Banner Card */}
          <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Your data is secure</h5>
                <p className="text-[10px] text-muted-foreground">We prioritize HIPAA encryption & clinical privacy</p>
              </div>
            </div>
            <Lock className="h-4 w-4 text-blue-400 opacity-60 mr-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

