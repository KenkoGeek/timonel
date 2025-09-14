/**
 * @fileoverview Centralized constants for error messages, warnings, and configuration values
 * @since 2.9.0
 */

/**
 * Error messages for security validation
 * @since 2.9.0
 */
export const SECURITY_ERROR_MESSAGES = {
  INVALID_PATH: 'Invalid path: path must be a non-empty string',
  PATH_TRAVERSAL: 'Invalid path: path traversal sequences detected',
  PATH_OUTSIDE_BASE: (basePath: string) => `Invalid path: path must be within ${basePath}`,
  INVALID_ENV_NAME: 'Environment variable name must be a non-empty string',
  INVALID_ENV_VALUE: 'Environment variable value must be a string',
  ENV_NAME_INVALID_FORMAT: (name: string) => `Invalid environment variable name: ${name}`,
  ENV_VALUE_DANGEROUS_PATTERN: (pattern: string, value: string) =>
    `Environment variable value contains dangerous pattern (${pattern}): ${value}`,
  ENV_VALUE_TOO_LONG: 'Environment variable value exceeds maximum length (32KB)',
  INVALID_IMAGE_TAG: 'Image tag must be a non-empty string',
  IMAGE_TAG_INVALID_FORMAT: (tag: string) => `Invalid image tag format: ${tag}`,
  IMAGE_TAG_TOO_LONG: 'Image tag exceeds maximum length (128 characters)',
  INVALID_BASE_NAME: 'Base name must be a non-empty string',
  BASE_NAME_NO_VALID_CHARS: 'Base name contains no valid characters',
  INVALID_SUFFIX: 'Suffix must be a string',
  INVALID_SECRET_NAME: (name: string) => `Generated secret name is invalid: ${name}`,
  INVALID_ARN: (context: string) => `Invalid ARN for ${context}: ARN must be a non-empty string`,
  INVALID_ARN_FORMAT: (context: string, arn: string) =>
    `Invalid AWS ARN format for ${context}: ${arn}. Expected format: arn:partition:service:region:account-id:resource`,
  INCOMPLETE_ARN: (context: string, arn: string) =>
    `Incomplete AWS ARN format for ${context}: ${arn}. Missing required components.`,
  INVALID_IAM_RESOURCE: (context: string, resource: string) =>
    `Invalid IAM resource format for ${context}: ${resource}. Expected format: type/name (e.g., role/MyRole)`,
  INVALID_ACCOUNT_ID: (context: string, accountId: string) =>
    `Invalid AWS account ID for ${context}: ${accountId}. Account ID must be exactly 12 digits`,
  INVALID_HELM_PATH: (path: string) => `Invalid Helm template path: ${path}`,
  ENVIRONMENT_NAME_INVALID: 'Environment name must be a non-empty string',
  ENVIRONMENT_NAME_INVALID_FORMAT: (env: string) => `Invalid environment name: ${env}`,
  ENVIRONMENT_NAME_INVALID_LENGTH: 'Environment name must be 1-63 characters long',
} as const;

/**
 * Warning messages for security and best practices
 * @since 2.9.0
 */
export const SECURITY_WARNING_MESSAGES = {
  DANGEROUS_IMAGE_TAG: (tag: string) =>
    `⚠️  WARNING: Potentially insecure image tag detected: '${tag}'. Consider using specific version tags for better security and reproducibility.`,
  NON_STANDARD_IMAGE_TAG: (tag: string) =>
    `Warning: Image tag '${tag}' doesn't follow recommended patterns (semver, hash, or date)`,
  UNUSUAL_AWS_PARTITION: (partition: string, context: string) =>
    `⚠️  WARNING: Unusual AWS partition '${partition}' in ARN for ${context}. Expected: aws, aws-us-gov, or aws-cn`,
  WORLD_WRITABLE_TEMP_DIR: (tempDir: string) =>
    `⚠️  WARNING: Temporary directory ${tempDir} is world-writable. This may pose a security risk.`,
  TEMP_DIR_PERMISSION_CHECK_FAILED: (error: unknown) =>
    `⚠️  WARNING: Could not check temporary directory permissions: ${error}`,
} as const;

/**
 * Network policy constants and templates
 * @since 2.9.0
 */
export const NETWORK_POLICY_CONSTANTS = {
  API_VERSION: 'networking.k8s.io/v1',
  DEFAULT_POLICY_TYPES: ['Ingress', 'Egress'] as const,

  ERROR_MESSAGES: {
    TEMPLATE_NOT_FOUND: (templateName: string, available: string) =>
      `NetworkPolicy template '${templateName}' not found. Available templates: ${available}`,
  },

  WARNING_MESSAGES: {
    DEFAULT_POLICY_WARNING: (name: string) =>
      `⚠️  WARNING: NetworkPolicy '${name}' has no explicit policyTypes or rules. Defaulting to ['Ingress', 'Egress'] for security. Consider specifying explicit rules.`,
    TEMPLATE_INFO: (templateName: string, description: string) =>
      `⚠️  INFO: Using NetworkPolicy template '${templateName}': ${description}`,
  },
} as const;

/**
 * Predefined NetworkPolicy templates for common security patterns
 * @since 2.10.0
 */
export const PREDEFINED_NETWORK_POLICIES = {
  ALLOW_ALL_INGRESS: {
    name: 'allow-all-ingress',
    description: 'Allows all ingress traffic to pods with the specified selector.',
    policyTypes: ['Ingress'],
    ingress: [{}], // An empty rule matches all traffic
  },
  DENY_ALL_EGRESS: {
    name: 'deny-all-egress',
    description: 'Denies all egress traffic from pods with the specified selector.',
    policyTypes: ['Egress'],
    egress: [], // An empty array of egress rules denies all egress
  },
  ALLOW_INTERNAL_ONLY: {
    name: 'allow-internal-only',
    description: 'Allows ingress from within the same namespace and denies all egress.',
    policyTypes: ['Ingress', 'Egress'],
    ingress: [
      {
        from: [
          {
            podSelector: {}, // Allows from all pods in the same namespace
          },
        ],
      },
    ],
    egress: [], // Denies all egress
  },
} as const;

/**
 * Dangerous image tags that should trigger warnings
 * @since 2.9.0
 */
export const DANGEROUS_IMAGE_TAGS = [
  'latest',
  'master',
  'main',
  'dev',
  'development',
  'test',
  'testing',
  'staging',
  'unstable',
  'nightly',
  'edge',
  'canary',
  'current',
  'snapshot',
  'alpha',
  'beta',
  'rc',
  'trunk',
  'head',
  'tip',
] as const;

/**
 * AWS ARN validation patterns
 * @since 2.9.0
 */
export const AWS_ARN_PATTERNS = {
  GENERAL: /^arn:(aws|aws-us-gov|aws-cn):([a-z0-9-]+):([a-z0-9-]*):([0-9]{12}):(.+)$/,
  IAM_RESOURCE:
    /^(role|user|group|policy|server-certificate|instance-profile)\/[A-Za-z0-9+=,.@\-_/]+$/,
  ACCOUNT_ID: /^[0-9]{12}$/,
  VALID_PARTITIONS: ['aws', 'aws-us-gov', 'aws-cn'] as const,
} as const;

/**
 * Regex patterns for validation (with timeout protection)
 * @since 2.9.0
 */
export const VALIDATION_PATTERNS = {
  AWS_ARN: /^arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:[0-9]*:[a-zA-Z0-9-_/:]+$/,
  DOCKER_TAG: /^[a-zA-Z0-9._-]+$/,
  SEMVER: /^v?\d+\.\d+\.\d+$/,
  HASH: /^[a-f0-9]{7,64}$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  KUBERNETES_NAME: /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
  ENV_VAR_NAME: /^[A-Z_][A-Z0-9_]*$/,
  PATH_SEGMENT: /^[a-zA-Z_0-9][a-zA-Z0-9_-]*$/,
} as const;

/**
 * Length limits for various resources
 * @since 2.9.0
 */
export const LENGTH_LIMITS = {
  KUBERNETES_NAME: 63,
  IMAGE_TAG: 128,
  ENV_VAR_VALUE: 32768, // 32KB
  HELM_PATH: 253,
  PATH_SEGMENT: 63,
  ENVIRONMENT_NAME: 63,
} as const;

/**
 * Temporary file configuration
 * @since 2.9.0
 */
export const TEMP_FILE_CONFIG = {
  PREFIX: 'timonel',
  SUFFIX: '.ts',
  PERMISSIONS: {
    WORLD_WRITABLE_MASK: 0o002,
  },
} as const;
