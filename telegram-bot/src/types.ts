export interface Subscriber {
  chatId: number;
  username: string;
  subscribedAt: string;
  platforms: Platform[];
}

export type Platform = 'amd64' | 'arm64' | 'linux' | 'mac';

export interface PlatformInfo {
  name: string;
  emoji: string;
}

export interface BuildInfo {
  name: string;
  size: number;
  file: string;
}

export interface BuildsData {
  version: string;
  builds: Partial<Record<Platform, BuildInfo>>;
}

export interface FileResult {
  type: 'github_release' | 'cloud' | 'compressed_exe' | 'binary_split' | 'compressed' | 'direct';
  files?: FileInfo[];
  instructions?: string;
  downloadUrl?: string;
  method?: string;
  originalSize?: number;
  totalSize?: number;
  compressionRatio?: number;
  originalFile?: string;
}

export interface FileInfo {
  path: string;
  part?: string | number;
  totalParts?: number;
}

export interface CallbackData {
  action: string;
  platform?: Platform;
}