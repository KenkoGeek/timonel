import { Rutter, type ChartFileAsset } from '../../dist/index.js';

const binaryFile: ChartFileAsset = {
  destination: 'files/icon.bin',
  content: new Uint8Array([0, 1, 2]),
};

const chart = new Rutter({
  meta: { name: 'chart-files-consumer', version: '1.0.0' },
  chartFiles: [{ destination: 'files/config.json', content: '{"enabled":true}\n' }],
});
chart.addChartFile(binaryFile);
const configuredFiles: readonly ChartFileAsset[] = chart.getChartFiles();
void configuredFiles;

// @ts-expect-error Chart files require text or binary content.
chart.addChartFile({ destination: 'files/invalid.json', content: { enabled: true } });
