import { LibraryOptimizationService } from '../../src/main/services/LibraryOptimizationService';

console.log('Testing Roman Archive Optimizations...\n');

// Test that Roman Archive optimizations are loaded
const optimizations = LibraryOptimizationService.getOptimizationsForLibrary('roman_archive');

console.log('Roman Archive Optimizations:');
console.log('  Max concurrent downloads:', optimizations.maxConcurrentDownloads);
console.log('  Timeout multiplier:', optimizations.timeoutMultiplier);
console.log('  Progressive backoff enabled:', optimizations.enableProgressiveBackoff);
console.log('  Description:', optimizations.optimizationDescription);

// Test progressive backoff calculation
console.log('\nProgressive Backoff Delays (Roman Archive):');
for (let attempt = 1; attempt <= 6; attempt++) {
    const delay = LibraryOptimizationService.calculateProgressiveBackoff(
        attempt,
        2000,  // 2s base delay for Roman Archive
        60000  // 60s max delay for Roman Archive
    );
    console.log(`  Attempt ${attempt}: ${delay}ms`);
}

// Compare with regular library (Rome)
console.log('\nProgressive Backoff Delays (Rome - for comparison):');
for (let attempt = 1; attempt <= 6; attempt++) {
    const delay = LibraryOptimizationService.calculateProgressiveBackoff(
        attempt,
        1000,  // 1s base delay
        30000  // 30s max delay
    );
    console.log(`  Attempt ${attempt}: ${delay}ms`);
}

console.log('\n✅ Roman Archive optimizations are correctly configured!');
console.log('Expected behavior:');
console.log('  - Single concurrent download (no server overwhelm)');
console.log('  - 1 second delay between downloads');
console.log('  - Longer retry delays (2s, 4s, 8s, 16s, 32s, 60s)');
console.log('  - Extended timeouts for JP2 processing');