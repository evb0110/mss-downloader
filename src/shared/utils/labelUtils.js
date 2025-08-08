export function isGenericLabel(label) {
  const genericTerms = [
    'table of contents',
    'inhaltsverzeichnis',
    'index',
    'catalog',
    'catalogue',
    'inhalt',
    'toc',
    'contents',
    'indice',
    'sommario',
    'untitled',
    'manuscript',
    'document',
    'tavola',
    'tabla de contenidos',
    'table des matières',
    'índice'
  ];
  
  const normalizedLabel = label.toLowerCase().trim();
  return genericTerms.some(term => 
    normalizedLabel === term || 
    normalizedLabel.startsWith(term + ' ') ||
    normalizedLabel.endsWith(' ' + term)
  );
}

export function enhanceManuscriptLabel(options) {
  const { library, manuscriptId, originalLabel, includeLibraryName = true } = options;
  
  // If no label or generic label, create descriptive name
  if (!originalLabel || isGenericLabel(originalLabel)) {
    if (includeLibraryName) {
      return `${library} MS ${manuscriptId}`;
    }
    return `MS ${manuscriptId}`;
  }
  
  // If label already contains ID, use as-is
  if (originalLabel.includes(manuscriptId)) {
    return originalLabel;
  }
  
  // If label is descriptive but missing ID, add it
  if (includeLibraryName && !originalLabel.toLowerCase().includes(library.toLowerCase())) {
    return `${library} ${manuscriptId} - ${originalLabel}`;
  }
  
  return `${originalLabel} (${manuscriptId})`;
}

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isGenericLabel,
    enhanceManuscriptLabel
  };
}