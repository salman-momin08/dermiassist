
"use client";

import { useAnalyses } from "@/hooks/use-analyses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Stethoscope, FileText, PlusCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts"
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, startOfMonth } from "date-fns";
import { motion } from 'framer-motion';

const chartConfig = {
  analyses: {
    label: "Analyses",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

const mockAppointments = {
  total: 0,
  upcoming: 0,
};

export default function DashboardPage() {
  const { analyses, isLoading } = useAnalyses();

  const dashboardStats = useMemo(() => {
    const totalAnalyses = analyses.length;
    const analysesLastMonth = analyses.filter(a => {
      const analysisDate = new Date(a.date);
      const today = new Date();
      const lastMonth = new Date(today.setMonth(today.getMonth() - 1));
      return analysisDate > lastMonth;
    }).length;
    const recentAnalyses = analyses.slice(0, 3);

    return { totalAnalyses, analysesLastMonth, recentAnalyses };
  }, [analyses]);

  const chartData = useMemo(() => {
    if (isLoading || analyses.length === 0) {
      return [];
    }

    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    const monthlyCounts: { [key: string]: number } = {};

    // Initialize the last 6 months
    for (let i = 0; i < 6; i++) {
      const month = format(subMonths(new Date(), i), 'MMM yyyy');
      monthlyCounts[month] = 0;
    }

    analyses.forEach(analysis => {
      const analysisDate = new Date(analysis.date);
      if (analysisDate >= sixMonthsAgo) {
        const month = format(analysisDate, 'MMM yyyy');
        if (monthlyCounts.hasOwnProperty(month)) {
          monthlyCounts[month]++;
        }
      }
    });

    return Object.entries(monthlyCounts)
      .map(([month, count]) => ({
        month: month.split(' ')[0], // Just get month name
        analyses: count,
        date: startOfMonth(new Date(month))
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort from oldest to newest
  }, [analyses, isLoading]);


  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="lg:col-span-4 h-96" />
          <Skeleton className="lg:col-span-3 h-96" />
        </div>
      </div>
    )
  }

  const statCardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 mb-6 sm:mb-8">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">
            Patient Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome back! Here's an overview of your skin health journey.
          </p>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Button asChild className="w-full sm:w-auto text-sm sm:text-base">
            <Link href="/analyze">
              <PlusCircle className="mr-2 h-4 w-4" />
              Start New Analysis
            </Link>
          </Button>
        </div>
      </div>

      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        <motion.div variants={statCardVariants}>
          <Card className="hover:border-primary/50 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{dashboardStats.totalAnalyses}</div>
              <p className="text-xs text-muted-foreground">+{dashboardStats.analysesLastMonth} since last month</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={statCardVariants}>
          <Card className="hover:border-primary/50 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Appointments</CardTitle>
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockAppointments.total}</div>
              <p className="text-xs text-muted-foreground">{mockAppointments.upcoming} upcoming</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={statCardVariants}>
          <Card className="hover:border-primary/50 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reports Generated</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalAnalyses}</div>
              <p className="text-xs text-muted-foreground">All reports are downloadable</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
            <CardDescription>
              Your skin analysis trends over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              {chartData.length > 0 ? (
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="analyses" fill="var(--color-analyses)" radius={8} />
                </BarChart>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  No analysis data available. Perform an analysis to see your history.
                </div>
              )}
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Recent Analyses</CardTitle>
              <CardDescription>
                An overview of your most recent skin analyses.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/my-analyses">
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardStats.recentAnalyses.length > 0 ? (
                    dashboardStats.recentAnalyses.map(analysis => (
                      <TableRow key={analysis.id}>
                        <TableCell>
                          <div className="font-medium">{analysis.conditionName}</div>
                          <div className="hidden text-sm text-muted-foreground md:inline">
                            {analysis.severity}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{format(new Date(analysis.date), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center h-24">
                        No recent analyses.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
