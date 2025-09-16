import type { Chart } from 'cdk8s';

export interface ChartProps {
  name: string;
  version: string;
  description: string;
  services?: Array<{
    name: string;
    port: number;
    targetPort: number;
  }>;
  subcharts?: Array<{
    name: string;
    chart: Chart;
  }>;
}

export interface SubchartProps {
  name: string;
  version: string;
  path: string;
}
