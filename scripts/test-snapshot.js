#!/usr/bin/env node
/**
 * Test script for generate-snapshot.js
 * Validates snapshot structure and regime calculations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DATE = '2026-07-23';
const SNAPSHOT_PATH = path.join(process.cwd(), 'public', 'data', 'snapshots', `${TEST_DATE}.json`);

console.log('🧪 Testing snapshot generator...\n');

// Test 1: Script runs without error
try {
  execSync(`node scripts/generate-snapshot.js --date=${TEST_DATE}`, { stdio: 'inherit' });
  console.log('✅ Generator executed successfully\n');
} catch (err) {
  console.error('❌ Generator failed:', err.message);
  process.exit(1);
}

// Test 2: Snapshot file exists
if (!fs.existsSync(SNAPSHOT_PATH)) {
  console.error('❌ Snapshot file not created');
  process.exit(1);
}
console.log('✅ Snapshot file created\n');

// Test 3: Valid JSON structure
let snapshot;
try {
  snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  console.log('✅ Valid JSON\n');
} catch (err) {
  console.error('❌ Invalid JSON:', err.message);
  process.exit(1);
}

// Test 4: Required fields
const requiredFields = ['date', 'vix', 'spx', 'breadth', 'treasury10y', 'dxy', 'computed'];
const missing = requiredFields.filter(f => !(f in snapshot));
if (missing.length > 0) {
  console.error('❌ Missing fields:', missing.join(', '));
  process.exit(1);
}
console.log('✅ All required fields present\n');

// Test 5: Computed values
const { computed } = snapshot;
const validRegimes = ['BULL_QUIET', 'BULL_VOLATILE', 'BEAR_QUIET', 'BEAR_VOLATILE', 'CRISIS'];

if (!validRegimes.includes(computed.regime)) {
  console.error('❌ Invalid regime:', computed.regime);
  process.exit(1);
}
console.log(`✅ Valid regime: ${computed.regime}\n`);

if (computed.riskScore < 0 || computed.riskScore > 100) {
  console.error('❌ Risk score out of range:', computed.riskScore);
  process.exit(1);
}
console.log(`✅ Risk score in range: ${computed.riskScore}\n`);

if (typeof computed.circuitBreaker !== 'boolean') {
  console.error('❌ Circuit breaker not boolean');
  process.exit(1);
}
console.log(`✅ Circuit breaker: ${computed.circuitBreaker ? '🔴' : '🟢'}\n`);

// Test 6: latest.json symlink
const latestPath = path.join(process.cwd(), 'public', 'data', 'snapshots', 'latest.json');
if (!fs.existsSync(latestPath)) {
  console.error('❌ latest.json not created');
  process.exit(1);
}
console.log('✅ latest.json updated\n');

console.log('🎉 All tests passed!');
