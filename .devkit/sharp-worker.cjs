const sharp = require('sharp');
const fs = require('fs');

// Sharp worker process for ES module compatibility
async function processImage(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .negate()
      .jpeg({ quality: 90 })
      .toFile(outputPath);
    
    console.log(`SUCCESS:${outputPath}`);
  } catch (error) {
    console.error(`ERROR:${error.message}`);
    process.exit(1);
  }
}

// Process command line arguments
const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('ERROR:Missing input or output path');
  process.exit(1);
}

processImage(inputPath, outputPath);