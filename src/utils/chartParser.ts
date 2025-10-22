export interface ChartData {
  type: 'pie-chart' | 'bar-chart' | 'line-chart' | 'area-chart';
  data: Record<string, any>;
  title?: string;
  description?: string;
}

export interface ParsedChart {
  type: string;
  data: Record<string, any>;
  title?: string;
  description?: string;
}

/**
 * Parses chart data from AI response text
 * Looks for patterns like:
 * ***pie-chart***
 * { data1: { value: 100 }, data2: { value: 200 } }
 * ***pie-chart-end***
 */
export const parseChartData = (content: string): ParsedChart[] => {
  const charts: ParsedChart[] = [];
  
  // Regex to match chart blocks - support both old (***) and new (*****) markers
  const chartRegex = /\*{3,5}([^-]+)-chart\*{3,5}\s*([\s\S]*?)\s*\*{3,5}[^-]+-chart-end\*{3,5}/g;
  
  let match;
  while ((match = chartRegex.exec(content)) !== null) {
    const chartType = match[1].trim();
    let chartDataString = match[2].trim();
    
    try {
      // Clean the JSON string by removing commas from numbers
      chartDataString = chartDataString.replace(/(\d+),(\d+)/g, '$1$2');
      
      // Parse the JSON data
      const chartData = JSON.parse(chartDataString);
      
      charts.push({
        type: chartType,
        data: chartData,
      });
    } catch (error) {
      // Continue with other charts even if one fails
    }
  }
  
  return charts;
};

/**
 * Removes chart blocks from content and returns clean text
 */
export const removeChartBlocks = (content: string): string => {
  return content.replace(/\*\*\*[^-]+-chart\*\*\*[\s\S]*?\*\*\*[^-]+-chart-end\*\*\*/g, '').trim();
};

/**
 * Detects incomplete chart blocks during streaming
 * Returns information about charts that are being built
 */
export const detectIncompleteCharts = (content: string): { hasIncompleteChart: boolean; chartType?: string } => {
  // Check for chart start markers without end markers
  const chartStartRegex = /\*\*\*([^-]+)-chart\*\*\*/g;
  const chartEndRegex = /\*\*\*[^-]+-chart-end\*\*\*/g;
  
  const startMatches = Array.from(content.matchAll(chartStartRegex));
  const endMatches = Array.from(content.matchAll(chartEndRegex));
  
  // If we have more starts than ends, there's an incomplete chart
  if (startMatches.length > endMatches.length) {
    const lastStart = startMatches[startMatches.length - 1];
    return {
      hasIncompleteChart: true,
      chartType: lastStart[1].trim()
    };
  }
  
  return { hasIncompleteChart: false };
};

/**
 * Splits content into text segments and chart data
 */
export const parseContentWithCharts = (content: string): { text: string; charts: ParsedChart[] } => {
  const charts = parseChartData(content);
  const text = removeChartBlocks(content);
  
  return { text, charts };
};

/**
 * Parses content and returns segments with inline chart positioning
 */
export const parseContentWithInlineCharts = (content: string): Array<{ type: 'text' | 'chart'; content?: string; chart?: ParsedChart }> => {
  const segments: Array<{ type: 'text' | 'chart'; content?: string; chart?: ParsedChart }> = [];
  
  // Find all chart blocks and their positions - support both old (***) and new (*****) markers
  const chartRegex = /\*{3,5}([^-]+)-chart\*{3,5}\s*([\s\S]*?)\s*\*{3,5}[^-]+-chart-end\*{3,5}/g;
  
  const chartMatches: Array<{ match: RegExpExecArray; start: number; end: number }> = [];
  
  let match;
  while ((match = chartRegex.exec(content)) !== null) {
    chartMatches.push({
      match,
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  if (chartMatches.length === 0) {
    // No charts, return just the text
    return [{ type: 'text', content }];
  }
  
  let lastIndex = 0;
  
  chartMatches.forEach(({ match, start, end }, index) => {
    // Add text before the chart
    if (start > lastIndex) {
      const textBefore = content.slice(lastIndex, start).trim();
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore });
      }
    }
    
    // Parse and add the chart
    try {
      const chartType = match[1].trim();
      let chartDataString = match[2].trim();
      
      // Clean the JSON string by removing commas from numbers
      chartDataString = chartDataString.replace(/(\d+),(\d+)/g, '$1$2');
      
      const chartData = JSON.parse(chartDataString);
      
      segments.push({
        type: 'chart',
        chart: {
          type: chartType,
          data: chartData,
        }
      });
    } catch (error) {
      // Continue with other charts even if one fails
    }
    
    lastIndex = end;
  });
  
  // Add remaining text after the last chart
  if (lastIndex < content.length) {
    const textAfter = content.slice(lastIndex).trim();
    if (textAfter) {
      segments.push({ type: 'text', content: textAfter });
    }
  }
  
  return segments;
};
