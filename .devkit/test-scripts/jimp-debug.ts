// Debug script to test Jimp import and constructor
import * as JimpModule from 'jimp';

console.log('JimpModule:', Object.keys(JimpModule));
console.log('JimpModule.Jimp:', JimpModule.Jimp);
console.log('JimpModule.default:', (JimpModule as any).default);
console.log('Full JimpModule:', JimpModule);

// Test the dynamic import approach
async function testDynamicImport() {
  const dynamicJimp: any = await import('jimp');
  console.log('Dynamic Jimp keys:', Object.keys(dynamicJimp));
  console.log('Dynamic Jimp.Jimp:', dynamicJimp.Jimp);
  console.log('Dynamic Jimp.default:', dynamicJimp.default);
  
  // Test constructor
  try {
    const Jimp = dynamicJimp.Jimp || dynamicJimp.default || dynamicJimp;
    console.log('Using Jimp constructor:', typeof Jimp);
    
    // This should work if properly imported
    const image = new Jimp(100, 100, 0xffffffff);
    console.log('Success: Created 100x100 image');
    
    // Test the failing parameters
    const testWidth = 5632;
    const testHeight = 4352;
    console.log('Testing with failing params:', testWidth, testHeight);
    const bigImage = new Jimp(testWidth, testHeight, 0xffffffff);
    console.log('Success: Created large image');
  } catch (error) {
    console.error('Constructor error:', error);
  }
}

testDynamicImport();