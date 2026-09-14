/**
 * @fileoverview Validation rules for Helm helper templates.
 * @since 3.1.3
 */

const RESOURCE_KEYS = ['apiVersion', 'kind', 'metadata'] as const;
type ResourceKey = (typeof RESOURCE_KEYS)[number];

function resourceKeyLinePattern(key: ResourceKey): RegExp {
  switch (key) {
    case 'apiVersion':
      return /(?:^|\n)\s*apiVersion\s*:/;
    case 'kind':
      return /(?:^|\n)\s*kind\s*:/;
    case 'metadata':
      return /(?:^|\n)\s*metadata\s*:/;
  }
}

interface HelperScope {
  readonly name?: string;
  readonly body: string;
}

interface DefinedScopes {
  readonly scopes: HelperScope[];
  readonly ranges: Array<[number, number]>;
}

interface HelmAction {
  readonly action: string;
  readonly start: number;
  readonly end: number;
}

/** Scan Helm actions in linear time without regex backtracking. */
function helmActions(source: string): HelmAction[] {
  const actions: HelmAction[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('{{', cursor);
    if (start < 0) break;
    const close = source.indexOf('}}', start + 2);
    if (close < 0) break;
    const raw = source.slice(start + 2, close);
    actions.push({ action: raw.replace(/^-/, '').replace(/-$/, '').trim(), start, end: close + 2 });
    cursor = close + 2;
  }
  return actions;
}

/** Decode the common escape sequences accepted in double-quoted Helm/Go template strings. */
function decodeQuotedString(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const current = value.charAt(index);
    if (current !== '\\' || index + 1 >= value.length) {
      result += current;
      continue;
    }

    const next = value.charAt(index + 1);
    index += 1;
    if (next === 'n') result += '\n';
    else if (next === 'r') result += '\r';
    else if (next === 't') result += '\t';
    else if (next === '"') result += '"';
    else if (next === '\\') result += '\\';
    else result += next;
  }
  return result;
}

/** Extract quoted string literals from a Helm action. */
function quotedStrings(action: string): string[] {
  const values: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"|`([^`]*)`/g;
  for (const match of action.matchAll(pattern)) {
    values.push(match[1] !== undefined ? decodeQuotedString(match[1]) : (match[2] ?? ''));
  }
  return values;
}

/** Resolve simple constant Helm expressions used as dynamic YAML mapping keys. */
function resolveConstantAction(action: string, variables: Map<string, string>): string | undefined {
  const expression = action
    .trim()
    .replace(/^-|-$|\s+/g, ' ')
    .trim();
  if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(expression)) {
    return variables.get(expression.slice(1));
  }

  const direct = expression.match(/^(?:"((?:\\.|[^"\\])*)"|`([^`]*)`)$/);
  if (direct) return (direct[1] ?? direct[2] ?? '').replace(/\\"/g, '"');
  if (expression.startsWith('print ')) return quotedStrings(expression.slice(6)).join('');
  if (!expression.startsWith('printf ')) return undefined;

  const strings = quotedStrings(expression.slice(7));
  const [format, ...args] = strings;
  if (!format) return undefined;
  let index = 0;
  return format.replace(/%s/g, () => args[index++] ?? '');
}

/** Strip comments that must not contribute resource markers. */
function stripComments(template: string): string {
  let result = '';
  let cursor = 0;
  for (const token of helmActions(template)) {
    result += template.slice(cursor, token.start);
    if (!token.action.startsWith('/*')) result += template.slice(token.start, token.end);
    cursor = token.end;
  }
  result += template.slice(cursor);
  return result
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

/** Return a helper definition name when an action opens a `define` block. */
function defineName(action: string): string | undefined {
  return action.match(/^define\s+"([^"]+)"/)?.[1];
}

/** Return whether an action opens a nested Helm control block. */
function opensBlock(action: string): boolean {
  return /^(?:define|if|range|with|block)\b/.test(action);
}

/** Add one completed helper scope while respecting exact optional property types. */
function addScope(scopes: HelperScope[], name: string | undefined, body: string): void {
  scopes.push(name === undefined ? { body } : { name, body });
}

/** Extract balanced `define` scopes from complete `_helpers.tpl` content. */
function collectDefinedScopes(template: string): DefinedScopes {
  const scopes: HelperScope[] = [];
  const ranges: Array<[number, number]> = [];
  let depth = 0;
  let bodyStart = -1;
  let rangeStart = -1;
  let name: string | undefined;

  for (const token of helmActions(template)) {
    const action = token.action;
    const matchStart = token.start;
    const matchEnd = token.end;

    if (depth === 0) {
      const nextName = defineName(action);
      if (nextName === undefined) continue;
      depth = 1;
      name = nextName;
      bodyStart = matchEnd;
      rangeStart = matchStart;
      continue;
    }

    if (opensBlock(action)) {
      depth += 1;
      continue;
    }
    if (!/^end\b/.test(action)) continue;

    depth -= 1;
    if (depth !== 0 || bodyStart < 0) continue;
    addScope(scopes, name, template.slice(bodyStart, matchStart));
    ranges.push([rangeStart, matchEnd]);
    bodyStart = -1;
    rangeStart = -1;
    name = undefined;
  }

  return { scopes, ranges };
}

/** Return content that lives outside balanced `define` blocks. */
function outsideDefinedScopes(template: string, ranges: Array<[number, number]>): string {
  const parts: string[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    parts.push(template.slice(cursor, start));
    cursor = end;
  }
  parts.push(template.slice(cursor));
  return parts.join('\n').trim();
}

/** Split complete `_helpers.tpl` content into independently validated scopes. */
function splitHelperScopes(template: string): HelperScope[] {
  const defined = collectDefinedScopes(template);
  if (defined.scopes.length === 0) return [{ body: template }];

  const outside = outsideDefinedScopes(template, defined.ranges);
  return outside ? [...defined.scopes, { body: outside }] : defined.scopes;
}

/** Collect constant string variables declared by Helm actions. */
function collectConstantVariables(source: string): Map<string, string> {
  const variables = new Map<string, string>();
  for (const token of helmActions(source)) {
    const action = token.action;
    const assignment = action.match(/^\$([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|=)\s*(.+)$/);
    const variableName = assignment?.[1];
    const expression = assignment?.[2];
    if (variableName === undefined || expression === undefined) continue;
    const value = resolveConstantAction(expression, variables);
    if (value !== undefined) variables.set(variableName, value);
  }
  return variables;
}

/** Add resource markers emitted by actions whose result can be resolved statically. */
function collectConstantActionOutputKeys(
  source: string,
  variables: Map<string, string>,
  keys: Set<ResourceKey>,
): void {
  for (const token of helmActions(source)) {
    const output = resolveConstantAction(token.action, variables);
    if (output === undefined) continue;
    for (const key of RESOURCE_KEYS) {
      if (resourceKeyLinePattern(key).test(output)) keys.add(key);
    }
  }
}

/** Add literal YAML resource-key markers. */
function collectLiteralYamlKeys(source: string, keys: Set<ResourceKey>): void {
  const pattern = /^\s*(apiVersion|kind|metadata)\s*:/gm;
  for (const match of source.matchAll(pattern)) keys.add(match[1] as ResourceKey);
}

/** Add resource keys emitted through constant Helm mapping-key expressions. */
function collectDynamicYamlKeys(
  source: string,
  variables: Map<string, string>,
  keys: Set<ResourceKey>,
): void {
  for (const token of helmActions(source)) {
    let cursor = token.end;
    while (cursor < source.length && /\s/.test(source.charAt(cursor))) cursor += 1;
    if (source.charAt(cursor) !== ':') continue;
    const resolved = resolveConstantAction(token.action, variables);
    if (RESOURCE_KEYS.includes(resolved as ResourceKey)) keys.add(resolved as ResourceKey);
  }
}

/** Detect Kubernetes resource keys emitted by one helper scope. */
function emittedResourceKeys(template: string): Set<ResourceKey> {
  const source = stripComments(template);
  const keys = new Set<ResourceKey>();
  const variables = collectConstantVariables(source);
  collectConstantActionOutputKeys(source, variables, keys);
  collectLiteralYamlKeys(source, keys);
  collectDynamicYamlKeys(source, variables, keys);
  return keys;
}

/** Return whether one helper scope emits all structural resource keys. */
function scopeEmitsResource(scope: HelperScope): boolean {
  const keys = emittedResourceKeys(scope.body);
  return RESOURCE_KEYS.every((key) => keys.has(key));
}

/**
 * Detects whether a helper template is being used to emit a Kubernetes resource.
 *
 * Multiple `define` blocks are evaluated independently so harmless fragments cannot combine their
 * keys into a false positive. Simple dynamic mapping keys are resolved as well, preventing helpers
 * from hiding resource keys behind Helm variables or constant `print`/`printf` expressions.
 *
 * @param template - Helm helper template body or complete `_helpers.tpl` content to inspect.
 * @returns True when one helper scope contains the structural markers of a Kubernetes manifest.
 * @since 3.1.3
 */
export function isKubernetesManifestHelper(template: string): boolean {
  return splitHelperScopes(template).some(scopeEmitsResource);
}

/**
 * Rejects helper templates that embed complete Kubernetes resources.
 *
 * @param template - Helm helper template body or complete `_helpers.tpl` content to validate.
 * @param helperName - Optional helper name used to improve the error message.
 * @throws {Error} When any individual helper scope contains a Kubernetes manifest.
 * @since 3.1.3
 */
export function assertTypedHelperTemplate(template: string, helperName?: string): void {
  const offendingScope = splitHelperScopes(template).find(scopeEmitsResource);
  if (!offendingScope) return;

  const name = helperName ?? offendingScope.name;
  const helper = name ? ` '${name}'` : '';
  throw new Error(
    `Helm helper${helper} cannot contain a Kubernetes manifest. ` +
      'Create the resource with typed cdk8s/cdk8s-plus constructs on Rutter.getChart() instead.',
  );
}
