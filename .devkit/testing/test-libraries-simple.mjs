// Simple test to check library data structure
import fs from 'fs';

const fileContent = fs.readFileSync('src/main/services/EnhancedManuscriptDownloaderService.ts', 'utf8');

// Count how many libraries have geoBlocked: true
const geoBlockedMatches = fileContent.match(/geoBlocked:\s*true/g);
console.log('Libraries with geoBlocked: true in source:', geoBlockedMatches ? geoBlockedMatches.length : 0);

// Extract library names with geoBlocked
const lines = fileContent.split('\n');
const geoBlockedLibraries = [];

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('geoBlocked: true')) {
        // Look backwards for the name
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            if (lines[j].includes('name:')) {
                const nameMatch = lines[j].match(/name:\s*['"]([^'"]+)['"]/);
                if (nameMatch) {
                    geoBlockedLibraries.push(nameMatch[1]);
                    break;
                }
            }
        }
    }
}

console.log('\nLibraries with geoBlocked: true:');
geoBlockedLibraries.forEach(name => console.log(`- ${name}`));