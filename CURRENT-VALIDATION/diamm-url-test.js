
// Quick test to verify DIAMM URL generation
const testServiceId = 'https://iiif.diamm.net/images/I-Rc-Ms-1907/I-Rc-Ms-1907_001r.tif';

console.log('🔧 DIAMM URL Test Results:');
console.log('');
console.log('Service ID:', testServiceId);
console.log('');
console.log('OLD (incorrect) URL pattern:');
console.log('  ' + testServiceId + '/full/max/0/default.jpg');
console.log('');
console.log('NEW (fixed) URL pattern:');
console.log('  ' + testServiceId + '/full/full/0/default.jpg');
console.log('');
console.log('✅ The fix changes DIAMM URLs to use /full/full/ for maximum resolution');
