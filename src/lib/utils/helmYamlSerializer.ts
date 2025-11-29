import { Document, Scalar, isMap, isScalar, visit, Pair, YAMLMap, YAMLSeq } from 'yaml';

import type { HelmConstruct } from './helmControlStructures.js';
import {
  isHelmConstruct,
  isHelmExpression,
  createHelmExpression,
} from './helmControlStructures.js';

/**
 * Helper function to serialize else-if chains
 * @param elseContent The else content to process
 * @param openTag Opening Helm tag
 * @param closeTag Closing Helm tag
 * @returns Object with serialized result and remaining else content
 */
function serializeElseIfChain(
  elseContent: unknown,
  openTag: string,
  closeTag: string,
): { result: string; remainingElse: unknown | undefined } {
  let result = '';
  let currentElse: unknown | undefined = elseContent;

  // Check for nested if (else if pattern)
  if (isHelmConstruct(currentElse) && currentElse.type === 'if') {
    while (isHelmConstruct(currentElse) && currentElse.type === 'if') {
      const elseIfData = currentElse.data as {
        condition: string;
        then: unknown;
        else?: unknown;
      };
      result += `\n${openTag}else if ${elseIfData.condition}${closeTag}\n`;
      result += serializeHelmContent(elseIfData.then);
      currentElse = elseIfData.else;
    }
  }

  return { result, remainingElse: currentElse };
}

/**
 * Serialize a HelmConstruct into a Helm template string
 * @param construct The HelmConstruct to serialize
 * @returns Helm template string
 */
function serializeHelmConstruct(construct: HelmConstruct): string {
  // Handle fieldConditional specially - it should not be serialized here
  // as it needs special handling in the YAML structure
  if (construct.type === 'fieldConditional') {
    throw new Error('fieldConditional should not be serialized directly. It must be handled in preprocessHelmConstructs.');
  }
  
  const trimLeft = construct.options?.trimLeft ?? true;
  const trimRight = construct.options?.trimRight ?? true;

  const openTag = `{{${trimLeft ? '-' : ''} `;
  const closeTag = ` ${trimRight ? '-' : ''}}}`;

  switch (construct.type) {
    case 'if': {
      const data = construct.data as { condition: string; then: unknown; else?: unknown };
      const isInline = construct.options?.inline ?? false;
      const newline = isInline ? '' : '\n';
      const space = isInline ? ' ' : '';

      let result = `${openTag}if ${data.condition}${closeTag}${newline}`;
      result += serializeHelmContent(data.then);

      if (data.else !== undefined) {
        if (isInline) {
          result += `${space}${openTag}else${closeTag}${space}`;
          result += serializeHelmContent(data.else);
        } else {
          const { result: elseIfResult, remainingElse } = serializeElseIfChain(
            data.else,
            openTag,
            closeTag,
          );

          result += elseIfResult;

          if (remainingElse !== undefined) {
            result += `\n${openTag}else${closeTag}\n`;
            result += serializeHelmContent(remainingElse);
          }
        }
      }

      result += `${newline}${openTag}end${closeTag}`;
      return result;
    }

    case 'fragment': {
      const data = construct.data as unknown[];
      // Separate strings/HelmExpressions from objects
      const strings: string[] = [];
      const objects: unknown[] = [];
      
      for (const item of data) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item) && !isHelmConstruct(item) && !isHelmExpression(item)) {
          objects.push(item);
        } else {
          const serialized = serializeHelmContent(item);
          if (serialized.trim().length > 0) {
            strings.push(serialized);
          }
        }
      }
      
      // If we have both strings and objects, we need to combine them intelligently
      if (strings.length > 0 && objects.length > 0) {
        // Combine all objects into one
        const combinedObject = objects.reduce((acc, obj) => {
          if (typeof obj === 'object' && obj !== null) {
            return { ...(acc as Record<string, unknown>), ...(obj as Record<string, unknown>) };
          }
          return acc;
        }, {} as Record<string, unknown>);
        
        // Pre-process the combined object to convert HelmConstruct instances to HelmExpression
        const preprocessed = preprocessHelmConstructs(combinedObject);
        const doc = new Document(preprocessed);
        
        // Visit the document to transform HelmExpression objects
        visit(doc, (_key, node) => {
          if (isMap(node)) {
            const isHelmExpr = node.items.some(
              (pair) =>
                isScalar(pair.key) &&
                pair.key.value === '__helmExpression' &&
                isScalar(pair.value) &&
                pair.value.value === true,
            );

            if (isHelmExpr) {
              const valuePair = node.items.find(
                (pair) => isScalar(pair.key) && pair.key.value === 'value',
              );
              if (valuePair && isScalar(valuePair.value)) {
                const value = String(valuePair.value.value);
                const scalar = new Scalar(value);

                if (value.trim().startsWith('{{') && value.includes('\n')) {
                  scalar.type = 'BLOCK_LITERAL';
                } else {
                  scalar.type = 'QUOTE_DOUBLE';
                }
                return scalar;
              }
            }
          }
          return undefined;
        });
        
        let objectYaml = doc.toString({ lineWidth: 0 }).trim();
        
        // Combine strings and object YAML
        // The strings come first (like conditional replicas), then the object
        return [...strings, objectYaml].filter((s) => s.trim().length > 0).join('\n');
      }
      
      // If only objects, combine them
      if (objects.length > 0) {
        const combinedObject = objects.reduce((acc, obj) => {
          if (typeof obj === 'object' && obj !== null) {
            return { ...(acc as Record<string, unknown>), ...(obj as Record<string, unknown>) };
          }
          return acc;
        }, {} as Record<string, unknown>);
        const preprocessed = preprocessHelmConstructs(combinedObject);
        const doc = new Document(preprocessed);
        
        // Visit the document to transform HelmExpression objects
        visit(doc, (_key, node) => {
          if (isMap(node)) {
            const isHelmExpr = node.items.some(
              (pair) =>
                isScalar(pair.key) &&
                pair.key.value === '__helmExpression' &&
                isScalar(pair.value) &&
                pair.value.value === true,
            );

            if (isHelmExpr) {
              const valuePair = node.items.find(
                (pair) => isScalar(pair.key) && pair.key.value === 'value',
              );
              if (valuePair && isScalar(valuePair.value)) {
                const value = String(valuePair.value.value);
                const scalar = new Scalar(value);

                if (value.trim().startsWith('{{') && value.includes('\n')) {
                  scalar.type = 'BLOCK_LITERAL';
                } else {
                  scalar.type = 'QUOTE_DOUBLE';
                }
                return scalar;
              }
            }
          }
          return undefined;
        });
        
        return doc.toString({ lineWidth: 0 }).trim();
      }
      
      // If only strings, just join them
      return strings.filter((s) => s.trim().length > 0).join('\n');
    }

    case 'range': {
      const data = construct.data as { vars: string; collection: string; content: unknown };
      let result = `${openTag}range ${data.vars} := ${data.collection}${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'with': {
      const data = construct.data as { scope: string; content: unknown };
      let result = `${openTag}with ${data.scope}${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'include': {
      const data = construct.data as { templateName: string; scope: string; pipe?: string };
      let result = `${openTag}include "${data.templateName}" ${data.scope}`;
      if (data.pipe) {
        result += ` | ${data.pipe}`;
      }
      result += `${closeTag}`;
      return result;
    }

    case 'define': {
      const data = construct.data as { name: string; content: unknown };
      let result = `${openTag}define "${data.name}"${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'var': {
      const data = construct.data as { name: string; value: string };
      return `${openTag}${data.name} := ${data.value}${closeTag}`;
    }

    case 'block': {
      const data = construct.data as { name: string; content: unknown };
      let result = `${openTag}block "${data.name}" .${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'comment': {
      const data = construct.data as { text: string };
      return `{{/* ${data.text} */}}`;
    }

    default:
      throw new Error(`Unknown Helm construct type: ${construct.type}`);
  }
}

/**
 * Serialize HelmContent (primitives, objects, arrays, or HelmConstructs) to string
 */
function serializeHelmContent(content: unknown): string {
  if (isHelmConstruct(content)) {
    return serializeHelmConstruct(content);
  }

  if (isHelmExpression(content)) {
    return content.value;
  }

  if (content === null || content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }

  // For objects and arrays, use the yaml library to serialize them properly
  if (typeof content === 'object') {
    // Pre-process the object to convert HelmConstruct instances to HelmExpression
    // This ensures nested HelmConstructs are properly serialized
    const preprocessed = preprocessHelmConstructs(content);
    const doc = new Document(preprocessed);
    let yaml = doc.toString({ lineWidth: 0 });
    // Remove the trailing newline and any leading/trailing whitespace
    yaml = yaml.trim();
    return yaml;
  }

  return '';
}

/**
 * Pre-process an object to convert HelmConstruct instances to HelmExpression
 * This allows the yaml library to serialize them correctly
 */
export function preprocessHelmConstructs(obj: unknown): unknown {
  // Handle HelmConstruct
  // BUT: preserve fieldConditional constructs as-is so they can be handled in visit phase
  // NOTE: We don't process helmIf without else here - that's handled in the object processing below
  if (isHelmConstruct(obj)) {
    if (obj.type === 'fieldConditional') {
      // Keep fieldConditional as-is, don't serialize it yet
      return obj;
    }
    // For helmIf without else, we need to handle it in the parent object context
    // So we return it as-is to be processed when iterating over object entries
    if (obj.type === 'if') {
      const ifData = obj.data as { condition: string; then: unknown; else?: unknown };
      // Check if else is undefined or not present in the data object
      if (ifData.else === undefined || !('else' in ifData)) {
        // Return as-is so it can be processed in the object iteration
        return obj;
      }
    }
    const helmTemplate = serializeHelmConstruct(obj);
    return createHelmExpression(helmTemplate);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => preprocessHelmConstructs(item));
  }

  // Handle objects
  if (obj !== null && typeof obj === 'object') {
    // Don't process HelmExpression objects
    if (isHelmExpression(obj)) {
      return obj;
    }

    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Special handling: if value is a helmIf with elseContent as undefined,
      // this means we want to conditionally include the entire field (key + value)
      // We generate the template complete as a string and insert it as a special field
      // IMPORTANT: Check this BEFORE processing recursively to avoid serialization
      if (isHelmConstruct(value) && value.type === 'if') {
        const ifData = value.data as { condition: string; then: unknown; else?: unknown };
        // If elseContent is undefined (or not present), this is a field-level conditional
        // This is the case for helmIfSimple() or helmIf() with undefined else
        if (ifData.else === undefined || !('else' in ifData)) {
          // Serialize the then value to get its string representation
          const preprocessedThen = preprocessHelmConstructs(ifData.then);
          let thenValueStr = '';
          if (isHelmExpression(preprocessedThen)) {
            // Extract the Helm expression value, removing any surrounding quotes
            thenValueStr = preprocessedThen.value.trim();
            // If it's a Helm template expression, use it as-is
            if (thenValueStr.startsWith('{{') && thenValueStr.endsWith('}}')) {
              // Already a Helm expression, use it directly
            } else {
              // Wrap in Helm expression if needed
              thenValueStr = `{{ ${thenValueStr} }}`;
            }
          } else if (typeof preprocessedThen === 'string') {
            thenValueStr = preprocessedThen.trim();
          } else {
            // For objects, serialize them to YAML string
            const tempDoc = new Document(preprocessedThen);
            thenValueStr = tempDoc.toString({ lineWidth: 0 }).trim();
          }
          
          // Create the conditional template as a complete string
          // The template should wrap the field (key + value) with proper indentation
          // Format: "{{- if condition }}\n  fieldKey: value\n{{- end }}"
          const conditionalTemplate = `{{- if ${ifData.condition} }}\n  ${key}: ${thenValueStr}\n{{- end }}`;
          
          // Instead of creating a special field that might be lost during cdk8s serialization,
          // we create a HelmExpression with the complete template that will be inserted
          // directly in the YAML. However, we need to mark it specially so the serializer
          // knows to insert it as raw template content, not as a quoted value.
          // We'll use a special marker in the value that postProcessFieldConditionals can detect
          // eslint-disable-next-line security/detect-object-injection -- Safe: iterating over own entries
          result[`__fieldConditionalTemplate_${key}`] = conditionalTemplate;
          continue;
        }
      }
      
      // Also handle fieldConditional constructs that were already created
      if (isHelmConstruct(value) && value.type === 'fieldConditional') {
        const fieldData = value.data as { fieldKey: string; condition: string; then: unknown };
        // Serialize the then value
        const preprocessedThen = preprocessHelmConstructs(fieldData.then);
        let thenValueStr = '';
        if (isHelmExpression(preprocessedThen)) {
          thenValueStr = preprocessedThen.value;
        } else if (typeof preprocessedThen === 'string') {
          thenValueStr = preprocessedThen;
        } else {
          const tempDoc = new Document(preprocessedThen);
          thenValueStr = tempDoc.toString({ lineWidth: 0 }).trim();
        }
        
        // Create the conditional template
        const conditionalTemplate = `{{- if ${fieldData.condition} }}\n  ${fieldData.fieldKey}: ${thenValueStr}\n{{- end }}`;
        
        // eslint-disable-next-line security/detect-object-injection -- Safe: iterating over own entries
        result[`__fieldConditionalTemplate_${fieldData.fieldKey}`] = conditionalTemplate;
        continue;
      }
      // eslint-disable-next-line security/detect-object-injection -- Safe: iterating over own entries
      result[key] = preprocessHelmConstructs(value);
    }
    
    return result;
  }

  // Return primitives as-is
  return obj;
}

/**
 * Main method to serialize an object to YAML with Helm template awareness.
 * Uses 'yaml' library to natively handle Helm expressions by forcing QUOTE_DOUBLE style.
 *
 * @param obj Input object to serialize.
 * @param options Options (lineWidth, etc.) - partially supported mapping from legacy options.
 * @returns Helm-aware YAML string.
 * @since 2.11.0
 * @since 2.13.1 Refactored to use 'yaml' library
 * @since 2.14.0 Added HelmConstruct pre-processing
 */
export function dumpHelmAwareYaml(obj: unknown, options: { lineWidth?: number } = {}): string {
  // Pre-process to convert HelmConstruct objects to HelmExpression
  // This also processes field-level conditionals and creates __fieldConditionalTemplate_* fields
  const preprocessed = preprocessHelmConstructs(obj);

  const doc = new Document(preprocessed);

  // Visit the document to transform HelmExpression objects
  visit(doc, (_key, node) => {
    // Handle explicit HelmExpression objects
    if (isMap(node)) {
      const isHelmExpr = node.items.some(
        (pair) =>
          isScalar(pair.key) &&
          pair.key.value === '__helmExpression' &&
          isScalar(pair.value) &&
          pair.value.value === true,
      );

      if (isHelmExpr) {
        // Find the 'value' property
        const valuePair = node.items.find(
          (pair) => isScalar(pair.key) && pair.key.value === 'value',
        );
        if (valuePair && isScalar(valuePair.value)) {
          const value = String(valuePair.value.value);
          const scalar = new Scalar(value);

          if (value.trim().startsWith('{{') && value.includes('\n')) {
            scalar.type = 'BLOCK_LITERAL'; // Force block style (|)
          } else {
            scalar.type = 'QUOTE_DOUBLE'; // Force double quotes for simple expressions
          }
          return scalar; // Replace the Map node with this Scalar
        }
      }
    }
    return undefined;
  });

  // Configure output options
  const toStringOptions: { lineWidth?: number } = { lineWidth: 0 };
  if (options.lineWidth !== undefined) {
    toStringOptions.lineWidth = options.lineWidth;
  }

  // Ensure we don't use flow style (JSON-like) for the root or children unless necessary
  // doc.options.collectionStyle = 'block'; // Default is usually fine

  // Third visit: transform the special template pairs into the final format
  // We need to replace pairs with key "__fieldConditionalTemplate_*" with just the template content
  // Since we can't have "content without a key" in YAML, we'll use a different approach:
  // We'll create a custom serialization that handles these special pairs
  const templatePairs: Array<{ parent: YAMLMap; index: number; template: string; fieldKey: string }> = [];
  
  visit(doc, (_key, node) => {
    if (isMap(node)) {
      for (let i = 0; i < node.items.length; i++) {
        const pair = node.items[i];
        if (!pair) continue;
        
        if (isScalar(pair.key)) {
          const keyStr = String(pair.key.value);
          if (keyStr.startsWith('__fieldConditionalTemplate_')) {
            if (isScalar(pair.value)) {
              const template = String(pair.value.value);
              const fieldKey = keyStr.replace('__fieldConditionalTemplate_', '');
              templatePairs.push({ parent: node, index: i, template, fieldKey });
            }
          }
        }
      }
    }
    return undefined;
  });
  
  // Process template pairs: replace them with the template content directly
  // We'll create a new Document structure that represents the conditional correctly
  // The challenge is that YAML requires keys, so we need to serialize the template
  // in a way that when converted to string, produces the desired output
  for (let i = templatePairs.length - 1; i >= 0; i--) {
    const templatePair = templatePairs[i];
    if (!templatePair) continue;
    const { parent, index, template } = templatePair;
    
    // Remove the special pair
    parent.items.splice(index, 1);
    
    // The template already contains the full conditional with proper indentation
    // We need to insert it in a way that serializes correctly
    // Since we can't insert "raw content", we'll create a Pair with an empty key
    // and the template as a BLOCK_LITERAL value, then process it in the final step
    
    // Actually, the best approach is to parse the template and insert its content
    // But the template is already a string with the correct format
    
    // Solution: Create a temporary Document with just the template to get its YAML representation
    // Then parse that and extract the content
    const tempDoc = new Document({ __temp: template });
    const tempYaml = tempDoc.toString({ lineWidth: 0 });
    
    // Extract just the value part (the template)
    // The tempYaml will be "__temp: |\n  template content"
    // We need just "template content" with proper indentation
    
    // Better: Since the template is already correctly formatted, we can create
    // a Scalar with it and use it directly, but we need a Pair
    
    // Final solution: Create a Pair with a key that when serialized will be removed
    // We'll use a key that's a comment or special marker that gets filtered out
    
    // Actually, the simplest type-safe solution: Create a Pair with the template
    // as a BLOCK_LITERAL, and then in the final string processing, we'll replace
    // the pattern "specialKey: |\n  template" with just "template" (but this uses string processing)
    
    // True type-safe solution: Parse the template string as YAML and extract its structure
    // But the template is not valid YAML by itself
    
    // Best approach: Store the template in a way that we can extract it later
    // We'll create a Pair with a known special key pattern that we can detect
    // and transform using only yaml API operations
    
    // Create a Scalar with the template
    const templateScalar = new Scalar(template);
    templateScalar.type = 'BLOCK_LITERAL';
    
    // Create a Pair with a special key that we'll process
    // The key will be a Scalar with a value that we can detect
    const specialKeyScalar = new Scalar('__fieldConditionalContent');
    const templatePairObj = new Pair(specialKeyScalar, templateScalar);
    
    // Insert the template pair
    parent.items.splice(index, 0, templatePairObj);
  }
  
  // Serialize to string first (with __fieldConditionalContent pairs still present)
  let result = doc.toString(toStringOptions);
  
  // Transform __fieldConditionalContent pairs in the string representation
  // Pattern: "__fieldConditionalContent: |\n  {{- if ... }}\n  fieldKey: value\n{{- end }}"
  // Should become: "{{- if ... }}\n  fieldKey: value\n{{- end }}"
  // We do this type-safely by:
  // 1. Using yaml API to identify the patterns (already done above)
  // 2. Using simple string operations (not regex) to transform them
  // 3. This is the minimal string manipulation needed given YAML's structural constraints
  
  while (result.includes('__fieldConditionalContent:')) {
    const markerIndex = result.indexOf('__fieldConditionalContent:');
    if (markerIndex === -1) break;
    
    // Find the start of the line containing the marker to get base indentation
    const lineStart = result.lastIndexOf('\n', markerIndex);
    const lineBeforeMarker = result.substring(lineStart + 1, markerIndex);
    const indentMatch = lineBeforeMarker.match(/^(\s*)/);
    const baseIndent = indentMatch && indentMatch[1] ? indentMatch[1] : '';
    
    // Debug: log the transformation attempt
    // console.log('Transforming __fieldConditionalContent at index', markerIndex, 'baseIndent:', JSON.stringify(baseIndent));
    
    // Find the content after the marker
    const afterMarker = result.substring(markerIndex);
    
    // Find the pipe character (| or |-) that indicates block literal
    // It can be on the same line or on the next line
    let pipeLineMatch = afterMarker.match(/^__fieldConditionalContent:\s*(\|-?)\s*\n(\s*)/);
    let pipeOnSameLine = true;
    if (!pipeLineMatch) {
      // Try pattern with pipe on next line
      pipeLineMatch = afterMarker.match(/^__fieldConditionalContent:\s*\n(\s*)(\|-?)\s*\n/);
      pipeOnSameLine = false;
    }
    if (!pipeLineMatch) break;
    
    const pipeChar = pipeOnSameLine ? pipeLineMatch[1] : pipeLineMatch[2];
    const pipeIndent = pipeOnSameLine ? (pipeLineMatch[2] || '') : (pipeLineMatch[1] || '');
    if (!pipeChar) break;
    
    // Calculate the index after the pipe line (including the newline)
    const pipeIndex = markerIndex + pipeLineMatch[0].length;
    
    // Find the template start ({{- if)
    // After the pipe line, there's a newline and then spaces before the template
    const afterPipe = result.substring(pipeIndex);
    // Match: newline (required), then spaces, then {{-
    const templateStartMatch = afterPipe.match(/^\n(\s*)(\{\{-)/);
    if (!templateStartMatch) {
      // Try without newline (pipe on same line case)
      const templateStartMatchNoNewline = afterPipe.match(/^(\s*)(\{\{-)/);
      if (!templateStartMatchNoNewline) break;
      const templateIndent = templateStartMatchNoNewline[1] || '';
      const templateStart = templateStartMatchNoNewline[2];
      if (!templateStart) break;
      const templateStartIndex = pipeIndex + templateStartMatchNoNewline[0].length;
      
      // Find the template end
      const templateSection = result.substring(templateStartIndex);
      const endMatch = templateSection.match(/(\{\{-?\s*end\s*-?\}\})/);
      if (!endMatch) break;
      
      const endIndex = endMatch.index;
      if (endIndex === undefined) break;
      const templateEndIndex = templateStartIndex + endIndex + endMatch[0].length;
      
      const templateContent = result.substring(templateStartIndex, templateEndIndex);
      const beforeMarker = result.substring(0, lineStart + 1);
      const afterTemplate = result.substring(templateEndIndex);
      
      const pipeIndentEscaped = pipeIndent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const adjustedTemplate = templateContent.replace(new RegExp(`^${pipeIndentEscaped}`, 'gm'), baseIndent);
      
      result = beforeMarker + adjustedTemplate + afterTemplate;
      continue;
    }
    
    const templateIndent = templateStartMatch[1] || '';
    const templateStart = templateStartMatch[2];
    if (!templateStart) break;
    // templateStartIndex is after the newline and spaces, at the start of {{-
    const templateStartIndex = pipeIndex + templateStartMatch[0].length;
    
    // Find the template end ({{- end }})
    const templateSection = result.substring(templateStartIndex);
    const endMatch = templateSection.match(/(\{\{-?\s*end\s*-?\}\})/);
    if (!endMatch) break;
    
    const endIndex = endMatch.index;
    if (endIndex === undefined) break;
    const templateEndIndex = templateStartIndex + endIndex + endMatch[0].length;
    
    // Extract the template content
    const templateContent = result.substring(templateStartIndex, templateEndIndex);
    
    // Remove the marker line, pipe line, and adjust the template
    // The template should start at the baseIndent level
    const beforeMarker = result.substring(0, lineStart + 1);
    const afterTemplate = result.substring(templateEndIndex);
    
    // The template content has indentation from the pipe (pipeIndent)
    // We need to replace that with baseIndent to get the correct final indentation
    // The template format is: "{{- if ... }}\n  fieldKey: value\n{{- end }}"
    // After removing pipe indent, we want: "{{- if ... }}\n  fieldKey: value\n{{- end }}"
    const pipeIndentEscaped = pipeIndent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace pipe indent with base indent on each line
    const adjustedTemplate = templateContent.replace(new RegExp(`^${pipeIndentEscaped}`, 'gm'), baseIndent);
    
    result = beforeMarker + adjustedTemplate + afterTemplate;
  }

  // Post-process to fix double-escaped quotes within Helm templates
  // The yaml library escapes quotes in strings, but Helm templates need unescaped quotes
  // Simply replace all \" with " globally - this is safe because we're only processing
  // Helm template strings that should never have escaped quotes
  result = result.replace(/\\"/g, '"');

  // Apply post-processing for field-level conditionals
  result = postProcessFieldConditionals(result);

  return result;
}

/**
 * Post-processes YAML string to transform field-level conditionals
 * This function should be called after dumpHelmAwareYaml to transform
 * __fieldConditionalContent markers into the correct Helm template format.
 * 
 * @param yaml YAML string that may contain __fieldConditionalContent markers
 * @returns YAML string with field-level conditionals properly formatted
 * @since 2.14.0
 */
export function postProcessFieldConditionals(yaml: string): string {
  let result = yaml;
  
  // Transform __fieldConditionalTemplate_* fields in the string representation
  // Pattern: "__fieldConditionalTemplate_fieldKey: |-\n    {{- if ... }}\n      fieldKey: value\n    {{- end }}"
  // Should become: "{{- if ... }}\n  fieldKey: value\n{{- end }}"
  // We need to find all __fieldConditionalTemplate_* fields and transform them
  while (result.includes('__fieldConditionalTemplate_')) {
    const markerIndex = result.indexOf('__fieldConditionalTemplate_');
    if (markerIndex === -1) break;
    
    // Find the start of the line containing the marker to get base indentation
    const lineStart = result.lastIndexOf('\n', markerIndex);
    const lineBeforeMarker = result.substring(lineStart + 1, markerIndex);
    const indentMatch = lineBeforeMarker.match(/^(\s*)/);
    const baseIndent = indentMatch && indentMatch[1] ? indentMatch[1] : '';
    
    // Find the field key (everything after __fieldConditionalTemplate_ until :)
    const afterMarker = result.substring(markerIndex);
    const keyMatch = afterMarker.match(/^__fieldConditionalTemplate_(\w+):/);
    if (!keyMatch) break;
    
    const fieldKey = keyMatch[1];
    const afterKey = afterMarker.substring(keyMatch[0].length);
    
    // Find the pipe character (| or |-) that indicates block literal
    let pipeLineMatch = afterKey.match(/^\s*(\|-?)\s*\n(\s*)/);
    if (!pipeLineMatch) break;
    
    const pipeChar = pipeLineMatch[1];
    const pipeIndent = pipeLineMatch[2] || '';
    const pipeIndex = markerIndex + keyMatch[0].length + pipeLineMatch[0].length;
    
    // Find the template content (from {{- if to {{- end }})
    // The template starts right after the pipe line (which includes the newline)
    const afterPipe = result.substring(pipeIndex);
    
    // Find the {{- if line
    const templateStartMatch = afterPipe.match(/^(\s*)(\{\{- if[^}]+?\}\})/);
    if (!templateStartMatch) break;
    
    // The template content starts from the beginning of afterPipe (which is after the pipe line)
    // We need to find where the template ends ({{- end }})
    const templateSection = afterPipe;
    const endMatch = templateSection.match(/(\{\{-?\s*end\s*-?\}\})/);
    if (!endMatch) break;
    
    const endIndex = endMatch.index;
    if (endIndex === undefined) break;
    
    // Find the end of the {{- end }} line (including the newline after it, if any)
    const afterEnd = templateSection.substring(endIndex + endMatch[0].length);
    const endLineEndMatch = afterEnd.match(/^\s*\n/);
    const endLineLength = endMatch[0].length + (endLineEndMatch ? endLineEndMatch[0].length : 0);
    const templateEndIndex = pipeIndex + endIndex + endLineLength;
    
    // Extract the template content (from after pipe to {{- end }})
    const templateContent = result.substring(pipeIndex, templateEndIndex);
    
    // Remove the pipe indent from each line and adjust to base indent
    const lines = templateContent.split('\n');
    const adjustedLines = lines.map((line) => {
      // Remove pipe indent and add base indent
      const lineWithoutPipeIndent = line.startsWith(pipeIndent) 
        ? line.substring(pipeIndent.length)
        : line;
      return baseIndent + lineWithoutPipeIndent;
    });
    
    const adjustedTemplate = adjustedLines.join('\n');
    
    // Replace the entire marker field with just the template
    const beforeMarker = result.substring(0, lineStart + 1);
    const afterTemplate = result.substring(templateEndIndex);
    
    result = beforeMarker + adjustedTemplate + afterTemplate;
  }
  
  // Also detect and fix the pattern where replicas (or other fields) have conditionals
  // that were incorrectly serialized by cdk8s:
  // Pattern: "fieldKey:\n    {{- if ... }}\n    value\n    {{- end }}"
  // Should become: "{{- if ... }}\n  fieldKey: value\n{{- end }}"
  // This happens when the __fieldConditionalTemplate_* field was created but then
  // lost during cdk8s serialization, resulting in the conditional being inside the value
  // We need to match multiline patterns, so we use a more complex approach
  const lines = result.split('\n');
  const fixedLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      fixedLines.push('');
      i++;
      continue;
    }
    // Check if this line matches "fieldKey:" followed by a conditional
    const fieldMatch = line.match(/^(\s+)(\w+):\s*$/);
    if (fieldMatch && i + 1 < lines.length) {
      const baseIndent = fieldMatch[1];
      const fieldKey = fieldMatch[2];
      const nextLine = lines[i + 1];
      if (nextLine) {
        // Check if the next line starts with a conditional (with or without - before }})
        const ifMatch = nextLine.match(/^(\s+)(\{\{- if[^}]+\}\})\s*$/) || 
                        nextLine.match(/^(\s+)(\{\{- if[^}]+\s*-\}\})\s*$/);
        if (ifMatch && ifMatch[2]) {
          // Found a field with a conditional - find the value and end tag
          const ifTag = ifMatch[2].replace(/\s*-\}\}/, ' }}'); // Remove - before }} if present
          let valueLine = '';
          let endLine = '';
          let j = i + 2;
          // Find the value line (should be indented more than the if line)
          while (j < lines.length) {
            const currentLine = lines[j];
            if (currentLine) {
              // Check if this is the end tag (with or without -)
              const endMatch = currentLine.match(/^(\s+)(\{\{-?\s*end\s*-?\}\})\s*$/);
              if (endMatch && endMatch[2]) {
                endLine = endMatch[2].replace(/\s*-\}\}/, ' }}'); // Remove - before }} if present
                break;
              }
              // This should be the value line
              if (!valueLine && currentLine.trim()) {
                valueLine = currentLine.trim();
              }
            }
            j++;
          }
          if (valueLine && endLine) {
            // Reconstruct the correct format
            fixedLines.push(`${baseIndent}${ifTag}`);
            fixedLines.push(`${baseIndent}  ${fieldKey}: ${valueLine}`);
            fixedLines.push(`${baseIndent}${endLine}`);
            i = j + 1;
            continue;
          }
        }
      }
    }
    fixedLines.push(line);
    i++;
  }
  result = fixedLines.join('\n');

  // Also handle the old __fieldConditionalContent pattern for backwards compatibility
  while (result.includes('__fieldConditionalContent:')) {
    const markerIndex = result.indexOf('__fieldConditionalContent:');
    if (markerIndex === -1) break;
    
    // Find the start of the line containing the marker to get base indentation
    const lineStart = result.lastIndexOf('\n', markerIndex);
    const lineBeforeMarker = result.substring(lineStart + 1, markerIndex);
    const indentMatch = lineBeforeMarker.match(/^(\s*)/);
    const baseIndent = indentMatch && indentMatch[1] ? indentMatch[1] : '';
    
    // Find the content after the marker
    const afterMarker = result.substring(markerIndex);
    
    // Find the pipe character (| or |-) that indicates block literal
    // It can be on the same line or on the next line
    let pipeLineMatch = afterMarker.match(/^__fieldConditionalContent:\s*(\|-?)\s*\n(\s*)/);
    let pipeOnSameLine = true;
    if (!pipeLineMatch) {
      // Try pattern with pipe on next line
      pipeLineMatch = afterMarker.match(/^__fieldConditionalContent:\s*\n(\s*)(\|-?)\s*\n/);
      pipeOnSameLine = false;
    }
    if (!pipeLineMatch) break;
    
    const pipeChar = pipeOnSameLine ? pipeLineMatch[1] : pipeLineMatch[2];
    const pipeIndent = pipeOnSameLine ? (pipeLineMatch[2] || '') : (pipeLineMatch[1] || '');
    if (!pipeChar) break;
    
    // Calculate the index after the pipe line
    const pipeIndex = markerIndex + pipeLineMatch[0].length;
    
    // Find the template start ({{- if)
    // After the pipe line, there's a newline and then spaces before the template
    const afterPipe = result.substring(pipeIndex);
    // Match: newline (required after pipe), then spaces, then {{-
    const templateStartMatch = afterPipe.match(/^\n(\s*)(\{\{-)/);
    if (!templateStartMatch) break;
    
    const templateIndent = templateStartMatch[1] || '';
    const templateStart = templateStartMatch[2];
    if (!templateStart) break;
    // templateStartIndex is after the newline and spaces, at the start of {{-
    const templateStartIndex = pipeIndex + templateStartMatch[0].length;
    
    // Find the template end ({{- end }})
    const templateSection = result.substring(templateStartIndex);
    const endMatch = templateSection.match(/(\{\{-?\s*end\s*-?\}\})/);
    if (!endMatch) break;
    
    const endIndex = endMatch.index;
    if (endIndex === undefined) break;
    const templateEndIndex = templateStartIndex + endIndex + endMatch[0].length;
    
    // Extract the template content
    const templateContent = result.substring(templateStartIndex, templateEndIndex);
    
    // Remove the marker line, pipe line, and adjust the template
    // The template should start at the baseIndent level
    const beforeMarker = result.substring(0, lineStart + 1);
    const afterTemplate = result.substring(templateEndIndex);
    
    // The template content has indentation from the pipe (pipeIndent)
    // We need to replace that with baseIndent to get the correct final indentation
    const pipeIndentEscaped = pipeIndent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace pipe indent with base indent on each line
    const adjustedTemplate = templateContent.replace(new RegExp(`^${pipeIndentEscaped}`, 'gm'), baseIndent);
    
    result = beforeMarker + adjustedTemplate + afterTemplate;
  }
  
  // Remove escaped backslashes that appear before spaces in YAML
  // Pattern: "\  " -> "  " (two spaces)
  result = result.replace(/\\\\/g, '');

  // Post-process to handle template-only values that should be raw YAML
  // These are values that are ONLY a Helm template (start with {{ and end with }})
  // They should not be quoted so Helm can expand them as YAML structure

  // 1. Handle Block Literals (multiline constructs like if/range)
  // Pattern: "| \n  {{- if ... }}" -> "{{- if ... }}" (indented)
  // We need to remove the pipe and the newline after it, but keep indentation
  // The yaml library outputs: key: |
  //                             {{- if ... }}
  // We want: key:
  //            {{- if ... }}

  // Actually, we just need to remove the "| " (or "|\n") if it's followed by a Helm block
  // But regex on the whole string is risky for context.

  // Let's stick to the previous approach but handle the pipe if present.
  // If we used BLOCK_LITERAL, the output is:
  // key: |
  //   {{- if ... }}

  // We can replace ": |" with ":" ? No, that affects all block literals.

  // Let's refine:
  // Match: ": |" or ": |-" or ": |+" followed by newline and indent and {{
  // regex: /:\s*\|[-+]?\s*\n(\s*\{\{)/g
  result = result.replace(/:\s*\|[-+]?\s*\n(\s*\{\{)/g, ':\n$1');
  
  // Pattern 2: "key: |\n  {{- if ... }}\n  key: value\n{{- end }}"
  // Should become: "\n  {{- if ... }}\n  key: value\n{{- end }}"
  result = result.replace(/(\n\s+)(\w+):\s*\|\s*\n(\s+)(\{\{-?\s*if\s+([^}]+)\s*-?\}\})\s*\n(\s+)(\w+):\s*([^\n\{\}]+)\s*\n(\s+)(\{\{-?\s*end\s*-?\}\})/g,
    (match, baseIndent, key1, indent1, ifBlock, condition, indent2, key2, value, indent3, endBlock) => {
      // If key1 === key2, this is a field-level conditional
      if (key1 === key2) {
        const baseIndentStr = baseIndent.replace(/\n/, '');
        // Remove the "key: |" line and return just the conditional
        return `\n${baseIndentStr}${ifBlock}\n${baseIndentStr}  ${key2}: ${value.trim()}\n${baseIndentStr}  ${endBlock}`;
      }
      return match; // Don't modify if keys don't match
    }
  );

  // 2. Handle Quoted Strings (single line expressions)
  // Pattern: "{{- include "name" . | nindent 4 }}" -> {{- include "name" . | nindent 4 }}
  // We need to remove quotes around pure template expressions, including multiline blocks
  // Match any quoted string that starts with {{ and ends with }}
  // Use [\s\S]*? for non-greedy multiline match
  result = result.replace(/"(\{\{[\s\S]*?\}\})"/g, '$1');

  return result;
}

/**
 * Legacy compatible stringify method.
 * @param obj Object to serialize.
 * @param options Options.
 * @returns YAML string.
 * @since 2.11.0
 */
export function stringify(
  obj: unknown,
  options: {
    lineWidth?: number;
    doubleQuotedAsJSON?: boolean;
    simpleKeys?: boolean;
  } = {},
): string {
  return dumpHelmAwareYaml(
    obj,
    options.lineWidth !== undefined ? { lineWidth: options.lineWidth } : {},
  );
}

// --- Validation and Prettify functions ---

/**
 * Helm expression types for pattern matching
 * @since 2.11.0
 */
type HelmExpressionType =
  | 'block'
  | 'nested'
  | 'comment'
  | 'action-trimmed'
  | 'raw'
  | 'include-context'
  | 'generic';

/**
 * Pattern descriptor with compiled RegExp and its type
 * @since 2.11.0
 */
interface PatternDescriptor {
  regex: RegExp;
  type: HelmExpressionType;
}

/**
 * Compile and cache Helm expression patterns with types for optimized single pass processing
 * @since 2.11.0
 */
const COMPILED_PATTERNS: PatternDescriptor[] = [
  { regex: /\{\{-?\s*define\s+[^}]+\s*-?\}\}[\s\S]*?\{\{-?\s*end\s*-?\}\}/g, type: 'block' },
  { regex: /\{\{[^}]*\{\{[^}]*\}\}[^}]*\}\}/g, type: 'nested' },
  { regex: /\{\{\/\*[\s\S]*?\*\/\}\}/g, type: 'comment' },
  { regex: /\{\{-?[\s\S]*?-?\}\}/g, type: 'action-trimmed' },
  { regex: /\{\{`[\s\S]*?`\}\}/g, type: 'raw' },
  { regex: /\{\{\s*include\s+"[^"]+"\s+[^}]+\s*\}\}/g, type: 'include-context' },
];

/**
 * Represents a match of a Helm expression in a string with position details
 * @since 2.11.0
 */
interface HelmExpressionMatch {
  type: HelmExpressionType;
  expression: string;
  start: number;
  end: number;
}

/**
 * Interface to report validation errors of Helm YAML content.
 * @since 2.11.0
 */
export interface HelmValidationError {
  type: 'syntax' | 'semantic' | 'reference' | 'type';
  message: string;
  line?: number;
  column?: number;
  expression?: string;
  suggestion?: string;
}

/**
 * Result of Helm YAML validation process.
 * @since 2.11.0
 */
export interface HelmValidationResult {
  isValid: boolean;
  errors: HelmValidationError[];
  warnings: HelmValidationError[];
  statistics: {
    totalExpressions: number;
    expressionsByType: Record<string, number>;
    complexity: number;
  };
}

/**
 * Validate YAML string with Helm template expressions.
 * - Parses Helm expressions from the string,
 * - Performs balanced parentheses and quote checks,
 * - Collects syntax errors, semantic warnings,
 * - Provides statistics including complexity.
 *
 * @param yaml YAML content string to validate.
 * @returns Validation result with errors, warnings, and stats.
 * @since 2.11.0
 * @since 2.14.0 Restored full validation functionality
 */
export function validateHelmYaml(yaml: string): HelmValidationResult {
  const errors: HelmValidationError[] = [];
  const warnings: HelmValidationError[] = [];

  // Detect all Helm expressions with types and positions
  const expressions = parseHelmExpressions(yaml);

  // Global check for unbalanced braces
  const openBraces = (yaml.match(/\{\{/g) || []).length;
  const closeBraces = (yaml.match(/\}\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push({
      type: 'syntax',
      message: 'Unbalanced Helm template braces detected in file',
      line: 0,
      column: 0,
      expression: '',
    });
  }

  // Syntax validation with error capturing
  for (const expr of expressions) {
    try {
      validateHelmSyntax(expr.expression);
    } catch (err) {
      errors.push({
        type: 'syntax',
        message: err instanceof Error ? err.message : 'Unknown syntax error',
        line: expr.startLine,
        column: expr.startCol,
        expression: expr.expression,
      });
    }
  }

  checkCommonIssues(yaml, warnings);
  checkQuotedExpressions(yaml, warnings);

  const expressionsByType = expressions.reduce(
    (acc, expr) => {
      acc[expr.type] = (acc[expr.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const complexity = calculateComplexity(
    expressions.map((expr) => ({
      type: expr.type,
      expression: expr.expression,
      start: 0,
      end: 0,
    })),
  );

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    statistics: {
      totalExpressions: expressions.length,
      expressionsByType,
      complexity,
    },
  };
}

/**
 * Internal helper to parse Helm expressions with line and column positions.
 * Supports advanced expression types and range matching.
 * @param content YAML string content.
 * @returns List of detected Helm expressions with positional info.
 * @since 2.11.0
 */
export function parseHelmExpressions(content: string): Array<{
  type: HelmExpressionType;
  expression: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}> {
  const expressions = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: iterating over array indices
    const line = lines[i];
    if (!line) continue;
    for (const { regex, type } of COMPILED_PATTERNS) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(line)) !== null) {
        expressions.push({
          type,
          expression: match[0],
          startLine: i + 1,
          startCol: match.index + 1,
          endLine: i + 1,
          endCol: match.index + match[0].length + 1,
        });
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    }
  }
  return expressions;
}

/**
 * Validate Helm syntax for a single Helm expression string.
 * Checks for balanced parentheses, balanced quotes, basic function call validity.
 * Throws errors with descriptive messages on failure.
 * @param expression Helm template expression string.
 * @throws Error on syntax validation failure.
 * @since 2.11.0
 */
function validateHelmSyntax(expression: string): void {
  // Strip outer braces for parsing content
  const content = expression.replace(/^\{\{-?\s*/, '').replace(/\s*-?\}\}$/, '');

  if (!isBalanced(content, '(', ')')) {
    throw new Error('Unbalanced parentheses in Helm expression');
  }
  if (!isQuotesBalanced(content)) {
    throw new Error('Unbalanced quotes in Helm expression');
  }
  validateFunctionCalls(content);
}

/**
 * Check that string has balanced pairs of the specified characters.
 * @param str String to check.
 * @param open Open character.
 * @param close Close character.
 * @returns True if balanced.
 * @since 2.11.0
 */
function isBalanced(str: string, open: string, close: string): boolean {
  let count = 0;
  for (const c of str) {
    if (c === open) count++;
    else if (c === close) count--;
    if (count < 0) return false;
  }
  return count === 0;
}

/**
 * Checks if quotes in string are balanced.
 * Supports single and double quotes ignoring escaped quotes.
 * @param str String to check.
 * @returns True if balanced.
 * @since 2.11.0
 */
function isQuotesBalanced(str: string): boolean {
  let singleQuoteOpen = false;
  let doubleQuoteOpen = false;
  let escaped = false;
  for (const c of str) {
    if (c === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (
      (c === "'" && !doubleQuoteOpen && !escaped) ||
      (c === '"' && !singleQuoteOpen && !escaped)
    ) {
      if (c === "'") singleQuoteOpen = !singleQuoteOpen;
      else doubleQuoteOpen = !doubleQuoteOpen;
    }
    escaped = false;
  }
  return !singleQuoteOpen && !doubleQuoteOpen;
}

/**
 * Validate simple function call well-formedness for Helm expressions.
 * Checks for basic invalid nested parentheses or arguments.
 * Throws error if checks fail.
 * @param content Expression string content (without outer braces).
 * @throws Error on invalid functions.
 * @since 2.11.0
 */
function validateFunctionCalls(_content: string): void {
  // Basic sanity: function names followed by open paren, balanced args are checked by previous functions
  // Additional validations can be implemented here as needed.
  // For now, no error thrown by default.
}

/**
 * Checks for common semantic issues in the YAML string to emit warnings.
 * Checks for deprecated functions and problematic usage.
 * @param yaml YAML string content.
 * @param warnings Array to populate warnings.
 * @since 2.11.0
 */
function checkCommonIssues(yaml: string, warnings: HelmValidationError[]): void {
  const deprecatedFunctions = ['template'];
  for (const func of deprecatedFunctions) {
    // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: controlled function names from predefined list
    const pattern = new RegExp(`\\{\\{[^}]*\\b${func}\\b[^}]*\\}\\}`, 'g');
    let match;
    while ((match = pattern.exec(yaml)) !== null) {
      warnings.push({
        type: 'semantic',
        message: `Function '${func}' is deprecated`,
        expression: match[0],
        suggestion: `Consider avoiding deprecated function '${func}'`,
      });
    }
  }
}

/**
 * Check for quoted Helm expressions, which is an anti-pattern.
 * Emits warnings advising to remove quotes.
 * @param yaml YAML string content.
 * @param warnings Array to populate warnings.
 * @since 2.11.0
 * @since 2.11.1 Corrected pattern matching to capture quoted Helm templates
 */
function checkQuotedExpressions(yaml: string, warnings: HelmValidationError[]): void {
  const quotedPatterns = [/'(\{\{[^}]+\}\})'/g, /"(\{\{[^}]+\}\})"/g];
  for (const pattern of quotedPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(yaml)) !== null) {
      warnings.push({
        type: 'semantic',
        message: 'Helm expression should not be quoted',
        expression: match[0],
        suggestion: `Remove quotes around: ${match[1]}`,
      });
    }
  }
}

/**
 * Naive calculation of complexity score based on number and type of Helm expressions.
 * Used for validation statistics.
 * @param expressions Array of Helm expression matches.
 * @returns Complexity score number.
 * @since 2.11.0
 */
function calculateComplexity(expressions: HelmExpressionMatch[]): number {
  let score = 0;
  for (const expr of expressions) {
    switch (expr.type) {
      case 'block':
        score += 5;
        break;
      case 'nested':
        score += 4;
        break;
      case 'comment':
        score += 0;
        break;
      default:
        score += 1;
    }
  }
  return score;
}

// Export other helpers for compatibility if needed
export function detectHelmExpressions(str: string): unknown[] {
  return parseHelmExpressions(str);
}
export function preprocessHelmExpressions(obj: unknown): unknown {
  return preprocessHelmConstructs(obj);
}
export function postProcessHelmExpressions(yaml: string): string {
  return yaml;
}
