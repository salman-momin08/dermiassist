"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";

type AnalysisHistoryChartProps = {
  chartData: { month: string; analyses: number }[];
  totalAnalyses: number;
  timeRange: string;
};

export default function AnalysisHistoryChart({ chartData, totalAnalyses, timeRange }: AnalysisHistoryChartProps) {
  return (
    <div className="lg:col-span-4 rounded-3xl border border-border/80 bg-card/70 backdrop-blur-md p-6 shadow-md flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <h2 className="text-base font-bold text-foreground font-headline">Analysis History</h2>
          </div>
          <p className="text-xs text-muted-foreground">Your skin analysis trends over the last 6 months.</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted/50 border border-border/60 px-3 py-1.5 rounded-full">
          {timeRange}
        </span>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-[220px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAnalysesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderRadius: '1rem',
                border: '1px solid hsl(var(--border))',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
            <Area
              type="monotone"
              dataKey="analyses"
              stroke="#3B82F6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorAnalysesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Telemetry Metrics */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/60 mt-2">
        <div className="p-3 rounded-2xl bg-muted/30 border border-border/40">
          <span className="text-[10px] font-semibold text-muted-foreground block">Highest</span>
          <span className="text-xs font-bold text-foreground mt-0.5 block">Aug 2026 · {totalAnalyses}</span>
        </div>
        <div className="p-3 rounded-2xl bg-muted/30 border border-border/40">
          <span className="text-[10px] font-semibold text-muted-foreground block">Average / Month</span>
          <span className="text-xs font-bold text-blue-500 mt-0.5 block font-clinical-mono">
            {(totalAnalyses / 6).toFixed(2)}
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-muted/30 border border-border/40">
          <span className="text-[10px] font-semibold text-muted-foreground block">Growth</span>
          <span className="text-xs font-bold text-emerald-500 mt-0.5 block">↑ 100% vs last 6m</span>
        </div>
      </div>
    </div>
  );
}
