const { configService } = require('./src/main/services/ConfigService.ts'); console.log('Auto-split threshold:', configService.get('autoSplitThreshold'));
