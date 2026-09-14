import {
  createUmbrella,
  type GeneratedSubchartSpec,
  type RemoteSubchartSpec,
  Rutter,
  type VendoredSubchartSpec,
} from '../../dist/index.js';

const generatedRutter = new Rutter({
  meta: { name: 'generated', version: '1.0.0' },
});

const generated: GeneratedSubchartSpec = {
  name: 'generated',
  rutter: generatedRutter,
};

const remote: RemoteSubchartSpec = {
  name: 'ingress-nginx',
  version: '4.15.1',
  repository: 'https://kubernetes.github.io/ingress-nginx',
};

const vendored: VendoredSubchartSpec = {
  name: 'fluent-bit',
  version: '1.2.3',
  sourceDirectory: './vendor/fluent-bit',
};

createUmbrella({
  meta: { name: 'consumer-umbrella', version: '1.0.0' },
  subcharts: [generated, remote, vendored],
});

// @ts-expect-error Remote dependency-only charts require an explicit version.
const missingRemoteVersion: RemoteSubchartSpec = {
  name: 'ingress-nginx',
  repository: 'https://kubernetes.github.io/ingress-nginx',
};
void missingRemoteVersion;

const mixedGeneratedVendored: GeneratedSubchartSpec = {
  name: 'mixed',
  rutter: generatedRutter,
  // @ts-expect-error Generated subcharts cannot also declare a vendored source directory.
  sourceDirectory: './vendor/mixed',
};
void mixedGeneratedVendored;
