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

/**
 * Reference to a Helm value or scoped Helm expression.
 *
 * Instances are runtime proxies. The generic type preserves the shape of the referenced value
 * while helper methods compose Helm/Sprig expressions.
 */
export interface HelmValue<T = unknown> {
  /** Internal runtime marker used by Timonel serializers. */
  [HELM_VALUE_SYMBOL]: true;
  /** Internal Helm expression path represented by this proxy. */
  __path: string;
  /** Type-only marker; it is not populated at runtime. */
  __type?: T;

  /**
   * Access a typed property whose name collides with a ValuesRef method or root helper.
   * @param key - Property key from the current TypeScript values type
   * @returns A typed proxy for the nested value
   */
  at<K extends StringKeyOf<T>>(key: K): HelmValueRef<T[K]>;

  /** Compare the value for equality. */
  eq(value: HelmValueRef<unknown> | HelmScalar): HelmCondition;
  /** Compare the value for inequality. */
  ne(value: HelmValueRef<unknown> | HelmScalar): HelmCondition;
  /** Compare whether the value is greater than another numeric value/reference. */
  gt(value: HelmValueRef<unknown> | number): HelmCondition;
  /** Compare whether the value is greater than or equal to another numeric value/reference. */
  ge(value: HelmValueRef<unknown> | number): HelmCondition;
  /** Compare whether the value is less than another numeric value/reference. */
  lt(value: HelmValueRef<unknown> | number): HelmCondition;
  /** Compare whether the value is less than or equal to another numeric value/reference. */
  le(value: HelmValueRef<unknown> | number): HelmCondition;

  /** Negate the truthiness of the referenced Helm value. */
  not(): HelmCondition;
  /** Combine the referenced value with another condition using Helm `and`. */
  and(other: HelmCondition): HelmCondition;
  /** Combine the referenced value with another condition using Helm `or`. */
  or(other: HelmCondition): HelmCondition;

  /** Apply Helm `default` while preserving the referenced value type. */
  default(defaultValue: HelmValueRef<unknown> | HelmScalar): HelmValueRef<T>;
  /** Pipe the value through `quote`. */
  quote(): HelmValueRef<string>;
  /** Pipe the value through `upper`. */
  upper(): HelmValueRef<string>;
  /** Pipe the value through `lower`. */
  lower(): HelmValueRef<string>;
  /** Pipe the value through `title`. */
  title(): HelmValueRef<string>;
  /** Pipe the value through `trim`. */
  trim(): HelmValueRef<string>;
  /** Remove a prefix with Sprig `trimPrefix`. */
  trimPrefix(prefix: string): HelmValueRef<string>;
  /** Remove a suffix with Sprig `trimSuffix`. */
  trimSuffix(suffix: string): HelmValueRef<string>;
  /** Replace string occurrences with Sprig `replace`. */
  replace(old: string, newStr: string): HelmValueRef<string>;
  /** Test whether the referenced string contains a substring. */
  contains(substr: string): HelmCondition;
  /** Test whether the referenced string starts with a prefix. */
  hasPrefix(prefix: string): HelmCondition;
  /** Test whether the referenced string ends with a suffix. */
  hasSuffix(suffix: string): HelmCondition;
  /** Truncate the referenced string to the requested length. */
  trunc(length: number): HelmValueRef<string>;

  /** Test the Helm runtime kind of the referenced value. */
  kindIs(kind: 'string' | 'slice' | 'map' | 'bool' | 'int' | 'float'): HelmCondition;
  /** Test whether the referenced map contains a key. */
  hasKey(key: string): HelmCondition;

  /** Serialize the referenced value with Helm `toYaml`. */
  toYaml(): HelmValueRef<string>;
  /** Serialize the referenced value with Helm `toJson`. */
  toJson(): HelmValueRef<string>;
  /** Apply Helm/Sprig `nindent`. */
  nindent(spaces: number): HelmValueRef<string>;
  /** Apply Helm/Sprig `indent`. */
  indent(spaces: number): HelmValueRef<string>;
  /** Convert the proxy to Timonel's lower-level HelmExpression marker. */
  toExpression(): HelmExpression;

  /**
   * Conditionally include a field value during Helm rendering.
   * @param condition - Helm condition or value whose truthiness controls inclusion
   * @param thenValue - Value emitted when the condition succeeds
   */
  if<V>(condition: HelmCondition | HelmValueRef<unknown>, thenValue: V): HelmFieldConditional<V>;

  /**
   * Build a Helm ternary expression.
   * @param condition - Condition selecting between the two values
   * @param thenValue - Value returned when the condition is true
   * @param elseValue - Value returned when the condition is false
   */
  ifElse<V extends HelmValueRef<unknown> | HelmScalar>(
    condition: HelmCondition,
    thenValue: V,
    elseValue: V,
  ): HelmValueRef<V extends HelmValueRef<infer U> ? U : V>;

  /**
   * Create a typed Helm `range` block over an array value.
   * @param callback - Callback receiving typed item and index proxies
   */
  range<V>(
    callback: (item: HelmValueRef<ArrayElement<T>>, index: HelmValueRef<number>) => V,
  ): HelmRange<V, ArrayElement<T>>;

  /**
   * Create a Helm `with` block scoped to the referenced value.
   * @param callback - Callback receiving a proxy rooted at Helm `.` within the block
   */
  with<V>(callback: (ctx: HelmValueRef<T>) => V): HelmWith<V, T>;
}

/** Represents a composable Helm boolean condition. */
export interface HelmCondition {
  /** Internal runtime marker used by Timonel serializers. */
  [HELM_VALUE_SYMBOL]: true;
  /** Raw Helm condition body without template delimiters. */
  __condition: string;
  /** Negate this condition. */
  not(): HelmCondition;
  /** Combine this condition with another using Helm `and`. */
  and(other: HelmCondition): HelmCondition;
  /** Combine this condition with another using Helm `or`. */
  or(other: HelmCondition): HelmCondition;
  /** Return the raw Helm condition body. */
  toString(): string;
}

/** Represents a field-level conditional consumed by the Helm YAML serializer. */
export interface HelmFieldConditional<T> {
  /** Runtime marker for serializer detection. */
  __helmFieldConditional: true;
  /** Condition controlling whether the field is emitted. */
  condition: HelmCondition;
  /** Field value emitted when the condition succeeds. */
  thenValue: T;
  /** Optional compatibility else value. */
  elseValue?: T;
}

/** Represents a typed Helm `range` block. */
export interface HelmRange<T, TItem = unknown> {
  /** Runtime marker for serializer detection. */
  __helmRange: true;
  /** Array value being iterated. */
  source: HelmValueRef<readonly TItem[]>;
  /** Callback used by the serializer with scoped item/index proxies. */
  callback: (item: HelmValueRef<TItem>, index: HelmValueRef<number>) => T;
}

/** Represents a typed Helm `with` block. */
export interface HelmWith<T, TContext = unknown> {
  /** Runtime marker for serializer detection. */
  __helmWith: true;
  /** Value that becomes the Helm `.` scope. */
  source: HelmValueRef<TContext>;
  /** Callback used by the serializer with a scoped context proxy. */
  callback: (ctx: HelmValueRef<TContext>) => T;
}

/** Helper context for Helm built-ins exposed on the root `ValuesRef`. */
export interface HelmHelpers {
  /** Render Helm `include` for a named template and context. */
  include(templateName: string, context?: '.' | HelmValueRef<unknown>): HelmValueRef<string>;
  /** Render Helm `printf` with typed value references or scalar arguments. */
  printf(
    format: string,
    ...args: Array<HelmValueRef<unknown> | string | number>
  ): HelmValueRef<string>;
  /** References to Helm `.Release` built-ins. */
  release: {
    name: HelmValueRef<string>;
    namespace: HelmValueRef<string>;
    service: HelmValueRef<string>;
    isUpgrade: HelmValueRef<boolean>;
    isInstall: HelmValueRef<boolean>;
    revision: HelmValueRef<number>;
  };
  /** References to Helm `.Chart` built-ins. */
  chart: {
    name: HelmValueRef<string>;
    version: HelmValueRef<string>;
    appVersion: HelmValueRef<string>;
    type: HelmValueRef<string>;
  };
  /** References to selected Helm `.Capabilities` built-ins. */
  capabilities: {
    kubeVersion: {
      version: HelmValueRef<string>;
      major: HelmValueRef<string>;
      minor: HelmValueRef<string>;
    };
    apiVersions: {
      /** Test whether the target cluster advertises a Kubernetes API version. */
      has(apiVersion: string): HelmCondition;
    };
  };
  /** Escape hatch for conditions that cannot be expressed through typed helpers. */
  rawCondition(condition: string): HelmCondition;
}

/** Escape a JavaScript string as a Helm double-quoted string literal. */
function helmStringLiteral(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Convert a typed Helm reference or scalar into a Helm expression argument. */
function serializeValue(value: HelmValueRef<unknown> | HelmScalar): string {
  if (isHelmValue(value)) {
    return value.__path;
  }
  return typeof value === 'string' ? helmStringLiteral(value) : String(value);
}

/** Append a property segment while preserving scoped `.` semantics. */
function appendPropertyPath(path: string, property: string): string {
  return path === '.' ? `.${property}` : `${path}.${property}`;
}

/** Create a validated, composable Helm condition marker. */
function createCondition(condition: string): HelmCondition {
  if (!condition || typeof condition !== 'string') {
    throw new Error('Condition must be a non-empty string');
  }

  return {
    [HELM_VALUE_SYMBOL]: true,
    __condition: condition,
    /** Negate the current condition. */
    not() {
      return createCondition(`not (${this.__condition})`);
    },
    /** Combine the current condition with another using Helm `and`. */
    and(other: HelmCondition) {
      if (!other || typeof other.__condition !== 'string') {
        throw new Error('Invalid HelmCondition provided to and()');
      }
      return createCondition(`and (${this.__condition}) (${other.__condition})`);
    },
    /** Combine the current condition with another using Helm `or`. */
    or(other: HelmCondition) {
      if (!other || typeof other.__condition !== 'string') {
        throw new Error('Invalid HelmCondition provided to or()');
      }
      return createCondition(`or (${this.__condition}) (${other.__condition})`);
    },
    /** Return the raw condition body. */
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
    /** Expose only Timonel's internal marker through the Proxy `in` trap. */
    has(_target, prop) {
      return prop === HELM_VALUE_SYMBOL;
    },
    /** Resolve helper methods, runtime markers, and nested typed property proxies. */
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
    /** Implement the root Helm `include` helper. */
    include(templateName: string, context: '.' | HelmValueRef<unknown> = '.') {
      const ctx = context === '.' ? '.' : context.__path;
      return createHelmValueProxy<string>(`(include ${helmStringLiteral(templateName)} ${ctx})`);
    },
    /** Implement the root Helm `printf` helper. */
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
        /** Test `.Capabilities.APIVersions` for an advertised API. */
        has(apiVersion: string) {
          return createCondition(`.Capabilities.APIVersions.Has ${helmStringLiteral(apiVersion)}`);
        },
      },
    },
    /** Build a condition from a caller-supplied Helm condition body. */
    rawCondition(condition: string) {
      return createCondition(condition);
    },
  };

  return new Proxy(values, {
    /** Route reserved root helper names before delegating to the values proxy. */
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
