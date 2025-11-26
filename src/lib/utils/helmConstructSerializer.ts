/**
 * @fileoverview Helm construct serialization utilities
 * Converts HelmConstruct objects into Helm template syntax
 * @since 2.14.0
 */

import type { HelmConstruct, HelmContent } from './helmControlStructures.js';
import { isHelmConstruct } from './helmControlStructures.js';

/**
 * Serialize a HelmConstruct object into Helm template syntax
 * @param construct The HelmConstruct to serialize
 * @param indent Current indentation level
 * @returns Helm template string
 */
export function serializeHelmConstruct(construct: HelmConstruct, indent = 0): string {
    const trimLeft = construct.options?.trimLeft ?? true;
    const trimRight = construct.options?.trimRight ?? true;

    const openTag = `{{${trimLeft ? '-' : ''} `;
    const closeTag = ` ${trimRight ? '-' : ''}}}`;

    switch (construct.type) {
        case 'if': {
            const data = construct.data as { condition: string; then: HelmContent; else?: HelmContent };
            let result = `${openTag}if ${data.condition}${closeTag}\n`;
            result += serializeHelmContent(data.then, indent);

            if (data.else !== undefined) {
                result += `\n${openTag}else${closeTag}\n`;
                result += serializeHelmContent(data.else, indent);
            }

            result += `\n${openTag}end${closeTag}`;
            return result;
        }

        default:
            throw new Error(`Unknown Helm construct type: ${construct.type}`);
    }
}

/**
 * Serialize HelmContent (which can be primitives, objects, arrays, or HelmConstructs)
 * @param content The content to serialize
 * @param indent Current indentation level
 * @returns Serialized string
 */
export function serializeHelmContent(content: HelmContent, indent = 0): string {
    const indentStr = '  '.repeat(indent);

    // Handle HelmConstruct
    if (isHelmConstruct(content)) {
        return serializeHelmConstruct(content, indent);
    }

    // Handle primitives
    if (content === null || content === undefined) {
        return '';
    }

    if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') {
        return String(content);
    }

    // Handle arrays
    if (Array.isArray(content)) {
        return content.map((item) => {
            if (isHelmConstruct(item)) {
                return serializeHelmConstruct(item, indent);
            }
            return serializeHelmContent(item, indent);
        }).join('\n');
    }

    // Handle objects (convert to YAML)
    if (typeof content === 'object') {
        const lines: string[] = [];
        for (const [key, value] of Object.entries(content)) {
            if (isHelmConstruct(value)) {
                lines.push(`${indentStr}${key}: ${serializeHelmConstruct(value, indent + 1)}`);
            } else if (typeof value === 'object' && value !== null) {
                lines.push(`${indentStr}${key}:`);
                lines.push(serializeHelmContent(value, indent + 1));
            } else {
                // Generic Object Injection Sink /* eslint-disable-next-line security/detect-object-injection */
                lines.push(`${indentStr}${key}: ${value}`);
            }
        }
        return lines.join('\n');
    }

    return '';
}
