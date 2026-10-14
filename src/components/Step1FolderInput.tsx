import React, { useState, useEffect, useRef } from 'react';
import { ProductInfo, MediaItem, IgnoredFile, SeoAnalysisResponse } from '../types';
import { buildFilePrefix, guessModelCode, toSlug } from '../utils/slug';
import { createImageThumbnail, extractVideoMetadataAndFrames } from '../utils/media';
import {
  FolderOpen,
  UploadCloud,
  FileQuestion,
  FileCheck2,
  Video,
  Image as ImageIcon,
  Edit2,
  Sparkles,
  ExternalLink,
  History,
  AlertCircle,
  PlayCircle,
  HelpCircle,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Tag,
  Globe,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Link2,
  Wifi,
} from 'lucide-react';

interface Step1FolderInputProps {
  productInfo: ProductInfo;
  onUpdateProductInfo: (info: Partial<ProductInfo>) => void;
  onFilesSelected: (
    items: MediaItem[],
    ignored: IgnoredFile[],
    dirHandle?: FileSystemDirectoryHandle | null
  ) => void;
  selectedItems: MediaItem[];
  ignoredFiles: IgnoredFile[];
  onProceed: () => void;
}

const SUPPORTED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const SUPPORTED_VIDEO_EXTS = ['.mp4', '.m4v', '.mov', '.webm'];

export const POPULAR_BRANDS = [
  'Ruijie',
  'EZVIZ',
  'IMOU',
  'Hikvision',
  'Dahua',
  'TP-Link',
  'UniFi',
  'Tenda',
  'Xiaomi',
];

export function guessBrand(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('ezviz')) return 'EZVIZ';
  if (t.includes('imou')) return 'IMOU';
  if (t.includes('ruijie') || t.includes('reyee')) return 'Ruijie';
  if (t.includes('hikvision')) return 'Hikvision';
  if (t.includes('dahua')) return 'Dahua';
  if (t.includes('tp-link') || t.includes('tplink')) return 'TP-Link';
  if (t.includes('unifi') || t.includes('ubiquiti')) return 'UniFi';
  if (t.includes('tenda')) return 'Tenda';
  if (t.includes('xiaomi')) return 'Xiaomi';
  return '';
}

export const Step1FolderInput: React.FC<Step1FolderInputProps> = ({
  productInfo,
  onUpdateProductInfo,
  onFilesSelected,
  selectedItems,
  ignoredFiles,
  onProceed,
}) => {
  const [isEditingPrefix, setIsEditingPrefix] = useState(false);
  const [customPrefix, setCustomPrefix] = useState(productInfo.filePrefix);
  const [recentProducts, setRecentProducts] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [directoryPickerSupported, setDirectoryPickerSupported] = useState(true);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);

  // AI SEO Analysis states
  const [isAnalyzingSeo, setIsAnalyzingSeo] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(
    Boolean(productInfo.brandLink || productInfo.aiNotes)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const autoSeoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedKeyRef = useRef<string>('');

  useEffect(() => {
    // Check showDirectoryPicker support
    if (typeof window !== 'undefined' && !('showDirectoryPicker' in window)) {
      setDirectoryPickerSupported(false);
    }

    // Load recent products from localStorage
    try {
      const stored = localStorage.getItem('camerawifi_recent_products');
      if (stored) {
        setRecentProducts(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Cannot read localStorage', e);
    }
  }, []);

  // Keep customPrefix in sync with productInfo.filePrefix without triggering render cascades
  useEffect(() => {
    setCustomPrefix(productInfo.filePrefix);
  }, [productInfo.filePrefix]);

  // Automatically suggest strongest SEO keywords and update filePrefix when Brand, Model or Link are entered
  useEffect(() => {
    const brand = (productInfo.brandName || '').trim();
    const model = (productInfo.modelCode || '').trim();
    const link = (productInfo.brandLink || '').trim();
    const key = `${brand.toLowerCase()}:::${model.toLowerCase()}:::${link.toLowerCase()}`;

    // Auto-trigger when brand and model have at least 2 characters and user isn't in manual prefix edit mode
    if (brand.length >= 2 && model.length >= 2 && !isEditingPrefix) {
      if (lastAnalyzedKeyRef.current === key) return;

      if (autoSeoTimeoutRef.current) {
        clearTimeout(autoSeoTimeoutRef.current);
      }
      autoSeoTimeoutRef.current = setTimeout(() => {
        runAiSeoAnalysis(brand, model, link);
      }, 750);
    }

    return () => {
      if (autoSeoTimeoutRef.current) {
        clearTimeout(autoSeoTimeoutRef.current);
      }
    };
  }, [productInfo.brandName, productInfo.modelCode, productInfo.brandLink, isEditingPrefix]);

  const handleCopyKeyword = (kw: string) => {
    try {
      navigator.clipboard?.writeText(kw);
      setCopiedKeyword(kw);
      setTimeout(() => {
        setCopiedKeyword((prev) => (prev === kw ? null : prev));
      }, 2000);
    } catch (e) {
      console.warn('Cannot copy keyword', e);
    }
  };

  const handleBrandNameChange = (val: string) => {
    const currentModel = productInfo.modelCode;
    const currentProd = productInfo.productName;
    if (!isEditingPrefix && !productInfo.hasAiAnalyzedSeo) {
      const baseText = currentProd || (val ? `${val} ${currentModel}`.trim() : currentModel);
      const newPrefix = buildFilePrefix(baseText, currentModel);
      setCustomPrefix(newPrefix);
      onUpdateProductInfo({
        brandName: val,
        filePrefix: newPrefix,
      });
    } else {
      onUpdateProductInfo({
        brandName: val,
      });
    }
  };

  const handleModelCodeChange = (val: string) => {
    const currentBrand = productInfo.brandName;
    const currentProd = productInfo.productName;
    if (!isEditingPrefix && !productInfo.hasAiAnalyzedSeo) {
      const baseText = currentProd || (currentBrand ? `${currentBrand} ${val}`.trim() : val);
      const newPrefix = buildFilePrefix(baseText, val);
      setCustomPrefix(newPrefix);
      onUpdateProductInfo({
        modelCode: val,
        filePrefix: newPrefix,
      });
    } else {
      onUpdateProductInfo({
        modelCode: val,
      });
    }
  };

  const handleProductNameChange = (val: string) => {
    let nextModel = productInfo.modelCode;
    let shouldUpdateModel = false;

    // Auto extract model from product name if modelCode is currently empty
    if (!productInfo.modelCode.trim()) {
      const guessed = guessModelCode('', [val]);
      if (guessed) {
        nextModel = guessed;
        shouldUpdateModel = true;
      }
    }

    if (!isEditingPrefix && !productInfo.hasAiAnalyzedSeo) {
      const newPrefix = buildFilePrefix(val, nextModel);
      setCustomPrefix(newPrefix);
      onUpdateProductInfo({
        productName: val,
        filePrefix: newPrefix,
        ...(shouldUpdateModel ? { modelCode: nextModel } : {}),
      });
    } else {
      onUpdateProductInfo({
        productName: val,
        ...(shouldUpdateModel ? { modelCode: nextModel } : {}),
      });
    }
  };

  const handleSelectPrefixOption = (prefix: string) => {
    const finalVal = prefix.endsWith('-') ? prefix : `${prefix}-`;
    setCustomPrefix(finalVal);
    onUpdateProductInfo({ filePrefix: finalVal });
  };

  /**
   * Run AI SEO Analysis with strict hardware spec verification
   */
  const runAiSeoAnalysis = async (
    customBrand?: string,
    customModel?: string,
    customLink?: string
  ): Promise<boolean> => {
    const brand = (customBrand !== undefined ? customBrand : productInfo.brandName || '').trim();
    const model = (customModel !== undefined ? customModel : productInfo.modelCode || '').trim();
    const link = (customLink !== undefined ? customLink : productInfo.brandLink || '').trim();
    const prodName = (productInfo.productName || '').trim();

    if (!brand && !model && !prodName && !link) {
      setSeoError('Vui lòng nhập Tên thương hiệu, Mã model hoặc Link hãng để AI phân tích.');
      return false;
    }

    lastAnalyzedKeyRef.current = `${brand.toLowerCase()}:::${model.toLowerCase()}:::${link.toLowerCase()}`;
    setIsAnalyzingSeo(true);
    setSeoError(null);

    try {
      const res = await fetch('/api/analyze-seo-prefix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: brand,
          modelCode: model,
          productName: prodName,
          aiNotes: productInfo.aiNotes,
          brandLink: link,
        }),
      });

      if (!res.ok) {
        throw new Error(`Lỗi máy chủ (${res.status})`);
      }

      const data: SeoAnalysisResponse = await res.json();

      const finalPrefix = data.recommendedPrefix.endsWith('-')
        ? data.recommendedPrefix
        : `${data.recommendedPrefix}-`;

      setCustomPrefix(finalPrefix);

      const resolvedLink = link || data.detectedOfficialLink || productInfo.brandLink || '';

      onUpdateProductInfo({
        filePrefix: finalPrefix,
        productName: productInfo.productName.trim() ? productInfo.productName : data.productName,
        brandName: brand || productInfo.brandName,
        modelCode: model || productInfo.modelCode,
        brandLink: resolvedLink,
        verifiedSpecs: data.verifiedSpecs,
        seoSearchVolumeAnalysis: data.searchVolumeAnalysis,
        seoKeywords: data.topKeywords,
        suggestedPrefixes: data.alternativePrefixes,
        hasAiAnalyzedSeo: true,
        groundingQueries: data.groundingQueries,
        hasGoogleSearchGrounding: data.hasGoogleSearchGrounding,
      });

      return true;
    } catch (err: any) {
      console.warn('AI SEO analysis fallback:', err);
      const fallback = buildFilePrefix(prodName || `${brand} ${model}`, model);
      setCustomPrefix(fallback);
      onUpdateProductInfo({
        filePrefix: fallback,
        hasAiAnalyzedSeo: true,
        seoSearchVolumeAnalysis: 'Đã tạo tiền tố chuẩn SEO kết hợp thương hiệu và mã model.',
      });
      return true;
    } finally {
      setIsAnalyzingSeo(false);
    }
  };

  const handleProceedToAnalysis = async () => {
    // If user hasn't run AI SEO analysis yet, or filePrefix is missing or default:
    if (
      !productInfo.hasAiAnalyzedSeo ||
      !productInfo.filePrefix ||
      productInfo.filePrefix === 'san-pham-'
    ) {
      const ok = await runAiSeoAnalysis();
      if (!ok) {
        const fallbackPrefix = buildFilePrefix(
          productInfo.productName || `${productInfo.brandName} ${productInfo.modelCode}`,
          productInfo.modelCode
        );
        onUpdateProductInfo({ filePrefix: fallbackPrefix });
      }
    }

    if (productInfo.productName) {
      saveRecentProduct(productInfo.productName);
    }
    onProceed();
  };

  const handleRegeneratePrefix = () => {
    const calculated = buildFilePrefix(
      productInfo.productName || `${productInfo.brandName} ${productInfo.modelCode}`,
      productInfo.modelCode
    );
    setCustomPrefix(calculated);
    onUpdateProductInfo({ filePrefix: calculated });
  };

  const saveRecentProduct = (name: string) => {
    if (!name.trim()) return;
    try {
      const updated = Array.from(new Set([name.trim(), ...recentProducts])).slice(0, 8);
      setRecentProducts(updated);
      localStorage.setItem('camerawifi_recent_products', JSON.stringify(updated));
    } catch (e) {
      console.warn('Cannot save localStorage', e);
    }
  };

  /**
   * Reads folder via showDirectoryPicker (Chrome / Edge with readwrite)
   */
  const handleSelectDirectory = async () => {
    setPickerNotice(null);
    try {
      if (!('showDirectoryPicker' in window)) {
        setDirectoryPickerSupported(false);
        folderInputRef.current?.click();
        return;
      }

      setLoadingFiles(true);
      setLoadingProgress('Đang mở hộp thoại chọn thư mục...');

      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });

      const folderName = dirHandle.name;
      setLoadingProgress(`Đang quét file trong thư mục "${folderName}"...`);

      const rawFiles: File[] = [];

      // Scan only 1st-level files, ignore WEBP directory
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          rawFiles.push(file);
        }
      }

      await processSelectedFiles(rawFiles, folderName, dirHandle);
    } catch (err: any) {
      console.warn('Directory picker error or cancelled:', err);
      if (err.name === 'AbortError') {
        // User cancelled picker
        setLoadingFiles(false);
        return;
      }
      // If permission or iframe restriction prevents showDirectoryPicker
      setPickerNotice(
        'Không thể mở trực tiếp thư mục (có thể do quyền hạn trình duyệt hoặc iFrame). Vui lòng dùng nút "Chọn nhiều file" hoặc "Chọn thư mục" bên dưới.'
      );
      folderInputRef.current?.click();
    } finally {
      setLoadingFiles(false);
    }
  };

  /**
   * Fallback: file input handler
   */
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setLoadingFiles(true);
    setLoadingProgress('Đang xử lý danh sách file đã chọn...');

    const filesArray = Array.from(fileList);
    // Guess folder name from webkitRelativePath if available
    let folderName = 'Thu_Muc_Anh';
    if (filesArray[0]?.webkitRelativePath) {
      const parts = filesArray[0].webkitRelativePath.split('/');
      if (parts.length > 1) {
        folderName = parts[0];
      }
    }

    await processSelectedFiles(filesArray, folderName, null);
    setLoadingFiles(false);
  };

  /**
   * Filter images, videos, ignored files and generate initial thumbnails
   */
  const processSelectedFiles = async (
    files: File[],
    folderName: string,
    dirHandle: FileSystemDirectoryHandle | null
  ) => {
    const validItems: MediaItem[] = [];
    const ignored: IgnoredFile[] = [];

    // Filter out files inside WEBP subfolder if webkitRelativePath present
    const firstLevelFiles = files.filter((f) => {
      if (f.webkitRelativePath) {
        const parts = f.webkitRelativePath.split('/');
        return parts.length <= 2 && parts[1] && parts[0] !== 'WEBP';
      }
      return true;
    });

    const fileNames = firstLevelFiles.map((f) => f.name);
    const guessedModel = guessModelCode(folderName, fileNames);
    const guessedBrand = guessBrand(`${folderName} ${fileNames.join(' ')}`);

    const patch: Partial<ProductInfo> = { folderName };
    if (!productInfo.modelCode && guessedModel) {
      patch.modelCode = guessedModel;
    }
    if (!productInfo.brandName && guessedBrand) {
      patch.brandName = guessedBrand;
    }
    onUpdateProductInfo(patch);

    for (let i = 0; i < firstLevelFiles.length; i++) {
      const file = firstLevelFiles[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      setLoadingProgress(`Đang nạp file (${i + 1}/${firstLevelFiles.length}): ${file.name}`);

      if (SUPPORTED_IMAGE_EXTS.includes(ext)) {
        try {
          const thumb = await createImageThumbnail(file, 1024);
          validItems.push({
            id: `img-${Date.now()}-${i}`,
            file,
            originalName: file.name,
            mediaType: 'image',
            size: file.size,
            width: thumb.width,
            height: thumb.height,
            thumbnailUrl: thumb.dataUrl,
            thumbnailBase64: thumb.base64,
            status: 'pending',
            retryCount: 0,
            isFeatured: false,
            isSkipped: false,
          });
        } catch {
          ignored.push({ name: file.name, size: file.size, type: file.type || ext });
        }
      } else if (SUPPORTED_VIDEO_EXTS.includes(ext)) {
        try {
          const vidMeta = await extractVideoMetadataAndFrames(file, 6);
          validItems.push({
            id: `vid-${Date.now()}-${i}`,
            file,
            originalName: file.name,
            mediaType: 'video',
            size: file.size,
            width: vidMeta.width,
            height: vidMeta.height,
            duration: vidMeta.duration,
            isShortStaticVideo: vidMeta.isShortStaticVideo,
            thumbnailUrl: vidMeta.thumbnailUrl,
            thumbnailBase64: vidMeta.thumbnailBase64,
            videoFramesBase64: vidMeta.framesBase64,
            status: 'pending',
            retryCount: 0,
            isFeatured: false,
            isSkipped: false,
          });
        } catch {
          ignored.push({ name: file.name, size: file.size, type: file.type || ext });
        }
      } else {
        ignored.push({ name: file.name, size: file.size, type: file.type || ext });
      }
    }

    onFilesSelected(validItems, ignored, dirHandle);
  };

  /**
   * Load mock demo sample dataset for instant one-click testing
   */
  const handleLoadSampleDemo = async () => {
    setLoadingFiles(true);
    setLoadingProgress('Đang khởi tạo bộ dữ liệu mẫu thiết bị mạng Ruijie Reyee RG-EG105GW-X...');

    const sampleProductName = 'Router WiFi 6 Ruijie Reyee RG-EG105GW-X';
    const sampleBrandName = 'Ruijie';
    const sampleModelCode = 'RG-EG105GW-X';
    const sampleBrandLink = 'https://reyee.ruijie.com/en-global/products/reyee-router/rg-eg105gw-x';
    const sampleAiNotes = 'Video NAT.mp4 là tính năng NAT Traversal xem camera từ xa không cần mở port';
    const samplePrefix = 'router-wifi-6-ruijie-rg-eg105gw-x-';

    setCustomPrefix(samplePrefix);

    onUpdateProductInfo({
      productName: sampleProductName,
      brandName: sampleBrandName,
      modelCode: sampleModelCode,
      brandLink: sampleBrandLink,
      aiNotes: sampleAiNotes,
      folderName: 'Ruijie_RG-EG105GW-X_Photos',
      filePrefix: samplePrefix,
      hasAiAnalyzedSeo: true,
      seoSearchVolumeAnalysis: 'Đã phân tích: Cụm từ [Router WiFi 6 Ruijie RG-EG105GW-X] có Search Volume tự nhiên cao nhất trên Google và Shopee trong phân khúc router cân bằng tải doanh nghiệp.',
      seoKeywords: ['router wifi 6 ruijie rg-eg105gw-x', 'ruijie rg-eg105gw-x', 'router can bang tai ruijie', 'cai dat rg-eg105gw-x'],
      suggestedPrefixes: [
        { prefix: 'router-wifi-6-ruijie-rg-eg105gw-x-', label: 'Search Volume cao nhất #1', searchTrend: 'Cực cao' },
        { prefix: 'router-can-bang-tai-ruijie-rg-eg105gw-x-', label: 'Theo tính năng cân bằng tải', searchTrend: 'Cao' },
        { prefix: 'ruijie-rg-eg105gw-x-', label: 'Thương hiệu + Model', searchTrend: 'Phổ biến' },
      ],
    });

    saveRecentProduct(sampleProductName);

    // Create realistic canvas sample images
    const createSampleCanvasImage = (title: string, subtitle: string, isProduct = false): Promise<File> => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d')!;

      // Background
      if (isProduct) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1200, 800);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 1200, 800);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#1E3A8A');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1200, 800);
      }

      // Border frame
      ctx.strokeStyle = isProduct ? '#E2E8F0' : '#3B82F6';
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, 1160, 760);

      // Icon / Graphic
      ctx.fillStyle = isProduct ? '#2563EB' : '#60A5FA';
      ctx.beginPath();
      ctx.arc(600, 320, 100, 0, Math.PI * 2);
      ctx.fill();

      // Device text
      ctx.fillStyle = isProduct ? '#0F172A' : '#FFFFFF';
      ctx.font = 'bold 44px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(title, 600, 500);

      ctx.fillStyle = isProduct ? '#475569' : '#93C5FD';
      ctx.font = '28px Arial';
      ctx.fillText(subtitle, 600, 560);

      ctx.fillStyle = isProduct ? '#94A3B8' : '#CBD5E1';
      ctx.font = '20px Arial';
      ctx.fillText('Mã model: RG-EG105GW-X | WiFi 6 2976Mbps | 5 Cổng Gigabit', 600, 620);

      return new Promise<File>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(new File([blob!], `${title}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      });
    };

    const files = await Promise.all([
      createSampleCanvasImage('Mat_truoc_nghieng_Ruijie_EG105GW-X', 'Ảnh chụp góc nghiêng mặt trước 5 ăng ten', true),
      createSampleCanvasImage('Mat_sau_cong_mang_LAN_WAN', 'Cổng kết nối 5x Gigabit LAN/WAN nguồn 12V', true),
      createSampleCanvasImage('Tinh_nang_Reyee_Mesh_Wave_2', 'Tính năng kết nối Reyee Mesh 1 chạm siêu nhanh', false),
      createSampleCanvasImage('Quan_ly_Ruijie_Cloud_App', 'Quản lý tập trung qua Ruijie Cloud di động', false),
    ]);

    await processSelectedFiles(files, 'Ruijie_RG-EG105GW-X_Photos', null);
    setLoadingFiles(false);
  };

  const imagesCount = selectedItems.filter((i) => i.mediaType === 'image').length;
  const videosCount = selectedItems.filter((i) => i.mediaType === 'video').length;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Banner header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-medium border border-blue-400/30 mb-2">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Bước 1: Khởi tạo nguồn tệp</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Chọn thư mục và nhập thông tin sản phẩm
              </h2>
              <p className="text-sm text-blue-100/80 mt-1">
                Tự động quét ảnh/video, trích xuất mã model và tạo tiền tố chuẩn SEO camerawifivn.com.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleDemo}
              disabled={loadingFiles}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 backdrop-blur-xs transition shadow-xs shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Nạp dữ liệu mẫu thử</span>
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Action: Select folder or files */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-800">
              1. Thư mục chứa ảnh và video sản phẩm
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={handleSelectDirectory}
                disabled={loadingFiles}
                className={`p-5 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center transition group ${
                  directoryPickerSupported
                    ? 'border-blue-300 hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50'
                    : 'border-slate-300 bg-slate-50'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-900 text-sm">
                  Chọn thư mục sản phẩm
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Đọc ảnh và ghi thẳng vào thư mục con &ldquo;WEBP&rdquo;
                </span>
                <span className="mt-2 text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                  {directoryPickerSupported ? 'Khuyến nghị (File System API)' : 'Hỗ trợ Chrome / Edge'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loadingFiles}
                className="p-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/40 flex flex-col items-center justify-center text-center transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-900 text-sm">
                  Chọn nhiều file / Kéo thả
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Chọn các file ảnh &amp; video (xuất ra file .ZIP)
                </span>
                <span className="mt-2 text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                  Hoạt động trên mọi trình duyệt
                </span>
              </button>
            </div>

            {/* Hidden inputs */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <input
              type="file"
              ref={folderInputRef}
              // @ts-expect-error webkitdirectory is standard for folder inputs
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />

            {pickerNotice && (
              <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{pickerNotice}</span>
              </div>
            )}

            {loadingFiles && (
              <div className="flex items-center space-x-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="font-medium">{loadingProgress}</span>
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="space-y-6 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>2. Thông tin sản phẩm &amp; Gợi ý bộ từ khóa SEO (Google Search)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chỉ cần nhập <strong>Tên thương hiệu</strong> và <strong>Mã model</strong>. Gemini sẽ dùng công cụ <strong>Google Search</strong> để tự động gợi ý bộ từ khóa mạnh nhất và cập nhật ngay <strong>Tiền tố tên file</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => runAiSeoAnalysis()}
                disabled={
                  (!productInfo.brandName?.trim() && !productInfo.productName?.trim()) ||
                  !productInfo.modelCode?.trim() ||
                  isAnalyzingSeo
                }
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
                title="Gọi Gemini với công cụ Google Search để gợi ý từ khóa và tiền tố SEO"
              >
                {isAnalyzingSeo ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang tra cứu Google Search...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gợi ý từ khóa SEO ngay</span>
                  </>
                )}
              </button>
            </div>

            {seoError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{seoError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Brand Name Input with Quick Selection Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Tên thương hiệu (Hãng) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Ví dụ: Ruijie, EZVIZ, IMOU...</span>
                </div>

                <input
                  type="text"
                  placeholder="Nhập tên thương hiệu (vd: Ruijie, EZVIZ, IMOU...)"
                  value={productInfo.brandName || ''}
                  onChange={(e) => handleBrandNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm text-slate-900 transition font-medium"
                />

                {/* Popular Brand Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Chọn nhanh:</span>
                  {POPULAR_BRANDS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleBrandNameChange(b)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                        productInfo.brandName?.toLowerCase() === b.toLowerCase()
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Mã model <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Ví dụ: RG-EW1300G, C6N...</span>
                </div>
                <input
                  type="text"
                  placeholder="Nhập mã model (vd: RG-EW1300G, RG-EG105GW-X, C6N...)"
                  value={productInfo.modelCode}
                  onChange={(e) => handleModelCodeChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm text-slate-900 font-mono transition"
                />
                <p className="text-[11px] text-slate-500">
                  Mã model sẽ được tự động kết hợp với từ khóa để sinh tiền tố chuẩn SEO.
                </p>
              </div>

              {/* Manufacturer product link / Datasheet for strict hardware verification */}
              <div className="md:col-span-2 space-y-2 p-4 rounded-2xl bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-slate-50 border border-blue-200/80 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    <span>Link trang sản phẩm của hãng / Datasheet (Khuyên dùng để AI check thông số chuẩn 100%)</span>
                  </label>
                  {productInfo.brandLink?.trim() ? (
                    <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 self-start sm:self-auto">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã có link hãng - AI sẽ đọc trực tiếp dữ liệu chính thức</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 self-start sm:self-auto">
                      Khuyên dùng để tránh nhầm WiFi 5/6, độ phân giải camera...
                    </span>
                  )}
                </div>

                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Link2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="url"
                    placeholder="Dán link sản phẩm trang hãng (vd: https://www.ruijienetworks.com/... hoặc link ezviz, tp-link, unifi...)"
                    value={productInfo.brandLink || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateProductInfo({ brandLink: val });
                    }}
                    className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-xs sm:text-sm text-slate-900 bg-white transition"
                  />
                  {productInfo.brandLink && (
                    <button
                      type="button"
                      onClick={() => onUpdateProductInfo({ brandLink: '' })}
                      className="absolute right-2 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  💡 <strong>Xác thực thông số kỹ thuật chuẩn:</strong> Khi bạn cung cấp link website của hãng, AI sẽ đọc trực tiếp tài liệu kỹ thuật để phân biệt chính xác chuẩn WiFi (WiFi 5 AC vs WiFi 6 AX), độ phân giải camera (1080P/2MP vs 4K), cổng Gigabit/PoE, tuyệt đối không suy đoán nhầm lẫn công nghệ.
                </p>
              </div>

              {/* AI SEO Analysis Results & Search Volume Box */}
              <div className="md:col-span-2 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200 p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-100/90 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Globe className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-900 flex items-center space-x-2">
                        <span>Bộ từ khóa SEO &amp; Tiền tố tối ưu nhất</span>
                        {productInfo.hasAiAnalyzedSeo ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã tự động cập nhật</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                            Tự động kích hoạt khi nhập Hãng &amp; Model
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-blue-700/80">
                        {productInfo.hasAiAnalyzedSeo
                          ? 'Dữ liệu phân tích lượng tìm kiếm theo xu hướng Google Search & sàn TMĐT tại Việt Nam'
                          : 'Gemini sẽ tra cứu Google Search theo thương hiệu và model để tìm cụm từ khóa có Search Volume cao nhất.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={isAnalyzingSeo}
                      onClick={() => runAiSeoAnalysis(productInfo.brandName, productInfo.modelCode, productInfo.brandLink)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 transition cursor-pointer disabled:opacity-50"
                      title="Tra cứu thông số kỹ thuật thực tế trên web và cập nhật tiền tố SEO"
                    >
                      <Search className="w-3 h-3 text-blue-700" />
                      <span>Tra cứu lại</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPrefix(!isEditingPrefix)}
                      className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{isEditingPrefix ? 'Khóa tiền tố' : 'Sửa tiền tố'}</span>
                    </button>
                  </div>
                </div>

                {/* Loading state during Google Search Grounding */}
                {isAnalyzingSeo && (
                  <div className="p-3.5 rounded-xl bg-blue-100/80 border border-blue-200 text-blue-900 text-xs flex items-center space-x-3 animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div className="leading-relaxed">
                      Gemini đang thẩm định thông số kỹ thuật thực tế và tìm kiếm web cho <strong>{productInfo.brandName || 'Sản phẩm'} {productInfo.modelCode}</strong>...
                    </div>
                  </div>
                )}

                {/* Verified Hardware Specs Card */}
                {productInfo.verifiedSpecs && (
                  <div className="p-3.5 rounded-xl bg-white/95 border border-emerald-200/90 shadow-2xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-emerald-100 pb-2">
                      <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Thông số kỹ thuật phần cứng đã thẩm định (Đảm bảo chuẩn xác):</span>
                      </div>
                      {productInfo.brandLink ? (
                        <a
                          href={productInfo.brandLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md font-medium border border-blue-200 transition self-start sm:self-auto"
                        >
                          <span>Nguồn: {productInfo.verifiedSpecs.source || 'Website hãng'}</span>
                          <ExternalLink className="w-3 h-3 text-blue-600" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200/60 self-start sm:self-auto">
                          Nguồn: {productInfo.verifiedSpecs.source || 'Website hãng / Datasheet chuẩn'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 shrink-0 font-medium">Chuẩn công nghệ:</span>
                        <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                          {productInfo.verifiedSpecs.hardwareStandard || 'Chính hãng'}
                        </span>
                      </div>
                      {productInfo.verifiedSpecs.speedOrResolution && (
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-500 shrink-0 font-medium">Tốc độ / Độ phân giải:</span>
                          <span className="font-semibold text-slate-900">
                            {productInfo.verifiedSpecs.speedOrResolution}
                          </span>
                        </div>
                      )}
                      {productInfo.verifiedSpecs.hardwareHighlights && (
                        <div className="sm:col-span-2 flex items-start space-x-2 text-slate-700">
                          <span className="text-slate-500 shrink-0 font-medium">Đặc điểm phần cứng:</span>
                          <span className="font-medium text-slate-800">{productInfo.verifiedSpecs.hardwareHighlights}</span>
                        </div>
                      )}
                      {productInfo.verifiedSpecs.accuracyNote && (
                        <div className="sm:col-span-2 text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200/60 flex items-start space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="font-medium leading-relaxed">{productInfo.verifiedSpecs.accuracyNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Prefix Display or Manual Input */}
                {isEditingPrefix ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={customPrefix}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomPrefix(val);
                        onUpdateProductInfo({ filePrefix: val });
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-blue-400 font-mono text-xs sm:text-sm text-blue-900 bg-white shadow-xs"
                      placeholder="vd: camera-wifi-ezviz-c6n-"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const resetVal = buildFilePrefix(
                          productInfo.productName || `${productInfo.brandName} ${productInfo.modelCode}`,
                          productInfo.modelCode
                        );
                        setCustomPrefix(resetVal);
                        onUpdateProductInfo({ filePrefix: resetVal });
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition"
                    >
                      Mặc định
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-white rounded-xl border border-blue-200/90 shadow-xs">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
                        Tiền tố file tối ưu:
                      </span>
                      <span className="font-mono text-sm sm:text-base text-blue-900 font-extrabold select-all truncate">
                        {productInfo.filePrefix || customPrefix || (productInfo.modelCode ? `${toSlug(productInfo.brandName || '')}-${toSlug(productInfo.modelCode)}-` : 'chua-co-tien-to-')}
                      </span>
                      <span className="text-slate-400 font-mono text-xs hidden md:inline shrink-0">[loai]-[hau-to].webp</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                        SEO #1 Lượng tìm kiếm
                      </span>
                    </div>
                  </div>
                )}

                {/* SEO Search Volume Analysis Note */}
                {productInfo.seoSearchVolumeAnalysis && (
                  <div className="text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-blue-100 flex items-start space-x-2.5 shadow-2xs">
                    <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-blue-900 text-[11px] uppercase tracking-wider">
                        Phân tích lượng tìm kiếm &amp; Ý định mua hàng (Search Intent):
                      </div>
                      <p className="leading-relaxed text-slate-600">{productInfo.seoSearchVolumeAnalysis}</p>
                    </div>
                  </div>
                )}

                {/* Top Strongest SEO Keywords Chips with Click-to-Copy */}
                {productInfo.seoKeywords && productInfo.seoKeywords.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Bộ từ khóa SEO mạnh nhất (Google Search &amp; Shopee VN):</span>
                      </span>
                      <span className="text-[11px] text-slate-400">Nhấn vào từ khóa để sao chép nhanh</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {productInfo.seoKeywords.map((kw, idx) => {
                        const isCopied = copiedKeyword === kw;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleCopyKeyword(kw)}
                            className={`group text-xs px-3 py-1.5 rounded-xl border transition flex items-center space-x-1.5 cursor-pointer shadow-2xs ${
                              isCopied
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-800'
                            }`}
                            title="Nhấn để sao chép từ khóa này"
                          >
                            <span className="text-slate-400 group-hover:text-blue-600">
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : '🔍'}
                            </span>
                            <span className="font-medium">{kw}</span>
                            {isCopied && (
                              <span className="text-[10px] text-emerald-600 font-bold ml-1">Đã chép!</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Google Search Queries Grounding Evidence */}
                {productInfo.groundingQueries && productInfo.groundingQueries.length > 0 && (
                  <div className="text-[11px] text-slate-500 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 flex items-center space-x-2">
                    <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-semibold text-slate-600">Đã đối chiếu thời gian thực qua Google Search:</span>
                    <span className="italic text-slate-600 truncate">
                      {productInfo.groundingQueries.join(' • ')}
                    </span>
                  </div>
                )}

                {/* Alternative Prefixes Suggestions */}
                {productInfo.suggestedPrefixes && productInfo.suggestedPrefixes.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold text-slate-700">
                      Các biến thể tiền tố gợi ý khác (nhấn để đổi ngay):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {productInfo.suggestedPrefixes.map((alt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPrefixOption(alt.prefix)}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition flex items-center space-x-1.5 cursor-pointer ${
                            productInfo.filePrefix === alt.prefix
                              ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                          }`}
                        >
                          <span className="font-mono">{alt.prefix}</span>
                          <span className="opacity-75 text-[11px]">({alt.label})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Optional Settings */}
              <div className="md:col-span-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  <span>{showAdvancedOptions ? 'Ẩn thông tin mở rộng' : 'Thêm tùy chọn mở rộng (Tên sản phẩm đầy đủ, Ghi chú AI)'}</span>
                  {showAdvancedOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showAdvancedOptions && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    {/* Full product name (optional or auto-filled) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          Tên sản phẩm chi tiết (Tùy chọn)
                        </label>
                        {recentProducts.length > 0 && (
                          <div className="flex items-center space-x-1 text-[11px] text-slate-500">
                            <History className="w-3 h-3 text-slate-400" />
                            <span>Gần đây</span>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Ví dụ: Router WiFi AC Ruijie Reyee RG-EW1300G Băng Tần Kép"
                        value={productInfo.productName}
                        onChange={(e) => handleProductNameChange(e.target.value)}
                        onBlur={() => saveRecentProduct(productInfo.productName)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white"
                      />
                    </div>

                    {/* AI Notes */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Ghi chú thêm cho AI (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: RG-EW1300G là AC1300, video NAT.mp4 là NAT Traversal..."
                        value={productInfo.aiNotes}
                        onChange={(e) => onUpdateProductInfo({ aiNotes: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Files Summary */}
          {selectedItems.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Danh sách tệp hợp lệ ({selectedItems.length} tệp)
                  </span>
                </h3>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                    {imagesCount} ảnh
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">
                    {videosCount} video
                  </span>
                </div>
              </div>

              {/* Thumbnails preview strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {selectedItems.slice(0, 12).map((item) => (
                  <div
                    key={item.id}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center"
                  >
                    <img
                      src={item.thumbnailUrl}
                      alt={item.originalName}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-90 group-hover:opacity-100 transition flex flex-col justify-end p-1.5">
                      <div className="flex items-center space-x-1">
                        {item.mediaType === 'video' ? (
                          <Video className="w-3 h-3 text-amber-400 shrink-0" />
                        ) : (
                          <ImageIcon className="w-3 h-3 text-blue-300 shrink-0" />
                        )}
                        <span className="text-[10px] text-white truncate font-mono">
                          {item.originalName}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedItems.length > 12 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-xs text-slate-500 font-medium aspect-video">
                    <span>+{selectedItems.length - 12} file khác</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ignored files callout */}
          {ignoredFiles.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                <FileQuestion className="w-4 h-4 text-slate-400" />
                <span>
                  Các file bỏ qua ({ignoredFiles.length} file không phải ảnh/video hoặc thư mục WEBP):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {ignoredFiles.map((f, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-mono"
                  >
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Proceed button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {!productInfo.brandName?.trim() && !productInfo.productName?.trim() ? (
                <span className="text-amber-600 font-medium">⚠️ Vui lòng nhập Tên thương hiệu và Mã model</span>
              ) : !productInfo.modelCode?.trim() ? (
                <span className="text-amber-600 font-medium">⚠️ Vui lòng nhập Mã model</span>
              ) : selectedItems.length === 0 ? (
                <span className="text-slate-500">Vui lòng chọn hoặc kéo thả file ảnh / video</span>
              ) : (
                <span className="text-emerald-700 font-medium flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sẵn sàng: Nhấn nút để AI phân tích tiền tố SEO tối ưu &amp; đặt tên hình ảnh</span>
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={
                selectedItems.length === 0 ||
                (!productInfo.brandName?.trim() && !productInfo.productName?.trim()) ||
                !productInfo.modelCode?.trim() ||
                loadingFiles ||
                isAnalyzingSeo
              }
              onClick={handleProceedToAnalysis}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition flex items-center justify-center space-x-2"
            >
              {isAnalyzingSeo ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>AI đang phân tích tiền tố SEO tối ưu...</span>
                </>
              ) : (
                <>
                  <span>Tiến hành phân tích AI ({selectedItems.length} tệp)</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
