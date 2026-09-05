import { valuesRef, type HelmValueRef } from '../../dist/index.js';

interface Values {
  enabled: boolean;
  replicaCount: number;
  image: {
    repository: string;
    tag: string;
  };
  items: Array<{
    name: string;
    value: string;
  }>;
  database: {
    host: string;
    port: number;
  };
  default: string;
  release: {
    name: string;
  };
  settings: {
    default: string;
    range: string[];
  };
}

const v = valuesRef<Values>();

const replicas: HelmValueRef<number> = v.replicaCount;
const imageTag: HelmValueRef<string> = v.image.tag;
const disabled = v.enabled.not();
const range = v.items.range((item, index) => ({
  name: item.name,
  value: item.value,
  index,
}));
const withBlock = v.database.with((database) => ({
  host: database.host,
  port: database.port,
}));
const reservedRootValue: HelmValueRef<{ name: string }> = v.at('release');
const reservedDefaultValue: HelmValueRef<string> = v.settings.at('default');
const reservedRangeValue: HelmValueRef<string[]> = v.settings.at('range');

void replicas;
void imageTag;
void disabled;
void range;
void withBlock;
void reservedRootValue;
void reservedDefaultValue;
void reservedRangeValue;

// @ts-expect-error Root helper names are reserved; use at('release') for .Values.release.
const invalidRootRelease: HelmValueRef<{ name: string }> = v.release;
void invalidRootRelease;

// @ts-expect-error ValuesRef method names are reserved; use at('default') for the value key.
const invalidNestedDefault: HelmValueRef<string> = v.settings.default;
void invalidNestedDefault;

// @ts-expect-error at() only accepts keys declared by the current values type.
void v.settings.at('missing');

// @ts-expect-error ValuesRef must reject properties that do not exist on Values.
void v.missing;

// @ts-expect-error Nested ValuesRef properties must preserve the declared shape.
void v.image.digest;

v.items.range((item) => {
  // @ts-expect-error Array callback items must preserve the element shape.
  return item.missing;
});
