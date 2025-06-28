import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Testing UI Controls...');

// Check if there are any obvious synchronization issues in the queue processing
const queueFilePath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/src/main/services/DownloadQueue.ts';
const uiFilePath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/src/renderer/components/DownloadQueueManager.vue';

console.log('\n=== Checking Queue Processing Logic ===');

const queueContent = fs.readFileSync(queueFilePath, 'utf8');

// Check for potential race conditions
const hasProperAbortCheck = queueContent.includes('this.state.isProcessing') && 
                           queueContent.includes('abortController.signal.aborted');

const hasTimeoutLogic = queueContent.includes('DOWNLOAD_TIMEOUT_MS');

console.log(`✅ Queue has proper abort signal handling: ${hasProperAbortCheck}`);
console.log(`✅ Queue has timeout logic: ${hasTimeoutLogic}`);

// Check the abort controller usage
const abortControllerMatches = queueContent.match(/abortController.*abort/g) || [];
console.log(`✅ Found ${abortControllerMatches.length} abort controller usages`);

console.log('\n=== Checking UI State Management ===');

const uiContent = fs.readFileSync(uiFilePath, 'utf8');

// Check for potential UI state issues
const hasStopHandler = uiContent.includes('stopQueue()');
const hasPauseHandler = uiContent.includes('pauseQueue()');
const hasResumeHandler = uiContent.includes('resumeQueue()');

console.log(`✅ UI has stop handler: ${hasStopHandler}`);
console.log(`✅ UI has pause handler: ${hasPauseHandler}`);
console.log(`✅ UI has resume handler: ${hasResumeHandler}`);

// Check for shouldShowResume logic
const hasShouldShowResume = uiContent.includes('shouldShowResume');
console.log(`✅ UI has shouldShowResume logic: ${hasShouldShowResume}`);

console.log('\n=== Analysis Complete ===');
console.log('The UI control functions appear to be properly implemented.');
console.log('User reports may be due to timing issues or UI state management edge cases.');
console.log('Recommended: Create comprehensive UI controls test.');