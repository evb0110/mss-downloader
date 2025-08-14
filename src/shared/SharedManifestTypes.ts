/**
 * Type definitions for SharedManifestLoaders
 * Comprehensive type system for all manuscript library integrations
 */

/**
 * Basic image structure returned by most loaders
 */
export interface ManuscriptImage {
  url: string;
  label?: string;
  pageNumber?: number;
  resolution?: ImageResolution;
  metadata?: Record<string, unknown>;
}

/**
 * Image resolution information
 */
export interface ImageResolution {
  width?: number;
  height?: number;
  quality?: 'default' | 'color' | 'gray' | 'bitonal';
  format?: 'jpg' | 'png' | 'tif' | 'webp';
}

/**
 * Enhanced manifest with additional metadata
 */
export interface EnhancedManifest {
  images: ManuscriptImage[];
  totalPages: number;
  metadata?: ManifestMetadata;
  library: LibraryIdentifier;
  displayName: string;
  originalUrl: string;
  startPageFromUrl?: number;
  partInfo?: PartInfo;
}

/**
 * Manifest metadata
 */
export interface ManifestMetadata {
  title?: string;
  description?: string;
  author?: string;
  date?: string;
  language?: string;
  rights?: string;
  attribution?: string;
  logo?: string;
  related?: string[];
  rendering?: RenderingInfo[];
  sequences?: SequenceInfo[];
  structures?: StructureInfo[];
}

/**
 * Rendering information
 */
export interface RenderingInfo {
  id: string;
  label?: string;
  format?: string;
}

/**
 * Sequence information for IIIF manifests
 */
export interface SequenceInfo {
  id: string;
  canvases: CanvasInfo[];
  startCanvas?: string;
}

/**
 * Canvas information for IIIF
 */
export interface CanvasInfo {
  id: string;
  label?: string;
  width?: number;
  height?: number;
  images: ImageInfo[];
}

/**
 * Image information within a canvas
 */
export interface ImageInfo {
  id: string;
  resource: ResourceInfo;
  on?: string;
}

/**
 * Resource information
 */
export interface ResourceInfo {
  id: string;
  service?: ServiceInfo;
  format?: string;
  width?: number;
  height?: number;
  type?: string;
}

/**
 * Service information for IIIF Image API
 */
export interface ServiceInfo {
  id: string;
  profile?: string | string[];
  width?: number;
  height?: number;
  tiles?: TileInfo[];
  sizes?: SizeInfo[];
}

/**
 * Tile information for tiled images
 */
export interface TileInfo {
  width: number;
  height?: number;
  scaleFactors?: number[];
}

/**
 * Size information
 */
export interface SizeInfo {
  width: number;
  height: number;
}

/**
 * Structure information for navigation
 */
export interface StructureInfo {
  id: string;
  type: string;
  label?: string;
  ranges?: string[];
  canvases?: string[];
}

/**
 * Part information for multi-part manuscripts
 */
export interface PartInfo {
  partNumber: number;
  totalParts: number;
  originalDisplayName: string;
  pageRange: {
    start: number;
    end: number;
  };
}

/**
 * Library identifiers
 */
export type LibraryIdentifier = 
  | 'nypl' | 'morgan' | 'gallica' | 'grenoble' | 'karlsruhe' 
  | 'manchester' | 'munich' | 'unifr' | 'e_manuscripta' | 'vatlib' 
  | 'cecilia' | 'irht' | 'loc' | 'dijon' | 'laon' | 'durham' 
  | 'florus' | 'unicatt' | 'cudl' | 'trinity_cam' | 'toronto' 
  | 'fulda' | 'isos' | 'mira' | 'orleans' | 'rbme' | 'parker' 
  | 'manuscripta' | 'internet_culturale' | 'graz' | 'gams' 
  | 'cologne' | 'vienna_manuscripta' | 'rome' | 'berlin' | 'czech' 
  | 'modena' | 'bdl' | 'europeana' | 'monte_cassino' | 'vallicelliana' 
  | 'omnes_vallicelliana' | 'verona' | 'diamm' | 'bne' | 'mdc_catalonia' 
  | 'bvpb' | 'onb' | 'rouen' | 'freiburg' | 'sharedcanvas' 
  | 'saint_omer' | 'ugent' | 'bl' | 'wolfenbuettel' | 'florence' 
  | 'hhu' | 'vatican' | 'belgica_kbr' | 'bordeaux'
  | 'linz' | 'e_rara' | 'yale';

/**
 * Fetch options for HTTP requests
 */
export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  agent?: unknown;
  signal?: AbortSignal;
}

/**
 * Fetch response type
 */
export interface FetchResponse {
  text(): Promise<string>;
  json(): Promise<unknown>;
  buffer?(): Promise<Buffer>;
  status: number;
  statusText: string;
  headers: Headers | Record<string, string | string[]>;
  ok: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
}

/**
 * Error types
 */
export interface ManifestError extends Error {
  code?: string;
  library?: LibraryIdentifier;
  url?: string;
  retryable?: boolean;
}

/**
 * Tile-based format information
 */
export interface TileFormat {
  type: 'dzi' | 'zif' | 'iiif' | 'custom';
  tileSize?: number;
  overlap?: number;
  format?: string;
  quality?: number;
  levels?: number;
}

/**
 * DZI (Deep Zoom Image) specific types
 */
export interface DziManifest {
  tileSize: number;
  overlap: number;
  format: string;
  width: number;
  height: number;
  levels: DziLevel[];
}

export interface DziLevel {
  level: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
}

/**
 * ZIF (Zoomify) specific types
 */
export interface ZifManifest {
  tileSize: number;
  width: number;
  height: number;
  numTiles: number;
  numImages: number;
  version?: string;
}

/**
 * Vatican-specific types
 */
export interface VaticanManifest {
  prmr: {
    pages: VaticanPage[];
  };
}

export interface VaticanPage {
  url: string;
  fullSizeURL?: string;
  thumbnailURL?: string;
}

/**
 * BNE-specific types
 */
export interface BneViewerInfo {
  firstPage: number;
  lastPage: number;
  urlBase: string;
}

/**
 * URL sanitization result
 */
export interface SanitizedUrl {
  url: string;
  wasModified: boolean;
  originalUrl?: string;
}

/**
 * Main SharedManifestLoaders class interface
 */
export interface ISharedManifestLoaders {
  // Constructor accepts optional fetch function
  fetchWithRetry: FetchFunction;
  
  // Core methods
  defaultNodeFetch(url: string, options?: FetchOptions, retries?: number): Promise<FetchResponse>;
  fetchUrl(url: string, options?: FetchOptions): Promise<FetchResponse>;
  sanitizeUrl(url: string): string;
  
  // Library-specific loaders (return types vary by library)
  loadGallicaManifest(url: string): Promise<ManuscriptImage[]>;
  loadNyplManifest(url: string): Promise<ManuscriptImage[]>;
  loadMorganManifest(url: string): Promise<ManuscriptImage[]>;
  loadGrenobleManifest(url: string): Promise<ManuscriptImage[]>;
  loadKarlsruheManifest(url: string): Promise<ManuscriptImage[]>;
  loadManchesterManifest(url: string): Promise<ManuscriptImage[]>;
  loadMunichManifest(url: string): Promise<ManuscriptImage[]>;
  loadUnifrManifest(url: string): Promise<ManuscriptImage[]>;
  loadEManuscriptaManifest(url: string): Promise<ManuscriptImage[]>;
  loadVatlibManifest(url: string): Promise<VaticanManifest | ManuscriptImage[]>;
  loadCeciliaManifest(url: string): Promise<ManuscriptImage[]>;
  loadIrhtManifest(url: string): Promise<ManuscriptImage[]>;
  loadLocManifest(url: string): Promise<ManuscriptImage[]>;
  loadDijonManifest(url: string): Promise<ManuscriptImage[]>;
  loadLaonManifest(url: string): Promise<ManuscriptImage[]>;
  loadDurhamManifest(url: string): Promise<ManuscriptImage[]>;
  loadFlorusManifest(url: string): Promise<ManuscriptImage[]>;
  loadUnicattManifest(url: string): Promise<ManuscriptImage[]>;
  loadCudlManifest(url: string): Promise<ManuscriptImage[]>;
  loadTrinityCamManifest(url: string): Promise<ManuscriptImage[]>;
  loadTorontoManifest(url: string): Promise<ManuscriptImage[]>;
  loadFuldaManifest(url: string): Promise<ManuscriptImage[]>;
  loadIsosManifest(url: string): Promise<ManuscriptImage[]>;
  loadMiraManifest(url: string): Promise<ManuscriptImage[]>;
  loadOrleansManifest(url: string): Promise<ManuscriptImage[]>;
  loadRbmeManifest(url: string): Promise<ManuscriptImage[]>;
  loadParkerManifest(url: string): Promise<ManuscriptImage[]>;
  loadManuscriptaManifest(url: string): Promise<ManuscriptImage[]>;
  loadInternetCulturaleManifest(url: string): Promise<ManuscriptImage[]>;
  loadGrazManifest(url: string): Promise<ManuscriptImage[]>;
  loadGamsManifest(url: string): Promise<ManuscriptImage[]>;
  loadCologneManifest(url: string): Promise<ManuscriptImage[]>;
  loadViennaManuscriptaManifest(url: string): Promise<ManuscriptImage[]>;
  loadRomeManifest(url: string): Promise<ManuscriptImage[]>;
  loadBerlinManifest(url: string): Promise<ManuscriptImage[]>;
  loadCzechManifest(url: string): Promise<ManuscriptImage[]>;
  loadModenaManifest(url: string): Promise<ManuscriptImage[]>;
  loadBdlManifest(url: string): Promise<ManuscriptImage[]>;
  loadEuropeanaManifest(url: string): Promise<ManuscriptImage[]>;
  loadMonteCassinoManifest(url: string): Promise<ManuscriptImage[]>;
  loadVallicellianManifest(url: string): Promise<ManuscriptImage[]>;
  loadOmnesVallicellianManifest(url: string): Promise<ManuscriptImage[]>;
  loadVeronaManifest(url: string): Promise<ManuscriptImage[]>;
  loadDiammManifest(url: string): Promise<ManuscriptImage[]>;
  loadBneManifest(url: string): Promise<BneViewerInfo | { images: ManuscriptImage[] }>;
  loadMdcCataloniaManifest(url: string): Promise<ManuscriptImage[]>;
  loadBvpbManifest(url: string): Promise<ManuscriptImage[]>;
  loadOnbManifest(url: string): Promise<ManuscriptImage[]>;
  loadRouenManifest(url: string): Promise<ManuscriptImage[]>;
  loadFreiburgManifest(url: string): Promise<ManuscriptImage[]>;
  loadSharedCanvasManifest(url: string): Promise<ManuscriptImage[]>;
  loadSaintOmerManifest(url: string): Promise<ManuscriptImage[]>;
  loadUgentManifest(url: string): Promise<ManuscriptImage[]>;
  loadBritishLibraryManifest(url: string): Promise<ManuscriptImage[]>;
  loadWolfenbuettelManifest(url: string): Promise<ManuscriptImage[]>;
  loadFlorenceManifest(url: string): Promise<ManuscriptImage[]>;
  loadHhuManifest(url: string): Promise<ManuscriptImage[]>;
  loadVaticanManifest(url: string): Promise<ManuscriptImage[]>;
  loadBelgicaKbrManifest(url: string): Promise<ManuscriptImage[]>;
  loadBordeauxManifest(url: string): Promise<ManuscriptImage[]>;
  
  // IIIF helper methods
  loadIIIFManifest(url: string): Promise<ManuscriptImage[]>;
  loadGenericIIIFManifest(url: string): Promise<ManuscriptImage[]>;
  
  // Utility methods
  calculateTotalRetryTime(retries: number): number;
  
  // Special format loaders
  loadDiammSpecificManifest(url: string): Promise<ManuscriptImage[]>;
}

/**
 * Fetch function type
 */
export type FetchFunction = (
  url: string, 
  options?: FetchOptions, 
  retries?: number
) => Promise<FetchResponse>;

/**
 * Loader method type
 */
export type LoaderMethod = (url: string) => Promise<ManuscriptImage[] | EnhancedManifest | VaticanManifest | BneViewerInfo>;

/**
 * Library configuration
 */
export interface LibraryConfig {
  identifier: LibraryIdentifier;
  name: string;
  baseUrl?: string;
  apiEndpoint?: string;
  imagePattern?: string;
  requiresAuth?: boolean;
  maxRetries?: number;
  timeout?: number;
}

/**
 * IIIF Manifest Interface Definitions
 */
export interface IIIFManifest {
  '@context'?: string | string[];
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  label?: string | LocalizedString;
  description?: string | LocalizedString;
  metadata?: MetadataItem[];
  sequences?: IIIFSequence[];
  items?: IIIFSequence[];
  thumbnail?: IIIFResource;
  license?: string;
  attribution?: string | LocalizedString;
  logo?: string | IIIFResource;
  related?: string | string[];
  rendering?: IIIFRendering | IIIFRendering[];
  structures?: IIIFRange[];
  viewingHint?: string;
  viewingDirection?: string;
  navDate?: string;
  within?: string | string[];
}

export interface IIIFSequence {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  label?: string | LocalizedString;
  canvases: IIIFCanvas[];
  items?: IIIFCanvas[]; // IIIF v3 support
  viewingHint?: string;
  viewingDirection?: string;
  startCanvas?: string;
}

export interface IIIFCanvas {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  label?: string | LocalizedString;
  width?: number;
  height?: number;
  images?: IIIFAnnotation[];
  items?: IIIFAnnotationPage[];
  thumbnail?: IIIFResource;
  metadata?: MetadataItem[];
  otherContent?: IIIFAnnotationList[];
  seeAlso?: string | IIIFResource | (string | IIIFResource)[];
}

export interface IIIFAnnotation {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  motivation?: string;
  resource?: IIIFResource;
  body?: IIIFResource | IIIFResource[];
  target?: string | IIIFTarget;
  on?: string | IIIFTarget;
}

export interface IIIFAnnotationPage {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  items?: IIIFAnnotation[];
}

export interface IIIFAnnotationList {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  resources?: IIIFAnnotation[];
  items?: IIIFAnnotation[];
}

export interface IIIFResource {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  format?: string;
  width?: number;
  height?: number;
  service?: IIIFService | IIIFService[];
  services?: IIIFService[];
}

export interface IIIFService {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  profile?: string | string[];
  protocol?: string;
  width?: number;
  height?: number;
  tiles?: IIIFTileInfo[];
  sizes?: IIIFSizeInfo[];
}

export interface IIIFTileInfo {
  width: number;
  height?: number;
  scaleFactors?: number[];
}

export interface IIIFSizeInfo {
  width: number;
  height: number;
}

export interface IIIFTarget {
  '@id'?: string;
  id?: string;
  selector?: IIIFSelector;
}

export interface IIIFSelector {
  '@type'?: string;
  type?: string;
  value?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface IIIFRange {
  '@id'?: string;
  id?: string;
  '@type'?: string;
  type?: string;
  label?: string | LocalizedString;
  ranges?: string[] | IIIFRange[];
  canvases?: string[];
  members?: (string | IIIFRange)[];
}

export interface IIIFRendering {
  '@id'?: string;
  id?: string;
  format?: string;
  label?: string | LocalizedString;
}

export interface LocalizedString {
  [language: string]: string[];
}

export interface MetadataItem {
  label: string | LocalizedString;
  value: string | LocalizedString;
}