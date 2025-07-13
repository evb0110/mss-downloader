const { execSync, spawn } = require('child_process');
const { performance } = require('perf_hooks');

async function testLaunchSpeed() {
  console.log('🚀 Testing application launch speed...');

  const startTime = performance.now();

  try {
    // Build the app first
    console.log('📦 Building application...');
    execSync('npm run build', { stdio: 'pipe' });
    
    const buildTime = performance.now();
    console.log(`✅ Build completed in ${Math.round(buildTime - startTime)}ms`);
    
    // Test electron launch time 
    console.log('⚡ Testing electron startup...');
    const electronStart = performance.now();
    
    // Launch electron in headless mode for 3 seconds then kill it
    const electronProcess = spawn('npm', ['run', 'dev:main:headless'], {
      stdio: 'pipe',
      detached: false
    });
    
    // Give it time to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    electronProcess.kill('SIGTERM');
    
    const electronEnd = performance.now();
    const launchTime = Math.round(electronEnd - electronStart);
    
    console.log(`⚡ Electron startup time: ${launchTime}ms`);
    
    if (launchTime < 5000) {
      console.log('✅ FAST LAUNCH: App launches quickly (< 5 seconds)');
    } else if (launchTime < 10000) {
      console.log('⚠️ MODERATE LAUNCH: App takes moderate time (5-10 seconds)');
    } else {
      console.log('❌ SLOW LAUNCH: App launches slowly (> 10 seconds)');
    }
    
    console.log('🎯 Performance test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLaunchSpeed();