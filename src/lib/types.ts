import type { Chart } from 'cdk8s';

export interface ChartProps {
  name: string;
  version: string;
  description: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  services?: Array<{
    name: string;
    port: number;
    targetPort: number;
  }>;
  subcharts?: Array<{
    name: string;
    chart: Chart | ((scope: Chart, id: string) => Chart) | unknown;
    version?: string;
    enabled?: boolean;
    // Allow any additional properties for flexibility
    [key: string]: unknown;
  }>;
  // Allow any additional properties for flexibility
  [key: string]: unknown;
}

export interface SubchartProps {
  name: string;
  version: string;
  path: string;
}
