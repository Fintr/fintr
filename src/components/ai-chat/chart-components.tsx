"use client";

import React, { useState, useEffect } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

interface ChartComponentProps {
  type: string;
  data: Record<string, any>;
  title?: string;
  description?: string;
}

const COLORS = [
  '#0A3D62', '#1E88E5', '#43A047', '#FB8C00', '#E53935',
  '#8E24AA', '#00ACC1', '#7CB342', '#FF7043', '#5D4037'
];

const PieChartComponent: React.FC<{ data: Record<string, any>; height?: number }> = ({ data, height = 280 }) => {
  // Convert data to array format for recharts
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: typeof value === 'object' ? value.value || value.amount || 0 : value,
    color: value.color || COLORS[Math.floor(Math.random() * COLORS.length)]
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsPieChart margin={{ top: 40, right: 20, left: 20, bottom: 40 }}>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)} 
          contentStyle={{ fontSize: 12 }}
          labelStyle={{ fontSize: 12 }}
        />
        <Legend 
          fontSize={12}
          wrapperStyle={{ fontSize: 12, bottom: 0}}
          iconType="circle"
          verticalAlign="bottom"
          align="center"
          layout="horizontal"
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

const BarChartComponent: React.FC<{ data: Record<string, any>; height?: number }> = ({ data, height = 280 }) => {
  
  // Convert data to array format for recharts
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: typeof value === 'object' ? value.value || value.amount || 0 : value,
  }));
  

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={chartData} margin={{ top: 2, right: 20, left: 10, bottom: 2 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" stroke="#888888" fontSize={12} />
        <YAxis stroke="#888888" fontSize={12} />
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)} 
          contentStyle={{ fontSize: 12 }}
          labelStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="value" fill="#0A3D62" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

const LineChartComponent: React.FC<{ data: Record<string, any>; height?: number }> = ({ data, height = 280 }) => {
  // Convert data to array format for recharts
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: typeof value === 'object' ? value.value || value.amount || 0 : value,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={chartData} margin={{ top: 2, right: 20, left: 10, bottom: 2 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" stroke="#888888" fontSize={12} />
        <YAxis stroke="#888888" fontSize={12} />
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)} 
          contentStyle={{ fontSize: 12 }}
          labelStyle={{ fontSize: 12 }}
        />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#0A3D62" 
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

const AreaChartComponent: React.FC<{ data: Record<string, any>; height?: number }> = ({ data, height = 280 }) => {
  // Convert data to array format for recharts
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: typeof value === 'object' ? value.value || value.amount || 0 : value,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={chartData} margin={{ top: 2, right: 20, left: 10, bottom: 2 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" stroke="#888888" fontSize={12} />
        <YAxis stroke="#888888" fontSize={12} />
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)} 
          contentStyle={{ fontSize: 12 }}
          labelStyle={{ fontSize: 12 }}
        />
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="#0A3D62" 
          fill="#0A3D62"
          fillOpacity={0.3}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
};

export const ChartComponent: React.FC<ChartComponentProps> = ({ 
  type, 
  data, 
  title, 
  description 
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  
  // Check if screen is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const renderChart = (isLightbox = false) => {
    const height = isLightbox ? 500 : 280;
    
    try {
      switch (type) {
        case 'pie':
          return <PieChartComponent data={data} height={height} />;
        case 'bar':
          return <BarChartComponent data={data} height={height} />;
        case 'line':
          return <LineChartComponent data={data} height={height} />;
        case 'area':
          return <AreaChartComponent data={data} height={height} />;
        default:
          return <div className="text-center text-muted-foreground p-4">
            Unsupported chart type: {type}
          </div>;
      }
    } catch (error) {
      return <div className="text-center text-red-500 p-4">
        Error rendering {type} chart: {error instanceof Error ? error.message : 'Unknown error'}
      </div>;
    }
  };

  return (
    <>
      <div 
        className={`w-full my-2 border border-primary/10 rounded-lg bg-card p-3 ${
          isMobile 
            ? 'cursor-pointer hover:border-primary/20 transition-colors' 
            : ''
        }`}
        onClick={isMobile ? () => setIsLightboxOpen(true) : undefined}
      >
        {renderChart(false)}
      </div>
      
      {isMobile && (
        <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                {title || `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`}
              </DialogTitle>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </DialogHeader>
            <div className="mt-4">
              {renderChart(true)}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
