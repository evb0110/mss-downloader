// Quick test for Digital Scriptorium URL transformation

const testUrls = [
    'https://iiif-images.library.upenn.edu/iiif/2/518d3bc3-747b-465d-90e5-5ddc447ac3db%2Faccess/full/!200,200/0/default.jpg',
    'https://iiif-images.library.upenn.edu/iiif/2/87b3fa75-7973-45c7-8a50-dfadd605ceb2%2Faccess/full/!200,200/0/default.jpg'
];

console.log('🔍 Testing URL transformation:');
console.log();

for (const url of testUrls) {
    console.log('BEFORE (thumbnail):', url);
    
    const transformedUrl = url.replace(/\/full\/![0-9,]+\//, '/full/full/');
    
    console.log('AFTER (full res): ', transformedUrl);
    console.log();
}