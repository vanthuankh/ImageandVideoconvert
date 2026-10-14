import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, ProductInfo, AiAnalysisResult } from '../types';
import { ensureUniqueSuffixes, toSlug } from '../utils/slug';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  AlertCircle,
  FileImage,
  Video,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';

interface Step2AiAnalysisProps {
  items: MediaItem[];
  productInfo: ProductInfo;
  onUpdateItems: (updater: (prev: MediaItem[]) => MediaItem[]) => void;
  onProceed: () => void;
}

export const Step2AiAnalysis: React.FC<Step2AiAnalysisProps> = ({
  items,
  productInfo,
  onUpdateItems,
  onProceed,
}) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [currentProcessingName, setCurrentProcessingName] = useState<string>('');

  // Stable refs for background runner
  const itemsRef = useRef<MediaItem[]>(items);
  itemsRef.current = items;

  const productInfoRef = useRef<ProductInfo>(productInfo);
  productInfoRef.current = productInfo;

  const onUpdateItemsRef = useRef(onUpdateItems);
  onUpdateItemsRef.current = onUpdateItems;

  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;

  const isWorkerActiveRef = useRef<boolean>(false);
  const inFlightIdsRef = useRef<Set<string>>(new Set());
  const hasFinalizedRef = useRef<boolean>(false);

  // Compute progress indicators
  const completedCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const totalCount = items.length;
  const progressPercent =
    totalCount > 0 ? Math.round(((completedCount + errorCount) / totalCount) * 100) : 0;

  /**
   * Worker loop: processes items sequentially with zero re-render loop risks.
   */
  const processNextItems = async () => {
    if (isWorkerActiveRef.current) return;
    isWorkerActiveRef.current = true;
    setIsProcessing(true);

    try {
      while (true) {
        if (isPausedRef.current) {
          break;
        }

        // Find next item that is 'pending' and not currently in flight
        const pendingItem = itemsRef.current.find(
          (it) => it.status === 'pending' && !inFlightIdsRef.current.has(it.id)
        );

        if (!pendingItem) {
          // Check if all items in itemsRef are done or error
          const anyPending = itemsRef.current.some(
            (it) => it.status === 'pending' || it.status === 'analyzing'
          );

          if (!anyPending) {
            if (!hasFinalizedRef.current) {
              hasFinalizedRef.current = true;
              // Ensure unique suffixes across completed items
              onUpdateItemsRef.current((prev) => {
                const copy = [...prev];
                const unique = ensureUniqueSuffixes(copy);
                copy.forEach((it, idx) => {
                  if (it.aiResult) {
                    it.editedSuffix = unique[idx];
                  }
                });
                return copy;
              });
            }
            setIsProcessing(false);
            setCurrentProcessingName('');
          }
          break;
        }

        // Lock item in flight
        inFlightIdsRef.current.add(pendingItem.id);
        setCurrentProcessingName(pendingItem.originalName);

        // Update status to analyzing
        onUpdateItemsRef.current((prev) =>
          prev.map((it) =>
            it.id === pendingItem.id ? { ...it, status: 'analyzing', errorMessage: undefined } : it
          )
        );

        // Analyze item
        try {
          const imagesPayload: { mimeType: string; data: string }[] = [];
          if (
            pendingItem.mediaType === 'video' &&
            pendingItem.videoFramesBase64 &&
            pendingItem.videoFramesBase64.length > 0
          ) {
            pendingItem.videoFramesBase64.forEach((b64) => {
              imagesPayload.push({ mimeType: 'image/jpeg', data: b64 });
            });
          } else if (pendingItem.thumbnailBase64) {
            imagesPayload.push({
              mimeType: pendingItem.file.type || 'image/jpeg',
              data: pendingItem.thumbnailBase64,
            });
          }

          const res = await fetch('/api/analyze-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: pendingItem.originalName,
              mediaType: pendingItem.mediaType,
              productName: productInfoRef.current.productName,
              modelCode: productInfoRef.current.modelCode,
              aiNotes: productInfoRef.current.aiNotes,
              images: imagesPayload,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
          }

          const data: AiAnalysisResult = await res.json();
          data.hau_to = toSlug(
            data.hau_to || (pendingItem.mediaType === 'video' ? 'anh-dong-tinh-nang' : 'anh-san-pham')
          );

          // Update status to done
          onUpdateItemsRef.current((prev) =>
            prev.map((it) =>
              it.id === pendingItem.id
                ? {
                    ...it,
                    status: 'done',
                    aiResult: data,
                    editedSuffix: data.hau_to,
                    editedAlt: data.alt,
                  }
                : it
            )
          );
        } catch (err: any) {
          console.error(`Error analyzing ${pendingItem.originalName}:`, err);
          onUpdateItemsRef.current((prev) =>
            prev.map((it) =>
              it.id === pendingItem.id
                ? {
                    ...it,
                    status: 'error',
                    errorMessage: err.message || 'Lỗi kết nối Gemini',
                  }
                : it
            )
          );
        } finally {
          inFlightIdsRef.current.delete(pendingItem.id);
        }

        // Polite pause between requests (600ms) for smooth animation
        await new Promise((r) => setTimeout(r, 600));
      }
    } finally {
      isWorkerActiveRef.current = false;
      const stillPending = itemsRef.current.some((it) => it.status === 'pending');
      if (!stillPending) {
        setIsProcessing(false);
        setCurrentProcessingName('');
      }
    }
  };

  // Run on mount or when unpaused
  useEffect(() => {
    if (!isPaused) {
      processNextItems();
    }
  }, [isPaused]);

  const handleRetryFailed = () => {
    hasFinalizedRef.current = false;
    inFlightIdsRef.current.clear();
    onUpdateItemsRef.current((prev) =>
      prev.map((it) =>
        it.status === 'error'
          ? { ...it, status: 'pending', retryCount: 0, errorMessage: undefined }
          : it
      )
    );
    setIsProcessing(true);
    setTimeout(() => {
      processNextItems();
    }, 100);
  };

  const handleRetrySingle = (targetId: string) => {
    hasFinalizedRef.current = false;
    inFlightIdsRef.current.delete(targetId);
    onUpdateItemsRef.current((prev) =>
      prev.map((it) =>
        it.id === targetId ? { ...it, status: 'pending', errorMessage: undefined } : it
      )
    );
    setIsProcessing(true);
    setTimeout(() => {
      processNextItems();
    }, 100);
  };

  const itemsWithWarnings = items.filter(
    (i) => i.aiResult?.canh_bao && i.aiResult.canh_bao.length > 0
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Banner & Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bước 2: Phân tích hình ảnh &amp; video bằng Gemini AI
              </h2>
              <p className="text-xs text-slate-500">
                Tự động nhận diện góc máy, trích xuất tính năng và phát hiện cảnh báo chuẩn SEO.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isProcessing && (
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {isPaused ? (
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Pause className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>
            )}

            {errorCount > 0 && !isProcessing && (
              <button
                type="button"
                onClick={handleRetryFailed}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại {errorCount} file lỗi</span>
              </button>
            )}

            <button
              type="button"
              disabled={completedCount === 0 || isProcessing}
              onClick={onProceed}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-md transition"
            >
              <span>Tiếp tục Bước 3: Đối chiếu thông số</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 font-medium">
              <span className="text-slate-700">Tiến độ:</span>
              <span className="text-blue-700 font-bold">
                {completedCount} / {totalCount} hoàn tất
              </span>
              {currentProcessingName && isProcessing && (
                <span className="text-slate-500 truncate max-w-xs">
                  (Đang đọc: {currentProcessingName})
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600 font-semibold">({errorCount} lỗi)</span>
              )}
            </div>
            <span className="font-mono font-bold text-slate-800">{progressPercent}%</span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Active SEO Prefix indicator bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-600 font-medium">Tiền tố SEO đang áp dụng:</span>
                <span className="font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-300 select-all">
                  {productInfo.filePrefix || 'chua-co-tien-to-'}
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Search Volume tối ưu #1
                </span>
              </div>
              {productInfo.productName && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Sản phẩm: <span className="font-semibold text-slate-800">{productInfo.productName}</span>
                  {productInfo.modelCode && (
                    <span className="ml-2 font-mono text-slate-600">({productInfo.modelCode})</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {productInfo.seoKeywords && productInfo.seoKeywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-slate-400 font-medium">Từ khóa HOT:</span>
              {productInfo.seoKeywords.slice(0, 3).map((kw, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Warnings callout banner */}
        {itemsWithWarnings.length > 0 && (
          <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                Phát hiện {itemsWithWarnings.length} tệp có cảnh báo
              </span>{' '}
              (model lệch, chữ tiếng nước ngoài hoặc thông báo hạn mức). Bạn sẽ được kiểm tra và chỉnh sửa kỹ ở Bước 4 (Bảng duyệt).
            </div>
          </div>
        )}
      </div>

      {/* Grid of media items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const isDone = item.status === 'done';
          const isAnalyzing = item.status === 'analyzing';
          const isError = item.status === 'error';
          const hasWarnings = item.aiResult?.canh_bao && item.aiResult.canh_bao.length > 0;

          return (
            <div
              key={item.id}
              className={`rounded-2xl border bg-white overflow-hidden shadow-xs transition ${
                isAnalyzing
                  ? 'border-blue-400 ring-2 ring-blue-100'
                  : isError
                  ? 'border-red-300 bg-red-50/20'
                  : isDone
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-200 opacity-75'
              }`}
            >
              {/* Media preview header */}
              <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                <img
                  src={item.thumbnailUrl}
                  alt={item.originalName}
                  className="w-full h-full object-contain"
                />

                {/* Badge top-left */}
                <div className="absolute top-2 left-2 flex items-center space-x-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono flex items-center space-x-1">
                    {item.mediaType === 'video' ? (
                      <Video className="w-3 h-3 text-amber-400" />
                    ) : (
                      <FileImage className="w-3 h-3 text-blue-300" />
                    )}
                    <span className="truncate max-w-[120px]">{item.originalName}</span>
                  </span>
                </div>

                {/* Status overlay */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white space-y-2 p-4 text-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold">Gemini đang đọc ảnh...</span>
                  </div>
                )}

                {isError && (
                  <div className="absolute inset-0 bg-red-950/70 backdrop-blur-2xs flex flex-col items-center justify-center text-white space-y-1.5 p-3 text-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <span className="text-xs font-bold">Lỗi phân tích</span>
                    <button
                      type="button"
                      onClick={() => handleRetrySingle(item.id)}
                      className="mt-1 px-2.5 py-1 rounded-md bg-white text-red-700 font-semibold text-[11px] hover:bg-red-50"
                    >
                      Thử lại ngay
                    </button>
                  </div>
                )}

                {/* Done badge top-right */}
                {isDone && (
                  <div className="absolute top-2 right-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-3.5 space-y-2.5 text-xs">
                {isDone && item.aiResult ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.aiResult.loai === 'san-pham'
                            ? 'bg-blue-100 text-blue-800'
                            : item.aiResult.loai === 'video'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.aiResult.loai === 'san-pham'
                          ? 'Ảnh sản phẩm'
                          : item.aiResult.loai === 'video'
                          ? 'Video / GIF'
                          : 'Thông tin'}
                      </span>

                      <span className="font-mono text-[11px] text-slate-500">
                        {item.width}x{item.height}px
                      </span>
                    </div>

                    {/* Suffix */}
                    <div>
                      <span className="text-slate-400 text-[10px] block">Hậu tố gợi ý:</span>
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md block truncate">
                        {item.editedSuffix || item.aiResult.hau_to}
                      </span>
                    </div>

                    {/* Alt text */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Alt text:</span>
                        <span>{(item.editedAlt || item.aiResult.alt).length}/125 ký tự</span>
                      </div>
                      <p className="text-slate-700 line-clamp-2 italic bg-slate-50 p-1.5 rounded-md border border-slate-100">
                        &ldquo;{item.editedAlt || item.aiResult.alt}&rdquo;
                      </p>
                    </div>

                    {/* Warnings */}
                    {hasWarnings && (
                      <div className="space-y-1 pt-1">
                        {item.aiResult.canh_bao.map((w, wIdx) => (
                          <div
                            key={wIdx}
                            className="flex items-start space-x-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 p-1.5 rounded-md"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-4 text-center text-slate-400">
                    <span className="italic">
                      {isAnalyzing
                        ? 'Đang phân tích...'
                        : isError
                        ? item.errorMessage
                        : 'Đang trong hàng đợi...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
