// Test the correct Jimp constructor syntax
import { Jimp } from 'jimp';

async function testCorrectSyntax() {
  console.log('Testing correct Jimp v1.6.0+ syntax...');
  
  try {
    // OLD (broken) syntax: new Jimp(width, height, color)
    // NEW syntax: new Jimp({ width, height, color })
    
    const image = new Jimp({ width: 100, height: 100, color: 0xffffffff });
    console.log('Success: Created 100x100 image with new syntax');
    console.log('Image dimensions:', image.getWidth(), 'x', image.getHeight());
    
    // Test with the failing parameters from the error
    const testWidth = 5632;
    const testHeight = 4352;
    console.log('Testing with failing params:', testWidth, testHeight);
    const bigImage = new Jimp({ width: testWidth, height: testHeight, color: 0xffffffff });
    console.log('Success: Created large image:', bigImage.getWidth(), 'x', bigImage.getHeight());
    
    // Test quality and buffer export
    bigImage.quality(85);
    const jpegBuffer = await bigImage.getBuffer('image/jpeg');
    console.log('Success: Exported to JPEG buffer, size:', jpegBuffer.length);
    
  } catch (error) {
    console.error('Constructor error:', error);
  }
}

testCorrectSyntax();