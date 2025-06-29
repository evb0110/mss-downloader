// Test what changelog would be generated with the new commit message

function extractUserFacingChange(commitMessage) {
  // Handle VERSION- prefixed commits
  const versionMatch = commitMessage.match(/^VERSION-[^:]*(?::\\s*(.+))?/i);
  if (versionMatch) {
    let description = versionMatch[1] ? versionMatch[1].trim() : '';
    
    if (!description) {
      const shortVersionMatch = commitMessage.match(/^VERSION-[\\d.]+\\s+(.+)/i);
      if (shortVersionMatch) {
        description = shortVersionMatch[1].trim();
      }
    }
    
    console.log(`Description extracted: "${description}"`);
    
    // Extract user-facing changes from VERSION commit descriptions
    if (description) {
      // Fix Europeana manuscript pagination by detecting external IIIF manifests
      if (description.match(/Fix.*Europeana.*manuscript.*pagination.*detecting.*external.*IIIF.*manifests/i)) {
        return 'Fixed Europeana manuscripts - Now downloads complete manuscripts (452 pages) instead of single preview page';
      }
      
      // Fix Europeana pagination fix (broader pattern)
      if (description.match(/Europeana.*pagination.*fix/i)) {
        return 'Fixed Europeana manuscripts - Now downloads complete manuscripts instead of single preview page';
      }
      
      // Fix Vienna Manuscripta page range detection for specific page URLs
      if (description.match(/Fix.*Vienna.*Manuscripta.*page.*range/i)) {
        return 'Fixed Vienna Manuscripta page downloads - Page-specific URLs now work correctly';
      }
      
      // Fix critical library and UI issues
      if (description.match(/Fix.*critical.*library.*UI/i)) {
        return 'Fixed multiple critical library issues and improved UI responsiveness';
      }
      
      // Implement comprehensive process management system
      if (description.match(/Implement.*comprehensive.*process.*management/i)) {
        return 'Internal improvements and stability fixes';
      }
      
      // Generic library fixes
      if (description.match(/Fix.*library/i)) {
        const libraryMatch = description.match(/Fix\\s+([^,]+?)\\s+(?:library|downloads?|issues?)/i);
        if (libraryMatch) {
          return `Fixed ${libraryMatch[1]} library downloads`;
        }
        return 'Fixed library download issues';
      }
      
      // Add patterns for our specific fixes
      if (description.match(/Fix.*University.*Graz/i)) {
        return 'Fixed University of Graz manuscript loading timeouts';
      }
      
      if (description.match(/add.*Rome.*BNC.*libroantico/i)) {
        return 'Added support for Rome BNC libroantico collection manuscripts';
      }
      
      if (description.match(/resolve.*Manuscripta.*hanging/i)) {
        return 'Fixed Manuscripta.at hanging downloads on page-specific URLs';
      }
      
      if (description.match(/fix.*e-manuscripta.*complete.*manuscript/i)) {
        return 'Fixed e-manuscripta.ch to download complete manuscripts (468 pages) instead of single page';
      }
      
      // Return original description if no specific pattern matches
      return description;
    }
  }
  
  return commitMessage;
}

// Test with our commit message
const commitMessage = 'VERSION-1.3.55: Fix University of Graz timeouts, add Rome BNC libroantico support, resolve Manuscripta.at hanging downloads, and fix e-manuscripta.ch complete manuscript detection';

console.log('Testing commit message:');
console.log(commitMessage);
console.log('\\nGenerated changelog:');
const result = extractUserFacingChange(commitMessage);
console.log(result);