import { App, YamlOutputType } from 'cdk8s';

import { BasicChart } from './lib/templates/basic-chart';

const app = new App({
  outdir: 'dist',
  outputFileExtension: '.yaml',
  yamlOutputType: YamlOutputType.FILE_PER_RESOURCE,
});

new BasicChart(app, 'my-simple-chart', {
  appName: 'my-simple-chart',
  image: 'nginx:latest',
  port: 80,
  replicas: 1,
  createNamespace: true, // Set to true to create namespace, false to skip
});

app.synth();
