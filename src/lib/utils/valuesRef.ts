/**
 * Type-safe Helm values reference system
 * Creates proxy objects that generate Helm template expressions
 *
 * @example
 * const v = valuesRef<MyValues>();
 * v.replicaCount                    // {{ .Values.replicaCount }}
 * v.image.repository                // {{ .Values.image.repository }}
 * v.autoscaling.enabled.not()       // not .Values.autoscaling.enabled
 * v.if(v.enabled, v.count)          // {{- if .Values.enabled }}{{ .Values.count }}{{- end }}
 */

import { createHelmExpression, type HelmExpression } from './helmControlStructures.js';

// Symbol to identify HelmValue objects
const HELM_VALUE_SYMBOL = Symbol('HelmValue');

/**
 * Represents a reference to a Helm value that can be used in templates
 */
export interface HelmValue<T = unknown> {
  [HELM_VALUE_SYMBOL]: true;
  __path: string;
  __type?: T;

  // Comparison operators
  eq(value: HelmValue | string | number | boolean): HelmCondition;
  ne(value: HelmValue | string | number | boolean): HelmCondition;
  gt(value: HelmValue | number): HelmCondition;
  ge(value: HelmValue | number): HelmCondition;
  lt(value: HelmValue | number): HelmCondition;
  le(value: HelmValue | number): HelmCondition;

  // Logical operators (for boolean values)
  not(): HelmCondition;
  and(other: HelmCondition): HelmCondition;
  or(other: HelmCondition): HelmCondition;

  // String/value functions
  default(defaultValue: HelmValue | string | number | boolean): HelmValue<T>;
  quote(): HelmValue<string>;
  upper(): HelmValue<string>;
  lower(): HelmValue<string>;
  title(): HelmValue<string>;
  trim(): HelmValue<string>;
  trimPrefix(prefix: string): HelmValue<string>;
  trimSuffix(suffix: string): HelmValue<string>;
  replace(old: string, newStr: string): HelmValue<string>;
  contains(substr: string): HelmCondition;
  hasPrefix(prefix: string): HelmCondition;
  hasSuffix(suffix: string): HelmCondition;

  // Number functions
  trunc(length: number): HelmValue<string>;

  // Type checking
  kindIs(kind: 'string' | 'slice' | 'map' | 'bool' | 'int' | 'float'): HelmCondition;
  hasKey(key: string): HelmCondition;

  // YAML functions
  toYaml(): HelmValue<string>;
  toJson(): HelmValue<string>;
  nindent(spaces: number): HelmValue<string>;
  indent(spaces: number): HelmValue<string>;

  // Convert to HelmExpression for use in manifests
  toExpression(): HelmExpression;

  // For field-level conditionals
  if<V>(condition: HelmCondition, thenValue: V): HelmFieldConditional<V>;
  ifElse<V>(condition: HelmCondition, thenValue: V, elseValue: V): HelmValue<V>;

  // Range over arrays
  range<V>(
    callback: (item: HelmValue<T extends (infer U)[] ? U : unknown>, index: HelmValue<number>) => V,
  ): HelmRange<V>;

  // With context
  with<V>(callback: (ctx: HelmValue<T>) => V): HelmWith<V>;
}

/**
 * Represents a Helm condition (boolean expression)
 */
export interface HelmCondition {
  [HELM_VALUE_SYMBOL]: true;
  __condition: string;

  // Logical operators
  not(): HelmCondition;
  and(other: HelmCondition): HelmCondition;
  or(other: HelmCondition): HelmCondition;

  // Convert to string for use in templates
  toString(): string;
}

/**
 * Represents a field-level conditional
 */
export interface HelmFieldConditional<T> {
  __helmFieldConditional: true;
  condition: HelmCondition;
  thenValue: T;
  elseValue?: T;
}

/**
 * Represents a range loop
 */
export interface HelmRange<T> {
  __helmRange: true;
  source: HelmValue;
  callback: (item: HelmValue, index: HelmValue<number>) => T;
}

/**
 * Represents a with block
 */
export interface HelmWith<T> {
  __helmWith: true;
  source: HelmValue;
  callback: (ctx: HelmValue) => T;
}

/**
 * Helper context for includes, printf, etc.
 */
export interface HelmHelpers {
  // Include a named template
  include(templateName: string, context?: '.' | HelmValue): HelmValue<string>;

  // Printf formatting
  printf(format: string, ...args: (HelmValue | string | number)[]): HelmValue<string>;

  // Access to special Helm objects
  release: {
    name: HelmValue<string>;
    namespace: HelmValue<string>;
    service: HelmValue<string>;
    isUpgrade: HelmValue<boolean>;
    isInstall: HelmValue<boolean>;
    revision: HelmValue<number>;
  };

  chart: {
    name: HelmValue<string>;
    version: HelmValue<string>;
    appVersion: HelmValue<string>;
    type: HelmValue<string>;
  };

  capabilities: {
    kubeVersion: {
      version: HelmValue<string>;
      major: HelmValue<string>;
      minor: HelmValue<string>;
    };
    apiVersions: {
      has(apiVersion: string): HelmCondition;
    };
  };

  // Create a raw condition from string (escape hatch, but documented)
  rawCondition(condition: string): HelmCondition;
}

// Helper to serialize a value to Helm template string
function serializeValue(value: HelmValue | string | number | boolean): string {
  if (typeof value === 'object' && value !== null && HELM_VALUE_SYMBOL in value) {
    return (value as HelmValue).__path;
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}

// Create a HelmCondition object
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

// Create a HelmValue proxy
function createValueProxy<T>(path: string): HelmValue<T> {
  // Create a base object that has the HelmExpression structure
  // This allows cdk8s to serialize it correctly
  // The properties MUST be directly on the object for cdk8s to see them
  const baseObject = Object.create(null) as HelmValue<T> & {
    __helmExpression: true;
    value: string;
  };
  baseObject.__helmExpression = true;
  baseObject.value = `{{ ${path} }}`;

  const handler: ProxyHandler<typeof baseObject> = {
    // Make properties enumerable for JSON.stringify and cdk8s
    ownKeys() {
      return ['__helmExpression', 'value'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === '__helmExpression') {
        return { value: true, writable: false, enumerable: true, configurable: true };
      }
      if (prop === 'value') {
        return { value: `{{ ${path} }}`, writable: false, enumerable: true, configurable: true };
      }
      return undefined;
    },
    // Handle 'in' operator for isHelmValue check
    has(target, prop) {
      if (prop === HELM_VALUE_SYMBOL) return true;
      if (prop === '__helmExpression') return true;
      if (prop === 'value') return true;
      return false;
    },
    get(target, prop: string | symbol) {
      // Handle symbol properties
      if (prop === HELM_VALUE_SYMBOL) return true;
      if (prop === '__path') return path;
      if (prop === '__type') return undefined;

      // For cdk8s serialization - expose HelmExpression properties
      if (prop === '__helmExpression') return true;
      if (prop === 'value') return `{{ ${path} }}`;

      // Handle JSON serialization (for cdk8s)
      if (prop === 'toJSON') {
        return () => ({ __helmExpression: true, value: `{{ ${path} }}` });
      }

      // Handle built-in methods
      if (typeof prop === 'string') {
        switch (prop) {
          // Comparison operators
          case 'eq':
            return (value: HelmValue | string | number | boolean) =>
              createCondition(`eq ${path} ${serializeValue(value)}`);
          case 'ne':
            return (value: HelmValue | string | number | boolean) =>
              createCondition(`ne ${path} ${serializeValue(value)}`);
          case 'gt':
            return (value: HelmValue | number) =>
              createCondition(`gt ${path} ${serializeValue(value)}`);
          case 'ge':
            return (value: HelmValue | number) =>
              createCondition(`ge ${path} ${serializeValue(value)}`);
          case 'lt':
            return (value: HelmValue | number) =>
              createCondition(`lt ${path} ${serializeValue(value)}`);
          case 'le':
            return (value: HelmValue | number) =>
              createCondition(`le ${path} ${serializeValue(value)}`);

          // Logical operators
          case 'not':
            return () => createCondition(`not ${path}`);
          case 'and':
            return (other: HelmCondition) => createCondition(`and ${path} (${other.__condition})`);
          case 'or':
            return (other: HelmCondition) => createCondition(`or ${path} (${other.__condition})`);

          // String/value functions
          case 'default':
            return (defaultValue: HelmValue | string | number | boolean) =>
              createValueProxy<T>(`${path} | default ${serializeValue(defaultValue)}`);
          case 'quote':
            return () => createValueProxy<string>(`(${path} | quote)`);
          case 'upper':
            return () => createValueProxy<string>(`(${path} | upper)`);
          case 'lower':
            return () => createValueProxy<string>(`(${path} | lower)`);
          case 'title':
            return () => createValueProxy<string>(`(${path} | title)`);
          case 'trim':
            return () => createValueProxy<string>(`(${path} | trim)`);
          case 'trimPrefix':
            return (prefix: string) =>
              createValueProxy<string>(`(${path} | trimPrefix "${prefix}")`);
          case 'trimSuffix':
            return (suffix: string) =>
              createValueProxy<string>(`(${path} | trimSuffix "${suffix}")`);
          case 'replace':
            return (old: string, newStr: string) =>
              createValueProxy<string>(`(${path} | replace "${old}" "${newStr}")`);
          case 'contains':
            return (substr: string) => createCondition(`contains "${substr}" ${path}`);
          case 'hasPrefix':
            return (prefix: string) => createCondition(`hasPrefix ${path} "${prefix}"`);
          case 'hasSuffix':
            return (suffix: string) => createCondition(`hasSuffix ${path} "${suffix}"`);

          // Number functions
          case 'trunc':
            return (length: number) => createValueProxy<string>(`(${path} | trunc ${length})`);

          // Type checking
          case 'kindIs':
            return (kind: string) => createCondition(`kindIs "${kind}" ${path}`);
          case 'hasKey':
            return (key: string) => createCondition(`hasKey ${path} "${key}"`);

          // YAML functions
          case 'toYaml':
            return () => createValueProxy<string>(`${path} | toYaml`);
          case 'toJson':
            return () => createValueProxy<string>(`${path} | toJson`);
          case 'nindent':
            return (spaces: number) => createValueProxy<string>(`${path} | nindent ${spaces}`);
          case 'indent':
            return (spaces: number) => createValueProxy<string>(`${path} | indent ${spaces}`);

          // Convert to HelmExpression
          case 'toExpression':
            return () => createHelmExpression(`{{ ${path} }}`);

          // Field-level conditional
          case 'if':
            return <V>(
              condition: HelmCondition | HelmValue,
              thenValue: V,
            ): HelmFieldConditional<V> => {
              // If condition is a HelmValue, convert it to a HelmCondition
              // In Helm, any value can be used as a condition (truthy check)
              let helmCondition: HelmCondition;
              if (isHelmCondition(condition)) {
                helmCondition = condition;
              } else if (isHelmValue(condition)) {
                // Use the value path directly as condition
                helmCondition = createCondition((condition as HelmValue).__path);
              } else {
                throw new Error(
                  'v.if() requires a HelmCondition or HelmValue as the first argument',
                );
              }
              return {
                __helmFieldConditional: true,
                condition: helmCondition,
                thenValue,
              };
            };

          case 'ifElse':
            return <V>(condition: HelmCondition, thenValue: V, elseValue: V): HelmValue<V> => {
              // This creates an inline if-else expression
              const condStr = condition.__condition;
              return createValueProxy<V>(
                `(ternary ${serializeValue(thenValue as unknown as HelmValue)} ${serializeValue(elseValue as unknown as HelmValue)} (${condStr}))`,
              );
            };

          // Range
          case 'range':
            return <V>(
              callback: (item: HelmValue, index: HelmValue<number>) => V,
            ): HelmRange<V> => ({
              __helmRange: true,
              source: createValueProxy<T>(path),
              callback,
            });

          // With
          case 'with':
            return <V>(callback: (ctx: HelmValue) => V): HelmExpression => {
              // Execute callback immediately with a proxy context
              const ctxProxy = { __path: '.', [HELM_VALUE_SYMBOL]: true } as HelmValue;
              const content = callback(ctxProxy);

              // Extract content string
              let contentStr: string;
              if (
                typeof content === 'object' &&
                content !== null &&
                '__helmExpression' in content
              ) {
                const helmExpr = content as unknown as HelmExpression;
                contentStr = helmExpr.value;
              } else {
                contentStr = String(content);
              }

              // Create a special marker for field-level with
              // Format: __FIELD_WITH_MARKER__:path:content
              const marker = `__FIELD_WITH_MARKER__:${path}:${contentStr}`;
              return createHelmExpression(marker);
            };

          // toString for template interpolation
          case 'toString':
            return () => `{{ ${path} }}`;

          // valueOf for primitive coercion
          case 'valueOf':
            return () => path;

          // Nested property access
          default:
            return createValueProxy(`${path}.${prop}`);
        }
      }

      return undefined;
    },
  };

  return new Proxy(baseObject, handler) as HelmValue<T>;
}

/**
 * Creates a type-safe reference to Helm values
 *
 * @example
 * interface MyValues {
 *   replicaCount: number;
 *   autoscaling: { enabled: boolean };
 * }
 *
 * const v = valuesRef<MyValues>();
 * v.replicaCount                    // {{ .Values.replicaCount }}
 * v.autoscaling.enabled.not()       // not .Values.autoscaling.enabled
 */
export function valuesRef<T extends Record<string, unknown>>(): HelmValue<T> & HelmHelpers {
  const values = createValueProxy<T>('.Values');

  // Add helper methods
  const helpers: HelmHelpers = {
    include(templateName: string, context: '.' | HelmValue = '.') {
      const ctx = context === '.' ? '.' : (context as HelmValue).__path;
      return createValueProxy<string>(`(include "${templateName}" ${ctx})`);
    },

    printf(format: string, ...args: (HelmValue | string | number)[]) {
      const argsStr = args
        .map((arg) => serializeValue(arg as HelmValue | string | number | boolean))
        .join(' ');
      return createValueProxy<string>(`(printf "${format}" ${argsStr})`);
    },

    release: {
      name: createValueProxy<string>('.Release.Name'),
      namespace: createValueProxy<string>('.Release.Namespace'),
      service: createValueProxy<string>('.Release.Service'),
      isUpgrade: createValueProxy<boolean>('.Release.IsUpgrade'),
      isInstall: createValueProxy<boolean>('.Release.IsInstall'),
      revision: createValueProxy<number>('.Release.Revision'),
    },

    chart: {
      name: createValueProxy<string>('.Chart.Name'),
      version: createValueProxy<string>('.Chart.Version'),
      appVersion: createValueProxy<string>('.Chart.AppVersion'),
      type: createValueProxy<string>('.Chart.Type'),
    },

    capabilities: {
      kubeVersion: {
        version: createValueProxy<string>('.Capabilities.KubeVersion.Version'),
        major: createValueProxy<string>('.Capabilities.KubeVersion.Major'),
        minor: createValueProxy<string>('.Capabilities.KubeVersion.Minor'),
      },
      apiVersions: {
        has(apiVersion: string) {
          return createCondition(`.Capabilities.APIVersions.Has "${apiVersion}"`);
        },
      },
    },

    rawCondition(condition: string) {
      return createCondition(condition);
    },
  };

  // Merge values proxy with helpers
  return new Proxy(values, {
    get(target, prop) {
      // Check helpers first
      if (prop in helpers) {
        // eslint-disable-next-line security/detect-object-injection
        return (helpers as unknown as Record<string | symbol, unknown>)[prop];
      }
      // Then delegate to values proxy
      // eslint-disable-next-line security/detect-object-injection
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    },
  }) as HelmValue<T> & HelmHelpers;
}

/**
 * Check if a value is a HelmValue
 */
export function isHelmValue(value: unknown): value is HelmValue {
  return typeof value === 'object' && value !== null && HELM_VALUE_SYMBOL in value;
}

/**
 * Check if a value is a HelmCondition
 */
export function isHelmCondition(value: unknown): value is HelmCondition {
  return (
    typeof value === 'object' &&
    value !== null &&
    HELM_VALUE_SYMBOL in value &&
    '__condition' in value
  );
}

/**
 * Check if a value is a HelmFieldConditional
 */
export function isHelmFieldConditional(value: unknown): value is HelmFieldConditional<unknown> {
  return typeof value === 'object' && value !== null && '__helmFieldConditional' in value;
}

/**
 * Check if a value is a HelmRange
 */
export function isHelmRange(value: unknown): value is HelmRange<unknown> {
  return typeof value === 'object' && value !== null && '__helmRange' in value;
}

/**
 * Check if a value is a HelmWith
 */
export function isHelmWith(value: unknown): value is HelmWith<unknown> {
  return typeof value === 'object' && value !== null && '__helmWith' in value;
}

/**
 * Serialize a HelmValue to its template string
 */
export function serializeHelmValue(value: HelmValue): string {
  return `{{ ${value.__path} }}`;
}

/**
 * Serialize a HelmCondition to its template string
 */
export function serializeHelmCondition(condition: HelmCondition): string {
  return condition.__condition;
}
