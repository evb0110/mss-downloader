const { Jimp } = require('jimp');

console.log('Jimp keys:', Object.keys(Jimp));
console.log('Jimp.default keys:', Jimp.default ? Object.keys(Jimp.default) : 'no default');

async function testJimpBasics() {
  console.log('🧪 Testing basic Jimp functionality...');
  
  try {
    console.log('Jimp object:', typeof Jimp);
    console.log('Jimp.read:', typeof Jimp.read);
    console.log('Jimp constructor:', typeof Jimp);
    
    // Test 1: Try new Jimp()
    try {
      const img1 = new Jimp({ width: 100, height: 100, color: 0xFF0000FF });
      console.log('✅ new Jimp() with object works');
      console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(img1)));
      const buf1 = await img1.getBuffer('image/png');
      console.log(`✅ PNG buffer created: ${buf1.length} bytes`);
    } catch (error) {
      console.log('❌ new Jimp() failed:', error.message);
    }
    
    // Test 2: Try Jimp.create()
    try {
      const img2 = await Jimp.create(100, 100, 0x00FF00FF);
      console.log('✅ Jimp.create() works');
      const buf2 = await img2.getBufferAsync('image/png');
      console.log(`✅ PNG buffer created: ${buf2.length} bytes`);
    } catch (error) {
      console.log('❌ Jimp.create() failed:', error.message);
    }
    
    // Test 3: Try Jimp() as function
    try {
      const img3 = Jimp(100, 100, 0x0000FFFF);
      console.log('✅ Jimp() function works');
      const buf3 = await img3.getBufferAsync('image/png');
      console.log(`✅ PNG buffer created: ${buf3.length} bytes`);
    } catch (error) {
      console.log('❌ Jimp() function failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testJimpBasics();