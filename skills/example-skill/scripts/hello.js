// Example JavaScript skill script
// This runs in a VM2 sandbox environment

const params = SKILL_PARAMS;
const message = params.message || 'Hello from JavaScript skill!';
const count = parseInt(params.count, 10) || 3;

console.log('Starting JavaScript skill execution...');
console.log(`Message: ${message}`);
console.log(`Count: ${count}`);

// Generate output
const outputs = [];
for (let i = 1; i <= count; i++) {
  const line = `[${i}/${count}] ${message}`;
  console.log(line);
  outputs.push(line);
}

// Create an artifact
const report = {
  timestamp: new Date().toISOString(),
  message: message,
  count: count,
  outputs: outputs,
  environment: 'VM2 Sandbox',
};

// Write artifact using the injected function
writeArtifact('report.json', JSON.stringify(report, null, 2));

console.log('JavaScript skill execution completed!');
console.log('Artifact created: report.json');

// Return result
({ success: true, outputCount: outputs.length });
