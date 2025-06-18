const fs = require('fs');
const path = require('path');

class BinarySplitter {
    constructor() {
        this.maxChunkSize = 45 * 1024 * 1024; // 45MB to be safe
        this.tempDir = path.join(__dirname, 'temp');
        
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    async splitFile(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        
        const fileName = path.basename(filePath);
        const nameWithoutExt = path.basename(fileName, path.extname(fileName));
        const ext = path.extname(fileName);
        
        console.log(`Splitting ${fileName} into binary chunks...`);
        
        const fileBuffer = fs.readFileSync(filePath);
        const totalParts = Math.ceil(fileBuffer.length / this.maxChunkSize);
        const parts = [];
        
        // Create binary parts
        for (let i = 0; i < totalParts; i++) {
            const start = i * this.maxChunkSize;
            const end = Math.min(start + this.maxChunkSize, fileBuffer.length);
            const chunk = fileBuffer.slice(start, end);
            
            const partFileName = `${nameWithoutExt}.part${String(i + 1).padStart(2, '0')}`;
            const partPath = path.join(this.tempDir, partFileName);
            
            fs.writeFileSync(partPath, chunk);
            parts.push({
                path: partPath,
                name: partFileName,
                part: i + 1,
                totalParts: totalParts,
                size: chunk.length
            });
        }
        
        // Create recombination script
        const scriptPath = this.createRecombinationScript(nameWithoutExt, ext, totalParts);
        parts.push({
            path: scriptPath,
            name: path.basename(scriptPath),
            part: 'script',
            totalParts: totalParts,
            size: fs.statSync(scriptPath).size
        });
        
        return {
            parts: parts,
            originalFile: fileName,
            totalSize: fileBuffer.length,
            instructions: this.getInstructions(nameWithoutExt, ext, totalParts)
        };
    }
    
    createRecombinationScript(nameWithoutExt, ext, totalParts) {
        const scriptName = `${nameWithoutExt}_COMBINE.bat`;
        const scriptPath = path.join(this.tempDir, scriptName);
        
        let script = `@echo off
echo MSS Downloader - File Recombination Script
echo ==========================================
echo.
echo Combining ${totalParts} parts into ${nameWithoutExt}${ext}
echo.

`;
        
        // Check if all parts exist
        script += `echo Checking for all parts...\n`;
        for (let i = 1; i <= totalParts; i++) {
            const partNum = String(i).padStart(2, '0');
            script += `if not exist "${nameWithoutExt}.part${partNum}" (\n`;
            script += `    echo ERROR: Missing ${nameWithoutExt}.part${partNum}\n`;
            script += `    echo Please download all ${totalParts} parts before running this script.\n`;
            script += `    pause\n`;
            script += `    exit /b 1\n`;
            script += `)\n`;
        }
        
        script += `\necho All parts found!\n`;
        script += `echo Combining files...\n`;
        script += `\n`;
        
        // Combine command
        script += `copy /b `;
        for (let i = 1; i <= totalParts; i++) {
            const partNum = String(i).padStart(2, '0');
            if (i > 1) script += `+`;
            script += `"${nameWithoutExt}.part${partNum}"`;
        }
        script += ` "${nameWithoutExt}${ext}"\n\n`;
        
        // Verify and cleanup
        script += `if exist "${nameWithoutExt}${ext}" (\n`;
        script += `    echo SUCCESS: ${nameWithoutExt}${ext} created successfully!\n`;
        script += `    echo.\n`;
        script += `    echo Cleaning up part files...\n`;
        for (let i = 1; i <= totalParts; i++) {
            const partNum = String(i).padStart(2, '0');
            script += `    del "${nameWithoutExt}.part${partNum}"\n`;
        }
        script += `    del "%~f0"\n`; // Delete the script itself
        script += `    echo.\n`;
        script += `    echo Your installer is ready: ${nameWithoutExt}${ext}\n`;
        script += `    echo You can now run it to install MSS Downloader.\n`;
        script += `) else (\n`;
        script += `    echo ERROR: Failed to create ${nameWithoutExt}${ext}\n`;
        script += `    echo Please check that all parts downloaded correctly.\n`;
        script += `)\n\n`;
        script += `pause\n`;
        
        fs.writeFileSync(scriptPath, script);
        return scriptPath;
    }
    
    getInstructions(nameWithoutExt, ext, totalParts) {
        return `📦 **Binary File Parts**

This installer has been split into ${totalParts} binary parts for delivery.

🔧 **How to Recombine:**

**Method 1 - Automatic (Recommended):**
1. Download ALL ${totalParts} parts + the .bat script
2. Put all files in the same folder
3. Double-click the "${nameWithoutExt}_COMBINE.bat" script
4. The original ${nameWithoutExt}${ext} will be created automatically

**Method 2 - Manual (Windows Command Prompt):**
1. Download all ${totalParts} parts to same folder
2. Open Command Prompt in that folder
3. Run: \`copy /b "${nameWithoutExt}.part01+${nameWithoutExt}.part02+..." "${nameWithoutExt}${ext}"\`

✅ **Result:** You'll get the complete ${nameWithoutExt}${ext} installer
🗑️ **Cleanup:** Part files and script are automatically deleted after successful combination

⚠️ **Important:** Download ALL parts before running the script!`;
    }
    
    cleanup() {
        if (fs.existsSync(this.tempDir)) {
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                try {
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.error(`Error deleting temp file ${file}:`, error);
                }
            });
        }
    }
}

module.exports = BinarySplitter;