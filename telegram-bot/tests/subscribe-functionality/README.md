# Subscribe Functionality Test Suite

This directory contains comprehensive tests for the Telegram bot subscribe/unsubscribe functionality.

## Test Files

### 1. `test-subscribe-functionality.cjs`
**Basic functionality test suite**
- Tests bot responsiveness to commands
- Validates subscribers.json file structure
- Tests subscription workflow basics
- **Runtime**: ~30 seconds

### 2. `test-interactive-subscribe.cjs`
**Comprehensive logic testing**
- Tests all subscription combinations
- Validates file integrity operations
- Tests duplicate prevention
- Tests platform validation
- **Runtime**: ~45 seconds

### 3. `test-callback-simulation.cjs`
**End-to-end user interaction simulation**
- Simulates button clicks and menu navigation
- Tests complete user journey
- Validates subscription state tracking
- **Runtime**: ~60 seconds

## Running the Tests

### Prerequisites
- Set the `TELEGRAM_BOT_TOKEN` environment variable
- Ensure the bot is not currently running in polling mode (to avoid conflicts)

### Run Individual Tests
```bash
# Basic functionality test
TELEGRAM_BOT_TOKEN="your_token_here" node tests/subscribe-functionality/test-subscribe-functionality.cjs

# Interactive logic test
TELEGRAM_BOT_TOKEN="your_token_here" node tests/subscribe-functionality/test-interactive-subscribe.cjs

# Callback simulation test
TELEGRAM_BOT_TOKEN="your_token_here" node tests/subscribe-functionality/test-callback-simulation.cjs
```

### Run All Tests
```bash
# Run complete test suite
cd tests/subscribe-functionality
for test in test-*.cjs; do
    echo "Running $test..."
    TELEGRAM_BOT_TOKEN="your_token_here" node "$test"
    echo "---"
done
```

## Test Results Summary

All tests should pass with 100% success rate:
- **Total Test Cases**: 26
- **Expected Success Rate**: 100%
- **Test Coverage**: Complete subscription functionality

## Safety Features

- **Backup Protection**: Tests backup and restore the original subscribers.json
- **Isolated Test Data**: Uses unique test subscriber IDs to avoid conflicts
- **Non-Destructive**: Tests don't affect real subscriber data
- **Cleanup**: All tests clean up after themselves

## What Gets Tested

### Subscription Operations
- Individual platform subscriptions (AMD64, ARM64, Linux)
- All platforms subscription
- Individual platform unsubscription
- Complete unsubscription

### Data Management
- File integrity and JSON structure
- Duplicate subscription prevention
- Proper add/remove operations
- Backup and restore functionality

### Bot Interactions
- Command processing (/start, /subscribe, /unsubscribe, /latest)
- Menu navigation simulation
- Status tracking and display
- Error handling

### Platform Support
- Windows AMD64 support
- Windows ARM64 support  
- Linux AppImage support
- Multi-platform combinations

## Expected Output

Each test provides detailed output including:
- ✅ Passed tests with green checkmarks
- ❌ Failed tests with error details (should be none)
- 📊 Summary statistics
- 📱 Current subscription state
- 🧹 Cleanup confirmation

## Troubleshooting

### Common Issues
1. **Token Error**: Ensure `TELEGRAM_BOT_TOKEN` is set correctly
2. **Bot Conflicts**: Stop any running bot instances before testing
3. **File Permissions**: Ensure write access to subscribers.json
4. **Network Issues**: Tests require internet connection for Telegram API

### Debug Mode
Add debug logging by modifying the test files to include:
```javascript
console.log('Debug info:', variableToInspect);
```

## Integration

These tests are designed to be run:
- **Before deployment**: Verify functionality before releasing
- **After changes**: Ensure modifications don't break existing features
- **Regular testing**: Periodic validation of bot health
- **CI/CD pipeline**: Automated testing in build processes

---
*Last updated: June 22, 2025*