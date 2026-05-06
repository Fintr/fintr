"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp, AreaChart } from 'lucide-react';
import LoadingSpinner from '@/components/ui/loading-spinner';

interface ChartPlaceholderProps {
  chartType: string;
}

const getChartIcon = (chartType: string) => {
  switch (chartType) {
    case 'pie':
      return <PieChart className="h-6 w-6 text-primary" />;
    case 'bar':
      return <BarChart3 className="h-6 w-6 text-primary" />;
    case 'line':
      return <TrendingUp className="h-6 w-6 text-primary" />;
    case 'area':
      return <AreaChart className="h-6 w-6 text-primary" />;
    default:
      return <BarChart3 className="h-6 w-6 text-primary" />;
  }
};

const getChartTitle = (chartType: string) => {
  switch (chartType) {
    case 'pie':
      return 'Pie Chart';
    case 'bar':
      return 'Bar Chart';
    case 'line':
      return 'Line Chart';
    case 'area':
      return 'Area Chart';
    default:
      return 'Chart';
  }
};

export const ChartPlaceholder: React.FC<ChartPlaceholderProps> = ({ chartType }) => {
  return (
    <Card className="w-full my-4 border border-primary/10 bg-muted/30">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {getChartIcon(chartType)}
          <CardTitle className="text-lg">{getChartTitle(chartType)}</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">Generating chart data...</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center justify-center h-40 w-full">
          <LoadingSpinner size="medium" />
        </div>
      </CardContent>
    </Card>
  );
};
