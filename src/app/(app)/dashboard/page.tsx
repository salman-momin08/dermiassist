
"use client";

import { useAnalyses } from "@/hooks/use-analyses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Stethoscope, FileText, PlusCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const chartData = [
  { month: "January", analyses: 1 },
  { month: "February", analyses: 3 },
  { month: "March", analyses: 2 },
  { month: "April", analyses: 5 },
  { month: "May", analyses: 4 },
  { month: "June", analyses: 6 },
]

const chartConfig = {
  analyses: {
    label: "Analyses",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

// Mock data - in a real app this would come from an API
const mockAppointments = {
    total: 2,
    upcoming: 1,
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

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between space-y-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Patient Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your skin health journey.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/analyze">
              <PlusCircle className="mr-2 h-4 w-4" />
              Start New Analysis
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalAnalyses}</div>
            <p className="text-xs text-muted-foreground">+{dashboardStats.analysesLastMonth} since last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockAppointments.total}</div>
            <p className="text-xs text-muted-foreground">{mockAppointments.upcoming} upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports Generated</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalAnalyses}</div>
            <p className="text-xs text-muted-foreground">All reports are downloadable</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
            <CardDescription>
              Your skin analysis trends over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="analyses" fill="var(--color-analyses)" radius={8} />
              </BarChart>
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
                              <div className="font-medium">{analysis.condition}</div>
                              <div className="hidden text-sm text-muted-foreground md:inline">
                                  {analysis.severity}
                              </div>
                          </TableCell>
                          <TableCell className="text-right">{analysis.date}</TableCell>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
