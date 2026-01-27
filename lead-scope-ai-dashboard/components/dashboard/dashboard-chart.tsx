"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const data = [
  { date: "Jan 1", added: 120, removed: 15 },
  { date: "Jan 3", added: 89, removed: 22 },
  { date: "Jan 5", added: 156, removed: 8 },
  { date: "Jan 7", added: 203, removed: 31 },
  { date: "Jan 9", added: 145, removed: 12 },
  { date: "Jan 11", added: 178, removed: 19 },
  { date: "Jan 13", added: 234, removed: 25 },
  { date: "Jan 15", added: 189, removed: 14 },
  { date: "Jan 17", added: 267, removed: 28 },
  { date: "Jan 19", added: 198, removed: 17 },
  { date: "Jan 21", added: 312, removed: 33 },
  { date: "Jan 23", added: 245, removed: 21 },
  { date: "Jan 25", added: 289, removed: 18 },
]

export function DashboardChart() {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAdded" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.65 0.2 260)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.65 0.2 260)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorRemoved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.55 0.2 25)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.55 0.2 25)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "oklch(0.65 0.02 260)", fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "oklch(0.65 0.02 260)", fontSize: 12 }}
            dx={-10}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.17 0.008 260)",
              border: "1px solid oklch(0.28 0.01 260)",
              borderRadius: "8px",
              color: "oklch(0.98 0 0)",
            }}
            labelStyle={{ color: "oklch(0.65 0.02 260)", marginBottom: "4px" }}
          />
          <Area
            type="monotone"
            dataKey="added"
            stroke="oklch(0.65 0.2 260)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorAdded)"
            name="Added"
          />
          <Area
            type="monotone"
            dataKey="removed"
            stroke="oklch(0.55 0.2 25)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRemoved)"
            name="Removed"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
