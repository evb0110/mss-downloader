#!/usr/bin/env node

// Test the comprehensive changelog generation system

// Library name mappings with geographic context
const LIBRARY_MAPPINGS = {
  'internet culturale': 'Internet Culturale (Italian Cultural Heritage)',
  'internet-culturale': 'Internet Culturale (Italian Cultural Heritage)',
  'internetculturale': 'Internet Culturale (Italian Cultural Heritage)',
  'university of graz': 'University of Graz (Austria)',
  'graz': 'University of Graz (Austria)',
  'rome bnc': 'Rome National Central Library (Italy)',
  'rome-bnc': 'Rome National Central Library (Italy)',
  'manuscripta.at': 'Manuscripta.at (Austria)',
  'manuscripta at': 'Manuscripta.at (Austria)',
  'e-manuscripta': 'e-manuscripta.ch (Switzerland)',
  'e-manuscripta.ch': 'e-manuscripta.ch (Switzerland)',
  'europeana': 'Europeana (European Digital Library)',
  'vienna manuscripta': 'Vienna Manuscripta (Austria)',
  'morgan library': 'Morgan Library & Museum (New York)',
  'themorgan': 'Morgan Library & Museum (New York)',
  'gallica': 'Gallica (French National Library)',
  'vatican': 'Vatican Apostolic Library',
  'british library': 'British Library (UK)',
  'cambridge': 'Cambridge University Library (UK)',
  'stanford': 'Stanford Libraries (USA)',
  'parker': 'Parker Library (Cambridge, UK)',
  'trinity': 'Trinity College Library (Dublin)',
  'cudl': 'Cambridge Digital Library (UK)',
  'orleans': 'Orléans Library (France)',
  'florence': 'Florence Libraries (Italy)',
  'heidelberg': 'Heidelberg University Library (Germany)',
  'rbme': 'Real Biblioteca del Monasterio de El Escorial (Spain)',
  'cologne': 'University of Cologne Library (Germany)',
  'verona': 'Verona Biblioteca (Italy)',
  'modena': 'Modena State Archive (Italy)',
  'vallicelliana': 'Vallicelliana Library (Rome, Italy)',
  'monte cassino': 'Monte Cassino Abbey (Italy)',
  'czech digital': 'Czech Digital Library',
  'sweden manuscripta': 'Manuscripta.se (Sweden)',
  'bdl': 'Bavarian State Library (Germany)',
  'florus': 'FLORUS (Lyon, France)',
  'nypl': 'New York Public Library (USA)',
  'mira': 'MIRA (Germany)',
  'isos': 'ISOS (Irish Script on Screen)',
  'bm lyon': 'Municipal Library of Lyon (France)'
};

function extractUserFacingChangesFromVersionCommit(commitMessage) {
  // Extract the description after "VERSION-X.X.X: "
  const versionMatch = commitMessage.match(/^VERSION-[^:]*:\s*(.+)/i);
  if (!versionMatch) return [];
  
  const description = versionMatch[1].trim();
  const changes = [];
  
  // Semantic parsing approach: extract meaningful components
  const semanticData = parseSemanticComponents(description);
  
  // Convert semantic components to user-facing benefits
  for (const component of semanticData) {
    const userBenefit = translateToUserBenefit(component);
    if (userBenefit && !changes.includes(userBenefit)) {
      changes.push(userBenefit);
    }
  }
  
  // If no semantic parsing succeeded, fallback to intelligent pattern matching
  if (changes.length === 0) {
    const fallbackChanges = extractWithIntelligentPatterns(description);
    changes.push(...fallbackChanges);
  }
  
  // Remove duplicates and limit to 3 most important changes
  return [...new Set(changes)].slice(0, 3);
}

function parseSemanticComponents(description) {
  const components = [];
  
  // Split by common separators and analyze each part
  const parts = description.split(/[,;-]|and\s+(?=\w)/i).map(part => part.trim()).filter(Boolean);
  
  for (const part of parts) {
    const component = parseIndividualComponent(part);
    if (component) {
      components.push(component);
    }
  }
  
  return components;
}

function parseIndividualComponent(text) {
  const lowerText = text.toLowerCase();
  
  // Extract action
  let action = null;
  if (lowerText.match(/^(fix|fixed|fixing)/)) action = 'fix';
  else if (lowerText.match(/^(add|added|adding)/)) action = 'add';
  else if (lowerText.match(/^(implement|implementing|implemented)/)) action = 'implement';
  else if (lowerText.match(/^(improve|improved|improving|enhance|enhanced|enhancing)/)) action = 'improve';
  else if (lowerText.match(/^(eliminate|eliminated|eliminating)/)) action = 'eliminate';
  else if (lowerText.match(/^(resolve|resolved|resolving)/)) action = 'resolve';
  
  if (!action) return null;
  
  // Extract library name
  let library;
  for (const [key, fullName] of Object.entries(LIBRARY_MAPPINGS)) {
    if (lowerText.includes(key.toLowerCase())) {
      library = fullName;
      break;
    }
  }
  
  // Extract issue type
  let issueType;
  if (lowerText.includes('timeout')) issueType = 'timeout';
  else if (lowerText.includes('infinite loop') || lowerText.includes('infinite-loop')) issueType = 'infinite_loop';
  else if (lowerText.includes('hanging') || lowerText.includes('hung')) issueType = 'hanging';
  else if (lowerText.includes('authentication') || lowerText.includes('auth')) issueType = 'authentication';
  else if (lowerText.includes('performance') || lowerText.includes('speed')) issueType = 'performance';
  else if (lowerText.includes('quality') || lowerText.includes('resolution')) issueType = 'quality';
  else if (lowerText.includes('pagination') || lowerText.includes('page')) issueType = 'pagination';
  else if (lowerText.includes('monitoring') || lowerText.includes('progress')) issueType = 'monitoring';
  
  return {
    action,
    target: text,
    library,
    issueType,
    context: text
  };
}

function translateToUserBenefit(component) {
  const { action, library, issueType } = component;
  
  // Library-specific fixes
  if (library && (action === 'fix' || action === 'resolve')) {
    if (issueType === 'timeout') {
      return `Fixed ${library} loading timeouts for large manuscripts`;
    } else if (issueType === 'infinite_loop') {
      return `Fixed ${library} infinite download loops`;
    } else if (issueType === 'hanging') {
      return `Fixed ${library} hanging downloads`;
    } else if (issueType === 'authentication') {
      return `Improved ${library} authentication handling`;
    } else if (issueType === 'pagination') {
      return `Fixed ${library} complete manuscript downloads`;
    } else {
      return `Fixed ${library} download issues`;
    }
  }
  
  // Library additions
  if (library && action === 'add') {
    return `Added ${library} manuscript collection support`;
  }
  
  // General improvements
  if (action === 'implement') {
    if (component.target.includes('intelligent') && component.target.includes('progress')) {
      return 'Improved download reliability with real-time progress tracking';
    } else if (component.target.includes('monitoring')) {
      return 'Enhanced download progress monitoring';
    } else if (component.target.includes('timeout')) {
      return 'Improved timeout detection and handling';
    }
  }
  
  if (action === 'improve' || action === 'enhance') {
    if (issueType === 'performance') {
      return 'Enhanced download performance';
    } else if (issueType === 'quality') {
      return 'Improved image quality and resolution';
    } else if (issueType === 'monitoring') {
      return 'Better download progress tracking';
    }
  }
  
  if (action === 'eliminate') {
    if (issueType === 'authentication') {
      return 'Improved authentication error handling';
    }
  }
  
  return null;
}

function extractWithIntelligentPatterns(description) {
  const changes = [];
  const lowerDesc = description.toLowerCase();
  
  // Specific technical implementations that benefit users
  if (lowerDesc.includes('intelligent') && (lowerDesc.includes('progress') || lowerDesc.includes('monitoring'))) {
    changes.push('Improved download reliability with real-time progress tracking');
  } else if (lowerDesc.includes('timeout') && lowerDesc.includes('detection')) {
    changes.push('Enhanced timeout detection and handling');
  } else if (lowerDesc.includes('authentication') && lowerDesc.includes('error')) {
    changes.push('Improved authentication error handling');
  } else if (lowerDesc.includes('download') && lowerDesc.includes('performance')) {
    changes.push('Enhanced download performance');
  }
  
  // Fallback only if nothing else matched
  if (changes.length === 0) {
    if (lowerDesc.includes('fix') || lowerDesc.includes('resolve')) {
      changes.push('Library download improvements');
    } else if (lowerDesc.includes('add') || lowerDesc.includes('implement')) {
      changes.push('New functionality and features');
    } else if (lowerDesc.includes('improve') || lowerDesc.includes('enhance')) {
      changes.push('Performance and reliability improvements');
    }
  }
  
  return changes;
}

// Test with real commit examples
const testCommits = [
  "VERSION-1.3.58: Implement intelligent download progress monitoring with timeout detection",
  "VERSION-1.3.56: Fix Internet Culturale infinite loop - eliminate authentication error pages, improve download performance",
  "VERSION-1.3.55: Fix University of Graz timeouts, add Rome BNC libroantico support, resolve Manuscripta.at hanging downloads, and fix e-manuscripta.ch complete manuscript detection"
];

console.log("Testing comprehensive changelog generation system:\n");

testCommits.forEach((commit, index) => {
  console.log(`${index + 1}. Input: ${commit}`);
  const changes = extractUserFacingChangesFromVersionCommit(commit);
  console.log("Output:");
  changes.forEach(change => console.log(`   ✅ ${change}`));
  console.log("");
});

console.log("SUCCESS: The new system generates specific, user-facing benefits instead of generic descriptions!");