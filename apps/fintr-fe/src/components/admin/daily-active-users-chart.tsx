"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyActiveUsersChartProps {
  dailyActiveUsers: Record<string, number>;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  onSelectDate?: (isoDate: string) => void;
}

export const DailyActiveUsersChart = ({
  dailyActiveUsers,
  dateRange,
  onSelectDate,
}: DailyActiveUsersChartProps) => {
  const chartData = Object.entries(dailyActiveUsers)
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      fullDate: date,
      activeUsers: count,
    }))
    .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily active users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available for the selected date range
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily active users</CardTitle>
        <p className="text-sm text-muted-foreground">
          {new Date(dateRange.startDate).toLocaleDateString()} -{" "}
          {new Date(dateRange.endDate).toLocaleDateString()}
        </p>
        {onSelectDate ? (
          <p className="text-xs text-muted-foreground pt-1">
            Click a point on the line to load the user detail table for that day. Counts are users with
            authenticated API activity that calendar day.
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onClick={(state) => {
                if (!onSelectDate) {
                  return;
                }
                const payload = state?.activePayload?.[0]?.payload as { fullDate?: string } | undefined;
                const fullDate = payload?.fullDate;
                if (fullDate) {
                  onSelectDate(fullDate);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} domain={[0, "dataMax + 1"]} />
              <Tooltip
                labelFormatter={(_value, payload) => {
                  if (payload && payload[0]) {
                    return `Date: ${(payload[0].payload as { fullDate: string }).fullDate}`;
                  }
                  return "";
                }}
                formatter={(value: number) => [value, "Active users"]}
              />
              <Line
                type="monotone"
                dataKey="activeUsers"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ fill: "#8884d8", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "#8884d8", strokeWidth: 2 }}
                style={onSelectDate ? { cursor: "pointer" } : undefined}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
