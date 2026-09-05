/**
 * Type-safe Helm values reference system.
 *
 * ValuesRef exposes the shape of the caller-provided values interface while
 * preserving a runtime proxy that renders Helm expressions.
 */

import { createHelmExpression, type HelmExpression } from './helmControlStructures.js';

const HELM_VALUE_SYMBOL = Symbol('HelmValue');

type HelmScalar = string | number | boolean;
type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;
type StringKeyOf<T> = Extract<keyof T, string>;
type RuntimeReservedValueKey = 'toJSON' | 'toString' | 'valueOf';
type HelmValueReservedKey = Extract<keyof HelmValue<unknown>, string> | RuntimeReservedValueKey;

/**
 * A Helm value reference with mapped properties that mirror the supplied
 * TypeScript value shape. Keys reserved by the ValuesRef API remain accessible
 * through the typed `at()` accessor.
 */
export type HelmValueRef<T> = HelmValue<T> &
  (T extends readonly unknown[]
    ? object
    : T extends object
      ? {
          readonly [K in Exclude<StringKeyOf<T>, HelmValueReservedKey>]-?: HelmValueRef<T[K]>;
        }
      : object);

/** Represents a reference to a Helm value that can be used in templates. */
export interface HelmValue<T = unknown> {
  [HELM_VALUE_SYMBOL]: true;
  __path: string;
  __type?: T;

  /**
   * Accesses a values key without colliding with ValuesRef methods.
   * Use this for keys such as `default`, `range`, or `with`.
   */
  at<K extends StringKeyOf<T>>(key: K): HelmValueRef<T[K]>;

  eq(value: HelmValueRef<unknown> | HelmScalar): HelmCondition;
  ne(value: HelmValueRef<unknown> | HelmScalar): HelmCondition;
  gt(value: HelmValueRef<unknown> | number): HelmCondition;
  ge(value: HelmValueRef<unknown> | number): HelmCondition;
  lt(value: HelmValueRef<unknown> | number): HelmCondition;
  le(value: HelmValueRef<unknown> | number): HelmCondition;

  not(): HelmCondition;
  and(other: HelmCondition): HelmCondition;
  or(other: HelmCondition): HelmCondition;

  default(defaultValue: HelmValueRef<unknown> | HelmScalar): HelmValueRef<T>;
  quote(): HelmValueRef<string>;
  upper(): HelmValueRef<string>;
  lower(): HelmValueRef<string>;
  title(): HelmValueRef<string>;
  trim(): HelmValueRef<string>;
  trimPrefix(prefix: string): HelmValueRef<string>;
  trimSuffix(suffix: string): HelmValueRef<string>;
  replace(old: string, newStr: string): HelmValueRef<string>;
  contains(substr: string): HelmCondition;
  hasPrefix(prefix: string): HelmCondition;
  hasSuffix(suffix: string): HelmCondition;
  trunc(length: number): HelmValueRef<string>;

  kindIs(kind: 'string' | 'slice' | 'map' | 'bool' | 'int' | 'float'): HelmCondition;
  hasKey(key: string): HelmCondition;

  toYaml(): HelmValueRef<string>;
  toJson(): HelmValueRef<string>;
  nindent(spaces: number): HelmValueRef<string>;
  indent(spaces: number): HelmValueRef<string>;
  toExpression(): HelmExpression;

  if<V>(condition: HelmCondition | HelmValueRef<unknown>, thenValue: V): HelmFieldConditional<V>;
  ifElse<V extends HelmValueRef<unknown> | HelmScalar>(
    condition: HelmCondition,
    thenValue: V,
    elseValue: V,
  ): HelmValueRef<V extends HelmValueRef<infer U> ? U : V>;

  range<V>(
    callback: (item: HelmValueRef<ArrayElement<T>>, index: HelmValueRef<number>) => V,
  ): HelmRange<V, ArrayElement<T>>;

  with<V>(callback: (ctx: HelmValueRef<T>) => V): HelmWith<V, T>;
}

/** Represents a Helm boolean condition. */
export interface HelmCondition {
  [HELM_VALUE_SYMBOL]: true;
  __condition: string;
  not(): HelmCondition;
  and(other: HelmCondition): HelmCondition;
  or(other: HelmCondition): HelmCondition;
  toString(): string;
}

/** Represents a field-level conditional. */
export interface HelmFieldConditional<T> {
  __helmFieldConditional: true;
  condition: HelmCondition;
  thenValue: T;
  elseValue?: T;
}

/** Represents a Helm range block. */
export interface HelmRange<T, TItem = unknown> {
  __helmRange: true;
  source: HelmValueRef<readonly TItem[]>;
  callback: (item: HelmValueRef<TItem>, index: HelmValueRef<number>) => T;
}

/** Represents a Helm with block. */
export interface HelmWith<T, TContext = unknown> {
  __helmWith: true;
  source: HelmValueRef<TContext>;
  callback: (ctx: HelmValueRef<TContext>) => T;
}

/** Helper context for Helm built-ins and functions. */
export interface HelmHelpers {
  include(templateName: string, context?: '.' | HelmValueRef<unknown>): HelmValueRef<string>;
  printf(
    format: string,
    ...args: Array<HelmValueRef<unknown> | string | number>
  ): HelmValueRef<string>;
  release: {
    name: HelmValueRef<string>;
    namespace: HelmValueRef<string>;
    service: HelmValueRef<string>;
    isUpgrade: HelmValueRef<boolean>;
    isInstall: HelmValueRef<boolean>;
    revision: HelmValueRef<number>;
  };
  chart: {
    name: HelmValueRef<string>;
    version: HelmValueRef<string>;
    appVersion: HelmValueRef<string>;
    type: HelmValueRef<string>;
  };
  capabilities: {
    kubeVersion: {
      version: HelmValueRef<string>;
      major: HelmValueRef<string>;
      minor: HelmValueRef<string>;
    };
    apiVersions: {
      has(apiVersion: string): HelmCondition;
    };
  };
  /** Escape hatch for Helm conditions that cannot be expressed through ValuesRef. */
  rawCondition(condition: string): HelmCondition;
}

function helmStringLiteral(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function serializeValue(value: HelmValueRef<unknown> | HelmScalar): string {
  if (isHelmValue(value)) {
    return value.__path;
  }
  return typeof value === 'string' ? helmStringLiteral(value) : String(value);
}

function appendPropertyPath(path: string, property: string): string {
  return path === '.' ? `.${property}` : `${path}.${property}`;
}

function createCondition(condition: string): HelmCondition {
  if (!condition || typeof condition !== 'string') {
    throw new Error('Condition must be a non-empty string');
  }

  return {
    [HELM_VALUE_SYMBOL]: true,
    __condition: condition,
    not() {
      return createCondition(`not (${this.__condition})`);
    },
    and(other: HelmCondition) {
      if (!other || typeof other.__condition !== 'string') {
        throw new Error('Invalid HelmCondition provided to and()');
      }
      return createCondition(`and (${this.__condition}) (${other.__condition})`);
    },
    or(other: HelmCondition) {
      if (!other || typeof other.__condition !== 'string') {
        throw new Error('Invalid HelmCondition provided to or()');
      }
      return createCondition(`or (${this.__condition}) (${other.__condition})`);
    },
    toString() {
      return this.__condition;
    },
  };
}

/**
 * Creates the runtime proxy used by ValuesRef and by serializer callback scopes.
 * This function is intentionally not re-exported from the package root.
 */
export function createHelmValueProxy<T>(path: string): HelmValueRef<T> {
  const baseObject = Object.create(null) as HelmValue<T>;

  const handler: ProxyHandler<typeof baseObject> = {
    has(_target, prop) {
      return prop === HELM_VALUE_SYMBOL;
    },
    get(_target, prop: string | symbol) {
      if (prop === HELM_VALUE_SYMBOL) return true;
      if (prop === '__path') return path;
      if (prop === '__type') return undefined;
      if (prop === Symbol.toPrimitive) return () => path;
      if (prop === 'toJSON') {
        return () => `{{ ${path} }}`;
      }

      if (typeof prop !== 'string') return undefined;

      switch (prop) {
        case 'at':
          return <K extends StringKeyOf<T>>(key: K) =>
            createHelmValueProxy<T[K]>(appendPropertyPath(path, key));
        case 'eq':
          return (value: HelmValueRef<unknown> | HelmScalar) =>
            createCondition(`eq ${path} ${serializeValue(value)}`);
        case 'ne':
          return (value: HelmValueRef<unknown> | HelmScalar) =>
            createCondition(`ne ${path} ${serializeValue(value)}`);
        case 'gt':
          return (value: HelmValueRef<unknown> | number) =>
            createCondition(`gt ${path} ${serializeValue(value)}`);
        case 'ge':
          return (value: HelmValueRef<unknown> | number) =>
            createCondition(`ge ${path} ${serializeValue(value)}`);
        case 'lt':
          return (value: HelmValueRef<unknown> | number) =>
            createCondition(`lt ${path} ${serializeValue(value)}`);
        case 'le':
          return (value: HelmValueRef<unknown> | number) =>
            createCondition(`le ${path} ${serializeValue(value)}`);
        case 'not':
          return () => createCondition(`not ${path}`);
        case 'and':
          return (other: HelmCondition) => createCondition(`and ${path} (${other.__condition})`);
        case 'or':
          return (other: HelmCondition) => createCondition(`or ${path} (${other.__condition})`);
        case 'default':
          return (defaultValue: HelmValueRef<unknown> | HelmScalar) =>
            createHelmValueProxy<T>(`${path} | default ${serializeValue(defaultValue)}`);
        case 'quote':
          return () => createHelmValueProxy<string>(`(${path} | quote)`);
        case 'upper':
          return () => createHelmValueProxy<string>(`(${path} | upper)`);
        case 'lower':
          return () => createHelmValueProxy<string>(`(${path} | lower)`);
        case 'title':
          return () => createHelmValueProxy<string>(`(${path} | title)`);
        case 'trim':
          return () => createHelmValueProxy<string>(`(${path} | trim)`);
        case 'trimPrefix':
          return (prefix: string) =>
            createHelmValueProxy<string>(`(${path} | trimPrefix ${helmStringLiteral(prefix)})`);
        case 'trimSuffix':
          return (suffix: string) =>
            createHelmValueProxy<string>(`(${path} | trimSuffix ${helmStringLiteral(suffix)})`);
        case 'replace':
          return (old: string, newStr: string) =>
            createHelmValueProxy<string>(
              `(${path} | replace ${helmStringLiteral(old)} ${helmStringLiteral(newStr)})`,
            );
        case 'contains':
          return (substr: string) =>
            createCondition(`contains ${helmStringLiteral(substr)} ${path}`);
        case 'hasPrefix':
          return (prefix: string) =>
            createCondition(`hasPrefix ${helmStringLiteral(prefix)} ${path}`);
        case 'hasSuffix':
          return (suffix: string) =>
            createCondition(`hasSuffix ${helmStringLiteral(suffix)} ${path}`);
        case 'trunc':
          return (length: number) => createHelmValueProxy<string>(`(${path} | trunc ${length})`);
        case 'kindIs':
          return (kind: string) => createCondition(`kindIs ${helmStringLiteral(kind)} ${path}`);
        case 'hasKey':
          return (key: string) => createCondition(`hasKey ${path} ${helmStringLiteral(key)}`);
        case 'toYaml':
          return () => createHelmValueProxy<string>(`${path} | toYaml`);
        case 'toJson':
          return () => createHelmValueProxy<string>(`${path} | toJson`);
        case 'nindent':
          return (spaces: number) => createHelmValueProxy<string>(`${path} | nindent ${spaces}`);
        case 'indent':
          return (spaces: number) => createHelmValueProxy<string>(`${path} | indent ${spaces}`);
        case 'toExpression':
          return () => createHelmExpression(`{{ ${path} }}`);
        case 'if':
          return <V>(
            condition: HelmCondition | HelmValueRef<unknown>,
            thenValue: V,
          ): HelmFieldConditional<V> => {
            const helmCondition = isHelmCondition(condition)
              ? condition
              : isHelmValue(condition)
                ? createCondition(condition.__path)
                : undefined;
            if (!helmCondition) {
              throw new Error('v.if() requires a HelmCondition or HelmValue as the first argument');
            }
            return {
              __helmFieldConditional: true,
              condition: helmCondition,
              thenValue,
            };
          };
        case 'ifElse':
          return <V extends HelmValueRef<unknown> | HelmScalar>(
            condition: HelmCondition,
            thenValue: V,
            elseValue: V,
          ) =>
            createHelmValueProxy(
              `(ternary ${serializeValue(thenValue)} ${serializeValue(elseValue)} (${condition.__condition}))`,
            );
        case 'range':
          return <V>(
            callback: (item: HelmValueRef<ArrayElement<T>>, index: HelmValueRef<number>) => V,
          ): HelmRange<V, ArrayElement<T>> => ({
            __helmRange: true,
            source: createHelmValueProxy<readonly ArrayElement<T>[]>(path),
            callback,
          });
        case 'with':
          return <V>(callback: (ctx: HelmValueRef<T>) => V): HelmWith<V, T> => ({
            __helmWith: true,
            source: createHelmValueProxy<T>(path),
            callback,
          });
        case 'toString':
          return () => `{{ ${path} }}`;
        case 'valueOf':
          return () => path;
        default:
          return createHelmValueProxy<unknown>(appendPropertyPath(path, prop));
      }
    },
  };

  return new Proxy(baseObject, handler) as unknown as HelmValueRef<T>;
}

type HelmHelperKey = Extract<keyof HelmHelpers, string>;

/**
 * Root ValuesRef shape. Root Helm helper names are reserved and can be reached
 * as values through `at()`, for example `v.at('release')`.
 */
export type ValuesRef<T extends object> = HelmValue<T> &
  HelmHelpers &
  (T extends readonly unknown[]
    ? object
    : {
        readonly [
          K in Exclude<StringKeyOf<T>, HelmValueReservedKey | HelmHelperKey>
        ]-?: HelmValueRef<T[K]>;
      });

/** Creates a type-safe reference tree rooted at `.Values`. */
export function valuesRef<T extends object>(): ValuesRef<T> {
  const values = createHelmValueProxy<T>('.Values');

  const helpers: HelmHelpers = {
    include(templateName: string, context: '.' | HelmValueRef<unknown> = '.') {
      const ctx = context === '.' ? '.' : context.__path;
      return createHelmValueProxy<string>(`(include ${helmStringLiteral(templateName)} ${ctx})`);
    },
    printf(format: string, ...args: Array<HelmValueRef<unknown> | string | number>) {
      const argsStr = args.map((arg) => serializeValue(arg)).join(' ');
      const suffix = argsStr ? ` ${argsStr}` : '';
      return createHelmValueProxy<string>(`(printf ${helmStringLiteral(format)}${suffix})`);
    },
    release: {
      name: createHelmValueProxy<string>('.Release.Name'),
      namespace: createHelmValueProxy<string>('.Release.Namespace'),
      service: createHelmValueProxy<string>('.Release.Service'),
      isUpgrade: createHelmValueProxy<boolean>('.Release.IsUpgrade'),
      isInstall: createHelmValueProxy<boolean>('.Release.IsInstall'),
      revision: createHelmValueProxy<number>('.Release.Revision'),
    },
    chart: {
      name: createHelmValueProxy<string>('.Chart.Name'),
      version: createHelmValueProxy<string>('.Chart.Version'),
      appVersion: createHelmValueProxy<string>('.Chart.AppVersion'),
      type: createHelmValueProxy<string>('.Chart.Type'),
    },
    capabilities: {
      kubeVersion: {
        version: createHelmValueProxy<string>('.Capabilities.KubeVersion.Version'),
        major: createHelmValueProxy<string>('.Capabilities.KubeVersion.Major'),
        minor: createHelmValueProxy<string>('.Capabilities.KubeVersion.Minor'),
      },
      apiVersions: {
        has(apiVersion: string) {
          return createCondition(`.Capabilities.APIVersions.Has ${helmStringLiteral(apiVersion)}`);
        },
      },
    },
    rawCondition(condition: string) {
      return createCondition(condition);
    },
  };

  return new Proxy(values, {
    get(target, prop) {
      if (Object.prototype.hasOwnProperty.call(helpers, prop)) {
        return Reflect.get(helpers, prop);
      }
      return Reflect.get(target, prop);
    },
  }) as unknown as ValuesRef<T>;
}

/** Check if a value is a Helm value proxy. */
export function isHelmValue(value: unknown): value is HelmValueRef<unknown> {
  return typeof value === 'object' && value !== null && HELM_VALUE_SYMBOL in value;
}

/** Check if a value is a Helm condition. */
export function isHelmCondition(value: unknown): value is HelmCondition {
  return (
    typeof value === 'object' &&
    value !== null &&
    HELM_VALUE_SYMBOL in value &&
    '__condition' in value
  );
}

/** Check if a value is a field-level conditional. */
export function isHelmFieldConditional(value: unknown): value is HelmFieldConditional<unknown> {
  return typeof value === 'object' && value !== null && '__helmFieldConditional' in value;
}

/** Check if a value is a range block. */
export function isHelmRange(value: unknown): value is HelmRange<unknown, unknown> {
  return typeof value === 'object' && value !== null && '__helmRange' in value;
}

/** Check if a value is a with block. */
export function isHelmWith(value: unknown): value is HelmWith<unknown, unknown> {
  return typeof value === 'object' && value !== null && '__helmWith' in value;
}

/** Serialize a Helm value reference to template syntax. */
export function serializeHelmValue(value: HelmValueRef<unknown>): string {
  return `{{ ${value.__path} }}`;
}

/** Serialize a Helm condition body. */
export function serializeHelmCondition(condition: HelmCondition): string {
  return condition.__condition;
}
