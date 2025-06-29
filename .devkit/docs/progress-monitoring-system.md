# Progress Monitoring System

This document describes the comprehensive progress monitoring system for the manuscript downloader, designed to intelligently detect stuck vs slow downloads, provide user feedback, and optimize download performance.

## Overview

The progress monitoring system consists of four main components:

1. **ProgressMonitoringService** - Core monitoring engine
2. **DownloadProgressIntegration** - Integration layer with existing download services
3. **ProgressMonitoringConfig** - Configuration management
4. **ProgressMonitoringExample** - Usage examples and patterns

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐
│ Download Services   │───▶│ Progress Integration │
│ (Enhanced Downloader│    │                      │
│  Enhanced Queue)    │    └──────┬───────────────┘
└─────────────────────┘           │
                                  ▼
┌─────────────────────┐    ┌──────────────────────┐
│ Configuration       │───▶│ Progress Monitoring  │
│ (Library Settings,  │    │ Service              │
│  Timeout Rules)     │    │                      │
└─────────────────────┘    └──────┬───────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────┐
│ Event System                                    │
│ • Progress Updates    • Stuck Detection        │
│ • Timeout Events      • User Feedback          │
│ • Trend Analysis      • Recommendations        │
└─────────────────────────────────────────────────┘
```

## Core Features

### 1. Intelligent Progress Detection

#### Stuck vs Slow Download Detection
- **Stuck Downloads**: No progress for configurable time period (5-12 minutes depending on library)
- **Slow Downloads**: Progress below threshold (0.8-4.0 pages/min depending on library)
- **Trend Analysis**: Analyzes progress patterns over 15-minute windows

#### Library-Specific Configuration
```typescript
const libraryConfigs = {
  gallica: {
    stuckThresholdMinutes: 3,      // Fast server, quick detection
    slowProgressThreshold: 4.0,     // pages per minute
    timeoutMultiplier: 1.2
  },
  internet_culturale: {
    stuckThresholdMinutes: 8,      // Slower server responses
    slowProgressThreshold: 1.5,
    timeoutMultiplier: 2.0
  },
  manuscripta: {
    stuckThresholdMinutes: 10,     // Large file sizes
    slowProgressThreshold: 1.0,
    timeoutMultiplier: 3.0
  }
};
```

### 2. Configurable Timeout System

#### Dynamic Timeout Calculation
```typescript
timeout = baseTimeout × libraryMultiplier × pageCountMultiplier
```

#### Page Count Multipliers
- 1-200 pages: 1x
- 201-300 pages: 2x  
- 301-500 pages: 3x
- 501-800 pages: 4x
- 800+ pages: up to 6x (capped)

#### Example Timeout Calculations
| Library | Pages | Base | Library | Page | Total |
|---------|-------|------|---------|------|-------|
| Gallica | 150   | 15min| 1.2x    | 1x   | 18min |
| Internet Culturale | 800 | 15min | 2.0x | 5x | 150min |
| Manuscripta | 300 | 15min | 3.0x | 3x | 135min |

### 3. Progress Trend Analysis

#### Metrics Collected
- **Average Speed**: Pages downloaded per minute
- **Time to Completion**: Estimated minutes remaining
- **Confidence Level**: Based on sample size and consistency
- **Progress Pattern**: Detecting acceleration/deceleration

#### Trend Analysis Algorithm
```typescript
interface ProgressTrend {
  isStuck: boolean;           // No progress in recent samples
  isSlow: boolean;            // Below threshold speed
  averageSpeed: number;       // Pages per minute
  timeToCompletion: number;   // Estimated minutes
  confidence: number;         // 0-1 confidence level
  recommendation: string;     // continue/split/abort/increase_concurrency
}
```

### 4. Intelligent Recommendations

#### Recommendation Engine
The system provides actionable recommendations based on progress analysis:

- **Continue**: Normal progress, no action needed
- **Split**: Large manuscript or slow progress, recommend splitting
- **Abort**: Stuck download unlikely to recover
- **Increase Concurrency**: Slow but steady progress, more concurrent downloads may help

#### Recommendation Logic
```typescript
if (totalPages > recommendSplitThreshold) return 'split';
if (isStuck && estimatedTime > 30min) return 'abort';
if (isSlow && estimatedTime > 60min) return 'split';
if (isSlow && estimatedTime < 60min) return 'increase_concurrency';
return 'continue';
```

## Integration Guide

### 1. Basic Integration

```typescript
import { DownloadProgressIntegration } from './ProgressMonitoringIntegration.js';

const progressIntegration = new DownloadProgressIntegration();
const downloader = new EnhancedManuscriptDownloaderService();

const sessionId = `download_${Date.now()}`;
const options = progressIntegration.wrapDownloadOptions(
  sessionId,
  manuscriptUrl,
  library,
  totalPages,
  {
    onProgress: (progress) => {
      console.log(`${progress.percentage}% - ${progress.trend?.averageSpeed} pages/min`);
      
      if (progress.isSlow || progress.isStuck) {
        console.warn(`Warning: ${progress.recommendation}`);
      }
    }
  }
);

await downloader.downloadManuscript(manuscriptUrl, options);
progressIntegration.completeDownload(sessionId);
```

### 2. Queue Integration

```typescript
// In EnhancedDownloadQueue.ts
import { DownloadProgressIntegration } from './ProgressMonitoringIntegration.js';

class EnhancedDownloadQueue {
  private progressIntegration = new DownloadProgressIntegration();
  
  private async processItem(item: QueuedManuscript) {
    const sessionId = `queue_${item.id}`;
    
    const options = this.progressIntegration.wrapDownloadOptions(
      sessionId,
      item.url,
      item.library,
      item.totalPages,
      {
        onProgress: (progress) => {
          // Update queue item with enhanced progress
          item.progress = {
            ...progress,
            trend: progress.trend,
            recommendation: progress.recommendation
          };
          this.emit('itemProgress', item);
        }
      }
    );
    
    try {
      await this.downloader.downloadManuscript(item.url, options);
      this.progressIntegration.completeDownload(sessionId, true);
    } catch (error) {
      this.progressIntegration.completeDownload(sessionId, false);
      throw error;
    }
  }
}
```

### 3. Event Handling

```typescript
import { ProgressMonitoringService } from './ProgressMonitoringService.js';

const progressMonitor = ProgressMonitoringService.getInstance();

// Handle stuck downloads
progressMonitor.on('stuckDetected', (event) => {
  console.warn(`Stuck download: ${event.library} (${event.sessionId})`);
  
  if (event.recommendation === 'abort') {
    // Cancel download
    progressMonitor.cancelSession(event.sessionId);
  } else if (event.recommendation === 'split') {
    // Suggest splitting to user
    showSplitRecommendation(event.sessionId);
  }
});

// Handle slow progress
progressMonitor.on('slowProgress', (event) => {
  if (event.timeToCompletion > 60) {
    console.log(`Long download detected: ${event.timeToCompletion} minutes remaining`);
    showProgressAlert(event.sessionId, event.timeToCompletion);
  }
});

// Handle timeouts
progressMonitor.on('timeout', (event) => {
  console.error(`Download timeout: ${event.library} after ${event.timeoutMinutes} minutes`);
  handleDownloadTimeout(event.sessionId, event.totalPages);
});
```

## Configuration

### 1. Library-Specific Settings

```typescript
import { progressMonitoringConfig } from './ProgressMonitoringConfig.js';

// Update library configuration
progressMonitoringConfig.updateLibraryConfig('internet_culturale', {
  timeoutMultiplier: 2.5,           // Increase timeout
  stuckThresholdMinutes: 10,        // More patience for stuck detection
  slowProgressThreshold: 1.0,       // Lower threshold for slow detection
  recommendSplitAbovePages: 300     // Split earlier for large downloads
});
```

### 2. Global Settings

```typescript
// Update global monitoring settings
progressMonitoringConfig.updateGlobalConfig({
  enableProgressMonitoring: true,
  enableUserFeedback: true,
  feedbackIntervalMinutes: 3,       // More frequent feedback
  trendAnalysisWindowMinutes: 10    // Shorter analysis window
});
```

### 3. Runtime Configuration

```typescript
// Get download recommendation
const recommendation = progressMonitoringConfig.getDownloadRecommendation(
  'internet_culturale',
  800,    // totalPages
  400,    // currentProgress
  1.2,    // averageSpeed (pages/min)
  45      // estimatedTimeRemaining (minutes)
);

console.log(`Recommendation: ${recommendation.action} - ${recommendation.reason}`);
```

## Testing

### Running Tests

```bash
# Run comprehensive test suite
npm run test:progress-monitoring

# Or run specific test file
npx ts-node .devkit/analysis/progress-monitoring-test.ts
```

### Test Coverage

The test suite covers:
- ✅ Session creation and management
- ✅ Progress update handling
- ✅ Trend analysis accuracy
- ✅ Timeout detection
- ✅ Stuck download detection
- ✅ Slow progress detection
- ✅ Library configuration validation
- ✅ Recommendation engine
- ✅ Integration with download services
- ✅ Multiple concurrent sessions
- ✅ Memory usage and cleanup
- ✅ Error handling

### Example Test Output

```
🧪 Starting Progress Monitoring System Tests...

✅ Session Creation - 15ms
✅ Progress Updates - 23ms
✅ Trend Analysis - 45ms
✅ Timeout Detection - 678ms
✅ Stuck Detection - 634ms
✅ Slow Progress Detection - 34ms
✅ Session Completion - 156ms
✅ Library Configurations - 12ms
✅ Timeout Calculations - 8ms
✅ Recommendation Engine - 19ms
✅ Download Integration - 67ms
✅ Multiple Sessions Handling - 234ms
✅ Error Handling - 5ms
✅ Memory Usage - 156ms
✅ Concurrent Sessions - 287ms

📊 Test Results Summary:
   Total: 15
   Passed: 15
   Failed: 0
   Duration: 2373ms

🎉 All tests passed!
```

## Performance Considerations

### Memory Management
- Automatic cleanup of old progress snapshots (15-minute window)
- Session cleanup after completion (30-second delay)
- Maximum concurrent sessions limit (configurable)

### CPU Optimization
- Monitoring checks every 10 seconds (configurable)
- Trend analysis only when sufficient data available
- Event-driven architecture minimizes polling

### Network Impact
- No additional network requests
- Minimal overhead on existing download operations
- Progress updates are lightweight

## Error Handling

### Graceful Degradation
- System continues to function if monitoring fails
- Original download behavior preserved
- Automatic recovery from monitoring errors

### Error Scenarios
- Non-existent session operations (safely ignored)
- Configuration loading failures (defaults used)
- Event handler exceptions (isolated and logged)
- Resource cleanup failures (logged but non-blocking)

## Future Enhancements

### Planned Features
1. **Machine Learning**: Adaptive timeout prediction based on historical data
2. **Network Quality Detection**: Adjust thresholds based on connection quality
3. **Predictive Splitting**: Auto-split before problems occur
4. **Progress Persistence**: Resume monitoring across app restarts
5. **Analytics Dashboard**: Visual progress monitoring interface

### Extension Points
- Custom monitoring strategies per library
- Pluggable recommendation algorithms
- External event handlers (webhooks, notifications)
- Performance metrics collection

## Migration Guide

### From Existing Timeout System

The new progress monitoring system is designed to be backward compatible:

1. **Existing timeout logic**: Preserved and enhanced
2. **AbortController patterns**: Fully supported
3. **Progress callbacks**: Enhanced with trend data
4. **Library optimizations**: Integrated seamlessly

### Integration Steps

1. Import progress monitoring services
2. Wrap existing download options
3. Handle enhanced progress events
4. Configure library-specific settings
5. Test with existing download flows

### Rollback Strategy

If issues arise, the system can be disabled:

```typescript
progressMonitoringConfig.updateGlobalConfig({
  enableProgressMonitoring: false
});
```

This reverts to original download behavior while preserving all existing functionality.

## Support and Troubleshooting

### Debug Mode

Enable detailed logging:

```typescript
progressMonitoringConfig.updateGlobalConfig({
  enableProgressLogging: true,
  enablePerformanceMetrics: true
});
```

### Common Issues

1. **Timeouts too short**: Increase library timeout multiplier
2. **False stuck detection**: Increase stuck threshold minutes  
3. **Slow detection too sensitive**: Lower slow progress threshold
4. **Memory usage**: Reduce trend analysis window

### Getting Help

- Check the examples in `ProgressMonitoringExample.ts`
- Run the test suite to verify functionality
- Review library-specific configurations
- Enable debug logging for detailed information