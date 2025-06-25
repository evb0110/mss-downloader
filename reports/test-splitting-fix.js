#!/usr/bin/env node

/*
 * Test script to verify the manuscript splitting bug fix
 * Tests that split items have 'pending' status instead of 'queued'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Manuscript Splitting Bug Fix\n');

// Check that the fix is in place
const queueServicePath = path.join(__dirname, '..', 'src', 'main', 'services', 'EnhancedDownloadQueue.ts');

if (!fs.existsSync(queueServicePath)) {
    console.error('❌ EnhancedDownloadQueue.ts not found');
    process.exit(1);
}

const queueServiceContent = fs.readFileSync(queueServicePath, 'utf8');

// Test 1: Check that split items are created with 'pending' status
const splitItemRegex = /displayName: `\${manifest\.displayName}_Part_\${partNumber}_pages_\${startPage}-\${endPage}`[^}]*status: 'pending'/s;
const hasPendingStatus = splitItemRegex.test(queueServiceContent);

console.log('✅ Test 1: Split items created with "pending" status:', hasPendingStatus ? 'PASS' : 'FAIL');

// Test 2: Check that resume logic handles 'queued' items
const resumeLogicRegex = /if \(item\.status === 'queued'\) \{[^}]*item\.status = 'pending'/s;
const hasQueuedFix = resumeLogicRegex.test(queueServiceContent);

console.log('✅ Test 2: Resume logic handles "queued" items:', hasQueuedFix ? 'PASS' : 'FAIL');

// Test 3: Check that both fixes are present
const bothFixesPresent = hasPendingStatus && hasQueuedFix;

console.log('\n📊 Overall Fix Status:', bothFixesPresent ? '✅ FIXED' : '❌ INCOMPLETE');

if (bothFixesPresent) {
    console.log('\n🎉 The manuscript splitting bug has been successfully fixed!');
    console.log('   - Split parts are now created with "pending" status');
    console.log('   - Resume logic now handles stuck "queued" items');
    console.log('   - Rome/Vatican manuscripts should no longer get stuck in Resume queue');
} else {
    console.log('\n⚠️  Fix incomplete. Missing components:');
    if (!hasPendingStatus) console.log('   - Split items still created with "queued" status');
    if (!hasQueuedFix) console.log('   - Resume logic does not handle "queued" items');
}

process.exit(bothFixesPresent ? 0 : 1);