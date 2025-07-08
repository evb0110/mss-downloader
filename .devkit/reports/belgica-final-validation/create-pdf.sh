
#!/bin/bash

# Check if ImageMagick is available
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Installing via npm..."
    npm install -g imagemagick
fi

# Convert images to PDF
echo "Converting images to PDF..."
cd "/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-complete-flow-validation"

# Create PDF from images
convert page_1_thumbnail.jpg page_2_thumbnail.jpg page_3_thumbnail.jpg page_4_thumbnail.jpg page_5_thumbnail.jpg "/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-final-validation/belgica-kbr-validation-report.pdf"

echo "PDF created: /Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-final-validation/belgica-kbr-validation-report.pdf"
