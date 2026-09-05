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

void replicas;
void imageTag;
void disabled;
void range;
void withBlock;

// @ts-expect-error ValuesRef must reject properties that do not exist on Values.
void v.missing;

// @ts-expect-error Nested ValuesRef properties must preserve the declared shape.
void v.image.digest;

v.items.range((item) => {
  // @ts-expect-error Array callback items must preserve the element shape.
  return item.missing;
});
