// Manual verification of key test cases

function isValidKubernetesChar(char) {
  return (char >= 'a' && char <= 'z') || 
         (char >= '0' && char <= '9') || 
         char === '-';
}

function sanitizeKubernetesName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  
  if (name.length > 1000) {
    name = name.substring(0, 1000);
  }
  
  const lowerName = name.toLowerCase();
  let sanitized = '';
  let lastWasHyphen = false;
  
  for (const char of lowerName) {
    if (isValidKubernetesChar(char)) {
      if (char === '-') {
        if (!lastWasHyphen) {
          sanitized += char;
          lastWasHyphen = true;
        }
      } else {
        sanitized += char;
        lastWasHyphen = false;
      }
    } else {
      if (!lastWasHyphen) {
        sanitized += '-';
        lastWasHyphen = true;
      }
    }
  }
  
  while (sanitized.length > 0 && sanitized[0] === '-') {
    sanitized = sanitized.substring(1);
  }
  while (sanitized.length > 0 && sanitized[sanitized.length - 1] === '-') {
    sanitized = sanitized.substring(0, sanitized.length - 1);
  }
  
  return sanitized.substring(0, 63);
}

// Test key cases
console.log('Testing key cases:');
console.log('my-app:', sanitizeKubernetesName('my-app')); // Should be: my-app
console.log('MyApp:', sanitizeKubernetesName('MyApp')); // Should be: myapp
console.log('my_app:', sanitizeKubernetesName('my_app')); // Should be: my-app
console.log('my___app:', sanitizeKubernetesName('my___app')); // Should be: my-app
console.log('-my-app-:', sanitizeKubernetesName('-my-app-')); // Should be: my-app
console.log('empty string:', `"${sanitizeKubernetesName('')}"`); // Should be: ""
console.log('123app:', sanitizeKubernetesName('123app')); // Should be: 123app
console.log('my-app-🚀:', sanitizeKubernetesName('my-app-🚀')); // Should be: my-app

// Test ReDoS resistance
console.log('\nTesting ReDoS resistance:');
const start = Date.now();
const result = sanitizeKubernetesName('-'.repeat(1000) + 'test' + '_'.repeat(1000));
const end = Date.now();
console.log(`Processed large input in ${end - start}ms, result: "${result}"`);