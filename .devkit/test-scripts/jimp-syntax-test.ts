// Test various Jimp constructor patterns for v1.6.0
const JimpModule = require('jimp');

async function testJimpPatterns() {
  console.log('Available on JimpModule:', Object.keys(JimpModule));
  console.log('Type of Jimp:', typeof JimpModule.Jimp);
  
  const { Jimp } = JimpModule;
  
  try {
    // Test pattern 1: Traditional constructor
    console.log('Testing: new Jimp(width, height, color)');
    const img1 = new Jimp(100, 100, 0xffffffff);
    console.log('Pattern 1 success');
    
    // Test pattern 2: Object options  
    console.log('Testing: new Jimp({ width, height, color })');
    const img2 = new Jimp({ width: 100, height: 100, color: 0xffffffff });
    console.log('Pattern 2 success');
    
    // Test pattern 3: Width/height only
    console.log('Testing: new Jimp(width, height)');
    const img3 = new Jimp(100, 100);
    console.log('Pattern 3 success');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Also try static factory methods
  try {
    console.log('Testing static factory: Jimp.create');
    const img4 = await Jimp.create(100, 100, 0xffffffff);
    console.log('Static factory success');
  } catch (error) {
    console.error('Static factory error:', error);
  }
}

testJimpPatterns();