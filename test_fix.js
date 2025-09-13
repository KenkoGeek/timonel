// Simple test script to verify the sanitizeKubernetesName function fix
// This tests the core functionality without needing to build the project

/**
 * Checks if a character is valid for Kubernetes names
 * @param char - Character to check
 * @returns True if character is valid (a-z, 0-9, or hyphen)
 */
function isValidKubernetesChar(char) {
  return (char >= 'a' && char <= 'z') || 
         (char >= '0' && char <= '9') || 
         char === '-';
}

/**
 * Sanitizes name for Kubernetes compatibility (fixed version)
 * @param name - Raw name to sanitize
 * @returns Kubernetes-compatible name
 */
function sanitizeKubernetesName(name) {
  // Input validation to prevent processing extremely large strings
  if (!name || typeof name !== 'string') {
    return '';
  }
  
  // Prevent processing of maliciously large inputs
  if (name.length > 1000) {
    name = name.substring(0, 1000);
  }
  
  const lowerName = name.toLowerCase();
  let sanitized = '';
  let lastWasHyphen = false;
  
  // Character-by-character processing to avoid ReDoS vulnerability
  for (const char of lowerName) {
    if (isValidKubernetesChar(char)) {
      if (char === '-') {
        // Only add hyphen if the last character wasn't a hyphen
        if (!lastWasHyphen) {
          sanitized += char;
          lastWasHyphen = true;
        }
      } else {
        sanitized += char;
        lastWasHyphen = false;
      }
    } else {
      // Replace invalid character with hyphen, but avoid consecutive hyphens
      if (!lastWasHyphen) {
        sanitized += '-';
        lastWasHyphen = true;
      }
    }
  }
  
  // Remove leading and trailing hyphens using string operations
  while (sanitized.length > 0 && sanitized[0] === '-') {
    sanitized = sanitized.substring(1);
  }
  while (sanitized.length > 0 && sanitized[sanitized.length - 1] === '-') {
    sanitized = sanitized.substring(0, sanitized.length - 1);
  }
  
  // Truncate to Kubernetes name length limit
  return sanitized.substring(0, 63);
}

// Test cases from the original test suite
const testCases = [
  // Basic functionality
  { input: 'my-app', expected: 'my-app', description: 'valid names unchanged' },
  { input: 'web-service-123', expected: 'web-service-123', description: 'valid names unchanged' },
  { input: 'a', expected: 'a', description: 'single character' },
  
  // Case conversion
  { input: 'MyApp', expected: 'myapp', description: 'uppercase to lowercase' },
  { input: 'WEB-SERVICE', expected: 'web-service', description: 'uppercase to lowercase' },
  
  // Invalid character replacement
  { input: 'my_app', expected: 'my-app', description: 'underscore replacement' },
  { input: 'my.app', expected: 'my-app', description: 'dot replacement' },
  { input: 'my@app', expected: 'my-app', description: 'at symbol replacement' },
  { input: 'my app', expected: 'my-app', description: 'space replacement' },
  
  // Leading/trailing hyphens
  { input: '-my-app-', expected: 'my-app', description: 'remove leading/trailing hyphens' },
  { input: '--my-app--', expected: 'my-app', description: 'remove multiple leading/trailing hyphens' },
  
  // Consecutive invalid characters
  { input: 'my___app', expected: 'my-app', description: 'consecutive underscores' },
  { input: 'my...app', expected: 'my-app', description: 'consecutive dots' },
  { input: 'my   app', expected: 'my-app', description: 'consecutive spaces' },
  
  // Edge cases
  { input: '', expected: '', description: 'empty string' },
  { input: '123', expected: '123', description: 'numbers only' },
  { input: 'a-b-c', expected: 'a-b-c', description: 'valid hyphens' },
  { input: '123app', expected: '123app', description: 'starting with numbers' },
  { input: '1-app', expected: '1-app', description: 'starting with number and hyphen' },
  
  // Unicode and special characters
  { input: 'my-app-🚀', expected: 'my-app', description: 'emoji removal' },
  { input: 'app-中文', expected: 'app', description: 'unicode removal' },
  
  // Long names
  { input: 'a'.repeat(70), expected: 'a'.repeat(63), description: 'truncation' },
  
  // Complex cases
  { input: 'My_Complex.App@Name', expected: 'my-complex-app-name', description: 'complex mixed characters' },
  { input: '__My.App@2024__', expected: 'my-app-2024', description: 'messy name cleanup' },
];

console.log('Testing sanitizeKubernetesName function...\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = sanitizeKubernetesName(testCase.input);
  const success = result === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✅ PASS: ${testCase.description}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: "${testCase.expected}"`);
    console.log(`   Got: "${result}"`);
  }
}

console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

// Test ReDoS resistance with large inputs
console.log('\nTesting ReDoS resistance...');

const start = Date.now();
const maliciousInput = '-'.repeat(10000) + 'app' + '_'.repeat(10000);
const result = sanitizeKubernetesName(maliciousInput);
const end = Date.now();

console.log(`✅ Processed malicious input (${maliciousInput.length} chars) in ${end - start}ms`);
console.log(`   Result length: ${result.length}`);
console.log(`   Result: "${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! The fix is working correctly.');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. The implementation needs adjustment.`);
}