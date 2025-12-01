/**
 * @fileoverview Helm template control structure helpers
 * Provides type-safe, composable helpers for Helm template constructs
 * @since 2.14.0
 */

/**
 * Base interface for all Helm constructs
 * Used by the serializer to detect and handle Helm template structures
 */
export interface HelmConstruct {
  __helmConstruct: true;
  type:
    | 'if'
    | 'range'
    | 'with'
    | 'include'
    | 'define'
    | 'var'
    | 'block'
    | 'comment'
    | 'fragment'
    | 'fieldConditional';
  data: unknown;
  options?: HelmWhitespaceOptions;
}

/**
 * Creates a Helm fragment (composite of multiple contents).
 * Useful for combining multiple constructs (e.g. multiple if blocks) into a single field value.
 * @param contents List of Helm content to combine
 * @returns HelmConstruct of type 'fragment'
 */
export function helmFragment(...contents: HelmContent[]): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'fragment',
    data: contents,
  };
}

/**
 * Represents a Helm template expression marker.
 * Prevents quoting of Helm expressions (legacy concept, now handled via scalar types).
 * @since 2.9.2
 */
export interface HelmExpression {
  __helmExpression: true;
  value: string;
}

/**
 * Creates a Helm expression marker.
 * @param value Helm template expression string.
 * @returns Helm expression marker object.
 * @since 2.9.2
 */
export function createHelmExpression(value: string): HelmExpression {
  return {
    __helmExpression: true,
    value,
  };
}

/**
 * Checks if a value is a Helm expression marker.
 * @param value Value to check.
 * @returns True if value is a Helm expression marker.
 * @since 2.9.2
 */
export function isHelmExpression(value: unknown): value is HelmExpression {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__helmExpression' in value &&
    (value as HelmExpression).__helmExpression === true
  );
}

/**
 * Creates a Helm range (iteration) block.
 *
 * @param vars - Variable(s) to bind (e.g., 'item', '$key, $value', '$index, $item')
 * @param collection - Helm expression for the collection to iterate (e.g., '.Values.items')
 * @param content - Content to repeat for each iteration
 * @param options - Whitespace control options
 * @returns HelmConstruct of type 'range'
 *
 * helmRange('$key, $value', '.Values.secrets', {
 *   [helmVar('$key')]: helmVar('$value')]
 * })
 */
export function helmRange(
  vars: string,
  collection: string,
  content: HelmContent,
  options?: HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'range',
    data: {
      vars,
      collection,
      content,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Creates a Helm with block (scope/context switching).
 *
 * @param scope - Helm expression for the scope to switch to (e.g., '.Values.database')
 * @param content - Content to execute with the new scope (where '.' refers to the scope)
 * @param options - Whitespace control options
 * @returns HelmConstruct of type 'with'
 *
 * @example
 * // Simplify nested object access
 * helmWith('.Values.database', {
 *   host: helm('{{ .host }}'),
 *   port: helm('{{ .port }}'),
 *   username: helm('{{ .username }}')
 * })
 */
export function helmWith(
  scope: string,
  content: HelmContent,
  options?: HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'with',
    data: {
      scope,
      content,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Creates a Helm include statement (template inclusion).
 *
 * @param templateName - Name of the template to include (e.g., 'myapp.labels')
 * @param scope - Scope to pass to the template (usually '.')
 * @param pipe - Optional pipe operations (e.g., 'nindent 4', 'quote')
 * @param options - Whitespace control options
 * @returns HelmConstruct of type 'include'
 *
 * @example
 * helmInclude('myapp.labels', '.', { pipe: 'nindent 4' })
 * // Output: {{ include "myapp.labels" . | nindent 4 }}
 */
export function helmInclude(
  templateName: string,
  scope: string = '.',
  options?: { pipe?: string } & HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'include',
    data: {
      templateName,
      scope,
      pipe: options?.pipe,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Creates a Helm define block (template definition).
 *
 * @param name - Name of the template
 * @param content - Template content
 * @param options - Whitespace control options
 * @returns HelmConstruct of type 'define'
 *
 * @example
 * helmDefine('myapp.labels', {
 *   'app.kubernetes.io/name': helm('{{ .Chart.Name }}'),
 *   'app.kubernetes.io/instance': helm('{{ .Release.Name }}')
 * })
 */
export function helmDefine(
  name: string,
  content: HelmContent,
  options?: HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'define',
    data: {
      name,
      content,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Creates a Helm variable assignment.
 *
 * @param name - Variable name (with $ prefix)
 * @param value - Value to assign
 * @param options - Whitespace control options
 * @returns HelmConstruct of type 'var'
 *
 * @example
 * helmVar('$fullName', 'include "myapp.fullname" .')
 * // Output: {{ $fullName := include "myapp.fullname" . }}
 */
export function helmVar(
  name: string,
  value: string,
  options?: HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'var',
    data: {
      name,
      value,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Creates a Helm block (named template block).
 *
 * @param name - Block name
 * @param content - Block content
 * @param options - Whitespace control options
 * @returns HelmConstruct of type 'block'
 *
 * @example
 * helmBlock('myapp.config', { key: 'value' })
 */
export function helmBlock(
  name: string,
  content: HelmContent,
  options?: HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'block',
    data: {
      name,
      content,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Creates a Helm comment block.
 *
 * @param text - Comment text
 * @returns HelmConstruct of type 'comment'
 *
 * @example
 * helmComment('This is a template comment')
 * // Output: (curly-brace-slash-star) This is a template comment (star-slash-curly-brace)
 */
export function helmComment(text: string): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'comment',
    data: { text },
  };
}

export type HelmContent =
  | string
  | number
  | boolean
  | null
  | undefined
  | HelmConstruct
  | HelmExpression
  | { [key: string]: HelmContent }
  | HelmContent[];

/**
 * Options for whitespace control in Helm templates
 */
export interface HelmWhitespaceOptions {
  /** Trim whitespace to the left of the construct ({{-) */
  trimLeft?: boolean;
  /** Trim whitespace to the right of the construct (-}}) */
  trimRight?: boolean;
  /** Render as inline (no newlines) */
  inline?: boolean;
}

/**
 * Conditional rendering helper (if/else)
 *
 * @param condition - Helm template condition expression (e.g., '.Values.enabled')
 * @param thenContent - Content to render if condition is true
 * @param elseContent - Optional content to render if condition is false
 * @param options - Whitespace control options
 * @returns HelmConstruct representing the if/else block
 *
 * @example
 * // Simple if
 * helmIf('.Values.enabled', { replicas: 3 })
 * // Output: {{- if .Values.enabled }}
 * //         replicas: 3
 * //         {{- end }}
 *
 * @example
 * // If-else
 * helmIf('.Values.production',
 *   { replicas: 5 },
 *   { replicas: 1 }
 * )
 * // Output: {{- if .Values.production }}
 * //         replicas: 5
 * //         {{- else }}
 * //         replicas: 1
 * //         {{- end }}
 *
 * @example
 * // Nested with range
 * helmIf('.Values.enabled', [
 *   helmRange('$item', '.Values.items', {
 *     name: '{{ $item.name }}',
 *     value: '{{ $item.value }}'
 *   })
 * ])
 *
 * @since 2.14.0
 */
export function helmIf(
  condition: string,
  thenContent: HelmContent,
  elseContent?: HelmContent,
  options?: HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'if',
    data: {
      condition,
      then: thenContent,
      else: elseContent,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Creates a simple Helm if block without else (field-level conditional).
 * This is specifically designed for conditionally including entire fields.
 * When used as a field value, it wraps the field (key + value) in the conditional.
 *
 * @param condition - Helm template condition expression (e.g., '.Values.enabled')
 * @param thenContent - Content to render if condition is true
 * @param options - Whitespace control options
 * @returns HelmConstruct representing the if block that wraps the field
 *
 * @example
 * // Conditionally include replicas field
 * {
 *   spec: {
 *     replicas: helmIfSimple('not .Values.autoscaling.enabled', helm('{{ .Values.replicaCount }}'))
 *   }
 * }
 * // Output:
 * // spec:
 * //   {{- if not .Values.autoscaling.enabled }}
 * //     replicas: {{ .Values.replicaCount }}
 * //   {{- end }}
 *
 * @since 2.14.0
 */
export function helmIfSimple(
  condition: string,
  thenContent: HelmContent,
  options?: HelmWhitespaceOptions,
): HelmConstruct {
  return {
    __helmConstruct: true,
    type: 'if',
    data: {
      condition,
      then: thenContent,
      // Explicitly set else to undefined to mark this as a field-level conditional
      else: undefined,
    },
    ...(options ? { options } : {}),
  };
}

/**
 * Check if a value is a HelmConstruct
 */
export function isHelmConstruct(value: unknown): value is HelmConstruct {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__helmConstruct' in value &&
    (value as HelmConstruct).__helmConstruct === true
  );
}
