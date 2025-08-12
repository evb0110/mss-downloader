/**
 * Label utility functions for manuscript processing
 */

export function isGenericLabel(label: string): boolean {
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

export interface EnhanceManuscriptLabelOptions {
  library: string;
  manuscriptId: string;
  originalLabel?: string;
  includeLibraryName?: boolean;
}

export function enhanceManuscriptLabel(options: EnhanceManuscriptLabelOptions): string {
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