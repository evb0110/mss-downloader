# MSS Downloader Telegram Bot - Complete Workflow Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Environment Management](#environment-management)
3. [Development Workflow](#development-workflow)
4. [Testing Procedures](#testing-procedures)
5. [Production Deployment](#production-deployment)
6. [Changelog Generation](#changelog-generation)
7. [Configuration Management](#configuration-management)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

## System Overview

The MSS Downloader Telegram Bot provides automated notifications to subscribers when new builds are available across multiple platforms. The system consists of:

- **Build Detection**: Automatic detection of new releases
- **Changelog Generation**: Semantic parsing of git commits into user-friendly descriptions
- **Notification System**: Multi-platform delivery via Telegram
- **Subscriber Management**: User subscription and platform preference handling

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub        │    │   Telegram Bot  │    │   Subscribers   │
│   Releases      │───▶│   Core System   │───▶│   Notification  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Build         │    │   Changelog     │    │   User          │
│   Detection     │    │   Generation    │    │   Management    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Environment Management

### Environment Types

1. **Development** (`NODE_ENV=development`)
   - Local testing with developer-only notifications
   - Uses test token and limited subscriber list
   - Debug logging enabled

2. **Staging** (`NODE_ENV=staging`)
   - Pre-production validation
   - QA team testing with production-like data
   - Full logging and monitoring

3. **Production** (`NODE_ENV=production`)
   - Live user notifications
   - Production token and full subscriber list
   - Optimized performance and security

### Environment Configuration

```bash
# Development
export NODE_ENV=development
export DEBUG=true
export TELEGRAM_BOT_TOKEN="test_token"

# Staging
export NODE_ENV=staging
export TELEGRAM_BOT_TOKEN="staging_token"

# Production
export NODE_ENV=production
export TELEGRAM_BOT_TOKEN="production_token"
```

## Development Workflow

### Setup

1. **Clone and Install**
   ```bash
   git clone <repository>
   cd telegram-bot
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.template .env.development
   # Edit .env.development with test token
   ```

3. **Build and Start**
   ```bash
   npm run build
   npm run start
   ```

### Development Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start bot in current environment
- `npm run dev` - Development mode with hot reload
- `npm run test` - Run test suite
- `npm run lint` - Check code quality

## Testing Procedures

### Test Categories

1. **Unit Tests**
   - Semantic parsing logic
   - Library mapping functionality
   - User benefit translation

2. **Integration Tests**
   - End-to-end changelog generation
   - Telegram API integration
   - Configuration validation

3. **Manual Testing**
   - Real commit message parsing
   - User notification delivery
   - Subscriber management

### Testing Scripts

```bash
# Test changelog generation for specific user only
./test-changelog-evb0110-only.sh

# Validate semantic parsing
node test-semantic-parsing.js

# Test configuration validation
npm run test:config
```

### Test Environment Safety

All testing is isolated to prevent production impact:

- **Test Mode Flag**: `testMode: true` limits notifications to admin only
- **Development Environment**: Uses separate token and subscriber list
- **Mock Data**: Test scenarios use generated data, not production releases

## Production Deployment

### Deployment Process

1. **Pre-deployment Validation**
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

2. **Configuration Verification**
   ```bash
   npm run validate:config
   npm run check:tokens
   ```

3. **Deploy to Staging**
   ```bash
   npm run deploy:staging
   npm run test:staging
   ```

4. **Production Deployment**
   ```bash
   npm run deploy:production
   npm run monitor:health
   ```

### GitHub Actions Integration

The bot integrates with GitHub Actions for automated deployment:

```yaml
- name: Deploy Telegram Bot
  run: |
    cd telegram-bot
    npm run build
    node dist/send-multiplatform-build.js
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    NODE_ENV: production
```

## Changelog Generation

### Semantic Parsing System

The changelog generation uses advanced semantic parsing to convert technical git commits into user-friendly descriptions:

#### Library Mapping (47+ Libraries)

```typescript
const LIBRARY_MAPPINGS = {
  'internet culturale': 'Internet Culturale (Italian Cultural Heritage)',
  'university of graz': 'University of Graz (Austria)',
  'rome bnc': 'Rome National Central Library (Italy)',
  // ... 44 more libraries with geographic context
};
```

#### Action Detection

- `fix/resolve` → "Fixed [Library] [Issue Type]"
- `add` → "Added [Library] manuscript collection support"
- `implement` → "Improved [Functionality] with [Benefit]"
- `improve/enhance` → "Enhanced [Aspect] for better [Outcome]"

#### Issue Type Classification

- `timeout` → "loading timeouts for large manuscripts"
- `infinite_loop` → "infinite download loops"
- `hanging` → "hanging downloads"
- `authentication` → "authentication handling"
- `performance` → "download performance"

### Changelog Generation Flow

```
Git Commit → Version Detection → Semantic Parsing → Library Mapping → 
Issue Classification → User Benefit Translation → Changelog Entry
```

### Example Transformations

| Technical Commit | User-Facing Benefit |
|------------------|-------------------|
| `Fix University of Graz timeouts` | `Fixed University of Graz (Austria) loading timeouts for large manuscripts` |
| `Add Rome BNC libroantico support` | `Added Rome National Central Library (Italy) manuscript collection support` |
| `Implement intelligent progress monitoring` | `Improved download reliability with real-time progress tracking` |

## Configuration Management

### Configuration Hierarchy

1. **Default Configuration** - Base settings for all environments
2. **Environment Overrides** - Environment-specific settings
3. **Local Overrides** - Developer-specific settings (not committed)
4. **Runtime Overrides** - Dynamic configuration updates

### Configuration Files

```
config/
├── default.json          # Base configuration
├── development.json      # Development overrides
├── staging.json         # Staging overrides
├── production.json      # Production overrides
└── local.json          # Local overrides (gitignored)
```

### Security Configuration

- **Token Encryption**: All tokens encrypted at rest
- **Environment Separation**: Strict isolation between environments
- **Access Control**: Role-based access to configuration
- **Audit Logging**: All configuration changes logged

## Monitoring & Maintenance

### Health Checks

- **Bot Responsiveness**: Regular ping/pong tests
- **API Connectivity**: Telegram API health monitoring
- **Configuration Validation**: Continuous config integrity checks
- **Subscriber Management**: User engagement metrics

### Monitoring Dashboards

1. **Operational Metrics**
   - Message delivery rates
   - API response times
   - Error frequencies
   - Subscriber growth

2. **Quality Metrics**
   - Changelog parsing success rates
   - User feedback scores
   - Configuration validation results

### Alerting Rules

- **Critical**: Bot offline, API failures, configuration errors
- **Warning**: High error rates, slow response times
- **Info**: New subscribers, configuration changes

## Troubleshooting

### Common Issues

1. **Generic Changelog Messages**
   - **Cause**: Version mismatch between package.json and git commits
   - **Solution**: Verify commit exists for current version
   - **Debug**: Check `📝 Generating changelog for actual version` log

2. **Build Detection Failures**
   - **Cause**: Missing build files or GitHub API issues
   - **Solution**: Verify release assets exist
   - **Debug**: Check build detection logs

3. **Notification Delivery Issues**
   - **Cause**: Invalid token or network connectivity
   - **Solution**: Verify token and network access
   - **Debug**: Check Telegram API responses

### Debug Commands

```bash
# Test changelog parsing for specific version
node debug-changelog.js --version=1.3.58

# Validate configuration
npm run validate:config

# Test Telegram connectivity
node test-telegram-connection.js

# Check subscriber list
node list-subscribers.js
```

### Log Analysis

Key log patterns to monitor:

```
📝 Generating changelog for actual version v1.3.58 (build version: v1.3.36)
✅ Fixed University of Graz (Austria) loading timeouts for large manuscripts
🤖 Sending multiplatform build notification...
✅ Multiplatform build notification sent successfully!
```

## API Reference

### Core Classes

#### `MultiplatformMSSBot`

Main bot class handling Telegram interactions.

```typescript
class MultiplatformMSSBot {
  // Initialize bot with configuration
  constructor(token: string, config: BotConfig)
  
  // Send notifications to subscribers
  async notifySubscribers(message: string, builds: BuildInfo[], testMode?: boolean): Promise<void>
  
  // Manage subscriber subscriptions
  async handleSubscribe(chatId: number, platform: Platform): Promise<void>
  async handleUnsubscribe(chatId: number, platform: Platform): Promise<void>
  
  // Bot lifecycle management
  async shutdown(): Promise<void>
}
```

#### `ChangelogGenerator`

Handles semantic parsing and changelog generation.

```typescript
class ChangelogGenerator {
  // Generate changelog from git commits
  static getChangelogFromCommits(version: string): string
  
  // Extract user-facing changes from commit message
  static extractUserFacingChangesFromVersionCommit(commitMessage: string): string[]
  
  // Parse semantic components from description
  static parseSemanticComponents(description: string): SemanticComponent[]
  
  // Translate technical terms to user benefits
  static translateToUserBenefit(component: SemanticComponent): string | null
}
```

### Configuration Schema

```typescript
interface BotConfig {
  telegram: {
    token: string;
    adminChatId: number;
    retryAttempts: number;
  };
  
  environment: {
    mode: 'development' | 'staging' | 'production';
    debug: boolean;
    testMode: boolean;
  };
  
  changelog: {
    searchDepth: number;
    libraryMappings: Record<string, string>;
    fallbackMessage: string;
  };
  
  monitoring: {
    healthCheckInterval: number;
    alertThresholds: AlertThresholds;
  };
}
```

## Best Practices

### Development

1. **Always test in development environment first**
2. **Use semantic commit messages for better changelog generation**
3. **Validate configuration before deployment**
4. **Monitor logs for parsing issues**

### Operations

1. **Regular health checks and monitoring**
2. **Backup subscriber data before changes**
3. **Test changelog generation after version bumps**
4. **Maintain environment separation**

### Security

1. **Rotate tokens regularly**
2. **Encrypt sensitive configuration**
3. **Audit access to production systems**
4. **Monitor for unauthorized API usage**

---

## Quick Reference

### Emergency Procedures

1. **Bot Unresponsive**
   ```bash
   npm run health:check
   npm run restart:bot
   ```

2. **Wrong Changelog Sent**
   ```bash
   npm run send:correction --message="Correction: ..."
   ```

3. **Configuration Rollback**
   ```bash
   npm run config:rollback --version=previous
   ```

### Support Contacts

- **Development**: Development Team
- **Operations**: DevOps Team  
- **Security**: Security Team
- **Escalation**: Technical Lead

This documentation provides comprehensive coverage of all Telegram bot workflows and should be updated whenever system changes are made.