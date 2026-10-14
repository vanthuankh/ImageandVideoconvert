export type MediaType = 'image' | 'video';

export type ImageCategory = 'san-pham' | 'thong-tin' | 'video';

export interface AiAnalysisResult {
  loai: ImageCategory;
  hau_to: string;
  alt: string;
  chu_trong_anh: string;
  model_trong_anh: string;
  canh_bao: string[];
}

export interface MediaItem {
  id: string;
  file: File;
  originalName: string;
  mediaType: MediaType;
  size: number;
  width?: number;
  height?: number;
  duration?: number; // in seconds for videos
  isShortStaticVideo?: boolean; // video < 0.2s or 1 frame -> treated as static WebP
  
  // Visual previews
  thumbnailUrl: string;
  thumbnailBase64?: string;
  videoFramesBase64?: string[]; // 6 frames for video
  
  // Status during processing
  status: 'pending' | 'preparing' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
  retryCount: number;
  
  // AI output and user edits
  aiResult?: AiAnalysisResult;
  editedSuffix?: string;
  editedAlt?: string;
  isFeatured: boolean; // "Ảnh đại diện"
  isSkipped: boolean; // "Bỏ qua"
  
  // Export result
  exportedBlob?: Blob;
  exportedFileName?: string;
  exportedSize?: number;
  gifTierInfo?: string;
}

export interface SpecRow {
  thong_so: string;
  trong_anh: string;
  theo_hang: string;
  trang_thai: 'khop' | 'lech' | 'khong-tim-thay';
  ghi_chu?: string;
}

export interface SpecCheckResult {
  nguon_url: string;
  loai_nguon: 'chinh-thuc' | 'dai-ly';
  ten_nguon: string;
  bang_thong_so: SpecRow[];
  ghi_chu_ban_hang: string[];
  raw_text?: string;
}

export interface SeoPrefixOption {
  prefix: string;
  label: string;
  searchTrend?: string;
}

export interface VerifiedProductSpecs {
  hardwareStandard?: string;
  speedOrResolution?: string;
  hardwareHighlights?: string;
  source?: string;
  accuracyNote?: string;
}

export interface SeoAnalysisResponse {
  recommendedPrefix: string;
  productName: string;
  productType?: string;
  verifiedSpecs?: VerifiedProductSpecs;
  topKeywords: string[];
  searchVolumeAnalysis: string;
  alternativePrefixes: SeoPrefixOption[];
  groundingQueries?: string[];
  groundingSources?: { title?: string; url?: string }[];
  hasGoogleSearchGrounding?: boolean;
  detectedOfficialLink?: string | null;
  webSearchResultsCount?: number;
}

export interface ProductInfo {
  productName: string;
  modelCode: string;
  brandName: string;
  brandLink: string;
  aiNotes: string;
  filePrefix: string;
  folderName: string;
  verifiedSpecs?: VerifiedProductSpecs;
  seoSearchVolumeAnalysis?: string;
  seoKeywords?: string[];
  suggestedPrefixes?: SeoPrefixOption[];
  hasAiAnalyzedSeo?: boolean;
  groundingQueries?: string[];
  hasGoogleSearchGrounding?: boolean;
}

export interface IgnoredFile {
  name: string;
  size: number;
  type: string;
}

export type StepNumber = 1 | 2 | 3 | 4 | 5;
