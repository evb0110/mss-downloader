#!/usr/bin/env node

// Test the fixed changelog generation logic with v1.3.58 commit
function extractUserFacingChangesFromVersionCommit(commitMessage) {
  // Extract the description after "VERSION-X.X.X: "
  const versionMatch = commitMessage.match(/^VERSION-[^:]*:\s*(.+)/i);
  if (!versionMatch) return [];
  
  const description = versionMatch[1].trim();
  
  // Parse the description to extract user-facing benefits
  const changes = [];
  
  // Split by common separators and clean up
  const parts = description.split(/[,;-]/).map(part => part.trim()).filter(Boolean);
  
  for (const part of parts) {
    // Convert technical descriptions to user-facing language
    if (part.match(/fix.*internet.*culturale.*infinite.*loop/i)) {
      changes.push('Fixed Internet Culturale infinite download loops');
    } else if (part.match(/eliminate.*authentication.*error.*pages/i)) {
      changes.push('Improved authentication error handling');
    } else if (part.match(/improve.*download.*performance/i)) {
      changes.push('Enhanced download performance');
    } else if (part.match(/fix.*university.*graz.*timeout/i)) {
      changes.push('Fixed University of Graz loading timeouts');
    } else if (part.match(/rome.*bnc.*libroantico.*support/i)) {
      changes.push('Added Rome BNC libroantico collection support');
    } else if (part.match(/manuscripta.*hanging.*download/i)) {
      changes.push('Fixed Manuscripta.at hanging downloads');
    } else if (part.match(/e-manuscripta.*complete.*manuscript/i)) {
      changes.push('Fixed e-manuscripta.ch complete manuscript downloads');
    } else if (part.match(/fix.*europeana.*pagination/i)) {
      changes.push('Fixed Europeana complete manuscript downloads');
    } else if (part.match(/vienna.*manuscripta.*page.*range/i)) {
      changes.push('Fixed Vienna Manuscripta page-specific downloads');
    } else if (part.match(/morgan.*library.*quality/i)) {
      changes.push('Enhanced Morgan Library image quality');
    } else if (part.match(/add.*library.*support/i)) {
      const libraryMatch = part.match(/add\s+([^.]+?)\s+(?:library\s+)?support/i);
      if (libraryMatch) {
        changes.push(`Added ${libraryMatch[1]} library support`);
      }
    } else if (part.match(/fix.*library/i)) {
      const libraryMatch = part.match(/fix\s+([^.]+?)\s+library/i);
      if (libraryMatch) {
        changes.push(`Fixed ${libraryMatch[1]} library downloads`);
      }
    }
  }
  
  // If no specific patterns matched, try to extract general improvements
  if (changes.length === 0) {
    // Look for key action words and create generic improvements
    if (description.match(/fix|resolve|correct/i)) {
      changes.push('Bug fixes and stability improvements');
    } else if (description.match(/add|implement|support/i)) {
      changes.push('New features and library support');
    } else if (description.match(/improve|enhance|optimize/i)) {
      changes.push('Performance improvements');
    }
  }
  
  // Limit to 3 changes and remove duplicates
  return [...new Set(changes)].slice(0, 3);
}

// Test with the actual v1.3.58 commit message
const testCommit = "VERSION-1.3.58: Implement intelligent download progress monitoring with timeout detection";

console.log("Testing changelog generation for v1.3.58:");
console.log("Input commit:", testCommit);
console.log("");

const changes = extractUserFacingChangesFromVersionCommit(testCommit);
console.log("Generated changelog:");
changes.forEach(change => console.log(`✅ ${change}`));

console.log("");
console.log("This shows why it outputs 'New features and library support' - it matches the 'implement' pattern");
console.log("But this is too generic for what should be a more specific description");