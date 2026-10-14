import React, { useState, useEffect, useMemo } from 'react';
import { MediaItem, ProductInfo, ImageCategory } from '../types';
import { toSlug, ensureUniqueSuffixes } from '../utils/slug';
import {
  TableProperties,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Video,
  Star,
  RefreshCw,
  Eye,
  X,
  ArrowRight,
  Filter,
  Check,
  Wand2,
  Save,
} from 'lucide-react';

interface Step4ReviewTableProps {
  items: MediaItem[];
  productInfo: ProductInfo;
  onUpdateItems: (updater: (prev: MediaItem[]) => MediaItem[]) => void;
  onReanalyzeSingle: (index: number) => void;
  onProceed: () => void;
  onQuickSave?: () => void;
}

export const Step4ReviewTable: React.FC<Step4ReviewTableProps> = ({
  items,
  productInfo,
  onUpdateItems,
  onReanalyzeSingle,
  onProceed,
  onQuickSave,
}) => {
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  // Default featured image assignment if none set:
  // Prefer product image with goc-nghieng-mat-truoc, else first product image
  useEffect(() => {
    const hasFeatured = items.some((i) => i.isFeatured && !i.isSkipped);
    if (!hasFeatured && items.length > 0) {
      let targetIndex = items.findIndex(
        (it) =>
          !it.isSkipped &&
          it.aiResult?.loai === 'san-pham' &&
          (it.editedSuffix || it.aiResult?.hau_to || '').includes('goc-nghieng-mat-truoc')
      );

      if (targetIndex === -1) {
        targetIndex = items.findIndex(
          (it) => !it.isSkipped && it.aiResult?.loai === 'san-pham'
        );
      }

      if (targetIndex === -1) {
        targetIndex = items.findIndex((it) => !it.isSkipped);
      }

      if (targetIndex !== -1) {
        onUpdateItems((prev) => {
          if (prev.some((it) => it.isFeatured && !it.isSkipped)) return prev;
          const copy = [...prev];
          copy.forEach((it, idx) => {
            it.isFeatured = idx === targetIndex;
          });
          return copy;
        });
      }
    }
  }, []);

  // Sort order: Ảnh sản phẩm trước, rồi video/GIF, rồi ảnh thông tin
  const sortedItemsWithOriginalIndex = useMemo(() => {
    const categoryPriority = (cat?: ImageCategory) => {
      if (cat === 'san-pham') return 1;
      if (cat === 'video') return 2;
      return 3; // 'thong-tin'
    };

    return items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => {
        const pA = categoryPriority(a.item.aiResult?.loai);
        const pB = categoryPriority(b.item.aiResult?.loai);
        if (pA !== pB) return pA - pB;
        return a.originalIndex - b.originalIndex;
      });
  }, [items]);

  // Validation: Check for duplicate suffixes, empty suffixes, and empty alt text
  const validationErrors = useMemo(() => {
    const active = items.filter((it) => !it.isSkipped);
    const suffixMap = new Map<string, number>();
    const duplicates = new Set<string>();
    const emptySuffixes: string[] = [];
    const emptyAlts: string[] = [];

    active.forEach((it) => {
      const suffix = (it.editedSuffix || it.aiResult?.hau_to || '').trim();
      const alt = (it.editedAlt || it.aiResult?.alt || '').trim();

      if (!suffix) {
        emptySuffixes.push(it.originalName);
      } else {
        const count = suffixMap.get(suffix) || 0;
        suffixMap.set(suffix, count + 1);
        if (count >= 1) {
          duplicates.add(suffix);
        }
      }

      if (!alt) {
        emptyAlts.push(it.originalName);
      }
    });

    return {
      duplicates: Array.from(duplicates),
      emptySuffixes,
      emptyAlts,
      totalActive: active.length,
      isValid: duplicates.size === 0 && emptySuffixes.length === 0 && emptyAlts.length === 0,
    };
  }, [items]);

  /**
   * Auto fix duplicate suffixes by adding -2, -3
   */
  const handleAutoFixDuplicates = () => {
    onUpdateItems((prev) => {
      const copy = [...prev];
      const activeIndices = copy.map((it, idx) => (!it.isSkipped ? idx : -1)).filter((i) => i !== -1);
      const activeItems = activeIndices.map((i) => copy[i]);
      const uniqueSuffixes = ensureUniqueSuffixes(activeItems);

      activeIndices.forEach((origIdx, activeIdx) => {
        copy[origIdx].editedSuffix = uniqueSuffixes[activeIdx];
      });

      return copy;
    });
  };

  const handleSuffixChange = (originalIndex: number, newSuffix: string) => {
    onUpdateItems((prev) => {
      const copy = [...prev];
      copy[originalIndex] = {
        ...copy[originalIndex],
        editedSuffix: toSlug(newSuffix),
      };
      return copy;
    });
  };

  const handleAltChange = (originalIndex: number, newAlt: string) => {
    onUpdateItems((prev) => {
      const copy = [...prev];
      copy[originalIndex] = {
        ...copy[originalIndex],
        editedAlt: newAlt,
      };
      return copy;
    });
  };

  const handleToggleFeatured = (targetOriginalIndex: number) => {
    onUpdateItems((prev) => {
      return prev.map((it, idx) => ({
        ...it,
        isFeatured: idx === targetOriginalIndex,
      }));
    });
  };

  const handleToggleSkip = (originalIndex: number) => {
    onUpdateItems((prev) => {
      const copy = [...prev];
      const willSkip = !copy[originalIndex].isSkipped;
      copy[originalIndex].isSkipped = willSkip;

      // If skipping the featured item, pick another one
      if (willSkip && copy[originalIndex].isFeatured) {
        copy[originalIndex].isFeatured = false;
        const nextFeatured = copy.findIndex((it, i) => i !== originalIndex && !it.isSkipped);
        if (nextFeatured !== -1) {
          copy[nextFeatured].isFeatured = true;
        }
      }
      return copy;
    });
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <TableProperties className="w-3.5 h-3.5" />
              <span>Bước 4: Bảng duyệt bắt buộc trước khi xuất</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Kiểm tra tên file, Alt text và Cảnh báo
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Thứ tự hiển thị: Ảnh sản phẩm góc máy &rarr; Video / GIF tính năng &rarr; Banner thông số.
            </p>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {onQuickSave && (
              <button
                type="button"
                onClick={onQuickSave}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition"
                title="Lưu nhanh toàn bộ thay đổi (Phím tắt: Ctrl+S)"
              >
                <Save className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lưu nhanh</span>
                <kbd className="hidden md:inline px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-slate-500 border border-slate-200">
                  Ctrl+S
                </kbd>
              </button>
            )}

            {validationErrors.duplicates.length > 0 && (
              <button
                type="button"
                onClick={handleAutoFixDuplicates}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Tự động sửa trùng tên (-2, -3)</span>
              </button>
            )}

            <button
              type="button"
              disabled={!validationErrors.isValid}
              onClick={onProceed}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs shadow-md transition"
              title="Chuyển sang Bước 5 (Phím tắt: Ctrl+Phím Mũi Tên Phải)"
            >
              <span>Tiến hành Xuất file (Bước 5)</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 rounded bg-blue-700 text-[10px] font-mono text-blue-100">
                Ctrl+&rarr;
              </kbd>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Keyboard Shortcut Banner Tip */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800 flex items-center space-x-1">
              <span>⌨ Phím tắt hữu ích:</span>
            </span>
            <span>
              Nhấn <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-slate-800 font-bold text-[10px]">Ctrl+S</kbd> để lưu nhanh • <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-slate-800 font-bold text-[10px]">Ctrl+&rarr;</kbd> để chuyển sang Xuất file • <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-slate-800 font-bold text-[10px]">Ctrl+&larr;</kbd> để quay lại Bước 3
            </span>
          </div>
        </div>

        {/* Validation Warning Alert */}
        {!validationErrors.isValid && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-2">
            <div className="flex items-center space-x-2 font-bold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Phát hiện lỗi trước khi xuất:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              {validationErrors.duplicates.length > 0 && (
                <li>
                  Trùng lặp hậu tố tên file: &ldquo;{validationErrors.duplicates.join(', ')}&rdquo;. Mỗi file xuất phải có hậu tố duy nhất.
                </li>
              )}
              {validationErrors.emptySuffixes.length > 0 && (
                <li>
                  Có file chưa có hậu tố: &ldquo;{validationErrors.emptySuffixes.join(', ')}&rdquo;.
                </li>
              )}
              {validationErrors.emptyAlts.length > 0 && (
                <li>
                  Có {validationErrors.emptyAlts.length} file thiếu Alt text: &ldquo;{validationErrors.emptyAlts.slice(0, 3).join(', ')}{validationErrors.emptyAlts.length > 3 ? '...' : ''}&rdquo;. Tuyệt đối không để trống alt text.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* The Review Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3 w-16 text-center">Đại diện</th>
                <th className="p-3 w-20 text-center">Ảnh</th>
                <th className="p-3 w-40">Tên gốc &amp; Loại</th>
                <th className="p-3 w-52">Hậu tố (Sửa được)</th>
                <th className="p-3 w-56">Tên file mới (Xem trước)</th>
                <th className="p-3">Alt text tiếng Việt (Sửa được)</th>
                <th className="p-3 w-36">Cảnh báo</th>
                <th className="p-3 w-20 text-center">Bỏ qua</th>
                <th className="p-3 w-20 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {sortedItemsWithOriginalIndex.map(({ item, originalIndex }) => {
                const currentSuffix = (item.editedSuffix || item.aiResult?.hau_to || '').trim();
                const currentAlt = (item.editedAlt || item.aiResult?.alt || '').trim();
                const isVideo = item.mediaType === 'video' && !item.isShortStaticVideo;
                const ext = isVideo ? '.gif' : '.webp';
                const newFullFileName = `${productInfo.filePrefix}${currentSuffix}${ext}`;
                const hasWarnings = item.aiResult?.canh_bao && item.aiResult.canh_bao.length > 0;
                const isDuplicateSuffix = validationErrors.duplicates.includes(currentSuffix);
                const modelInAlt = currentAlt.toLowerCase().includes(productInfo.modelCode.toLowerCase());
                const altLength = currentAlt.length;

                return (
                  <tr
                    key={item.id}
                    className={`transition ${
                      item.isSkipped
                        ? 'bg-slate-100/60 opacity-50'
                        : item.isFeatured
                        ? 'bg-blue-50/50 hover:bg-blue-50/80'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Featured radio */}
                    <td className="p-3 text-center">
                      <input
                        type="radio"
                        name="featured_image"
                        disabled={item.isSkipped}
                        checked={item.isFeatured}
                        onChange={() => handleToggleFeatured(originalIndex)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title="Chọn làm ảnh đại diện sản phẩm"
                      />
                      {item.isFeatured && (
                        <div className="text-[10px] text-blue-600 font-bold mt-0.5">
                          Đại diện
                        </div>
                      )}
                    </td>

                    {/* Thumbnail with Lightbox zoom button */}
                    <td className="p-2 text-center">
                      <div className="relative group w-14 h-14 rounded-lg bg-slate-900 mx-auto overflow-hidden border border-slate-200">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.originalName}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setPreviewItem(item)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                          title="Xem phóng to"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Original Name & Category */}
                    <td className="p-3">
                      <span className="font-mono text-[11px] text-slate-800 block truncate max-w-[140px]" title={item.originalName}>
                        {item.originalName}
                      </span>
                      <div className="mt-1 flex items-center space-x-1">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                            item.aiResult?.loai === 'san-pham'
                              ? 'bg-blue-100 text-blue-700'
                              : item.aiResult?.loai === 'video'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {item.aiResult?.loai === 'san-pham'
                            ? 'Sản phẩm'
                            : item.aiResult?.loai === 'video'
                            ? 'Video / GIF'
                            : 'Thông tin'}
                        </span>
                        {item.isShortStaticVideo && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800" title="Video ngắn < 0.2s xuất sang WebP tĩnh">
                            WebP tĩnh
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Suffix Input */}
                    <td className="p-3">
                      <div className="space-y-1">
                        <input
                          type="text"
                          disabled={item.isSkipped}
                          value={currentSuffix}
                          onChange={(e) => handleSuffixChange(originalIndex, e.target.value)}
                          className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs transition ${
                            isDuplicateSuffix
                              ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-300'
                              : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                          }`}
                        />
                        {/* Quick pick for standard product angles */}
                        {item.aiResult?.loai === 'san-pham' && !item.isSkipped && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {[
                              'mat-truoc',
                              'goc-nghieng-mat-truoc',
                              'mat-tren',
                              'mat-duoi',
                              'mat-sau-cong-ket-noi',
                              'canh-trai',
                              'canh-phai',
                            ].map((ang) => (
                              <button
                                key={ang}
                                type="button"
                                onClick={() => handleSuffixChange(originalIndex, ang)}
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition ${
                                  currentSuffix === ang
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title={`Gán góc cố định: ${ang}`}
                              >
                                {ang.replace('mat-', '').replace('goc-nghieng-', 'nghieng-')}
                              </button>
                            ))}
                          </div>
                        )}
                        {isDuplicateSuffix && (
                          <p className="text-[10px] text-red-600 mt-0.5 font-medium">
                            Trùng hậu tố! Vui lòng đổi tên hoặc bấm &ldquo;Tự động sửa trùng tên (-2, -3)&rdquo;.
                          </p>
                        )}
                      </div>
                    </td>

                    {/* New Filename Preview */}
                    <td className="p-3">
                      <div className="font-mono text-[11px] text-blue-900 font-semibold bg-slate-50 p-2 rounded-lg border border-slate-200 break-all select-all">
                        {newFullFileName}
                      </div>
                    </td>

                    {/* Alt text textarea with character count */}
                    <td className="p-3">
                      <div className="space-y-1">
                        <textarea
                          rows={2}
                          disabled={item.isSkipped}
                          value={currentAlt}
                          onChange={(e) => handleAltChange(originalIndex, e.target.value)}
                          placeholder="Mô tả những gì nhìn thấy trong ảnh..."
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs text-slate-800 leading-snug transition ${
                            !currentAlt.trim() && !item.isSkipped
                              ? 'border-red-400 bg-red-50/50 focus:ring-red-200'
                              : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                          }`}
                        />
                        <div className="flex flex-wrap items-center justify-between text-[10px] gap-1">
                          <span className={altLength > 125 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                            {altLength}/125 ký tự {altLength > 125 && '(khuyên dùng ≤ 125)'}
                          </span>
                          {!currentAlt.trim() && !item.isSkipped && (
                            <span className="text-red-600 font-bold">
                              ✕ Bắt buộc có Alt text
                            </span>
                          )}
                          {currentAlt.trim() && !modelInAlt && (
                            <span className="text-amber-600 font-medium">
                              ⚠ Thiếu mã &ldquo;{productInfo.modelCode}&rdquo;
                            </span>
                          )}
                          {/(gấp|vượt trội|hàng đầu|mạnh mẽ nhất|hơn \d+%\b)/i.test(currentAlt) && (
                            <span className="text-amber-600 font-medium">
                              ⚠ Chứa từ so sánh/quảng cáo
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Warnings Badge */}
                    <td className="p-3">
                      {hasWarnings ? (
                        <div className="space-y-1">
                          {item.aiResult!.canh_bao.map((w, wIdx) => {
                            const isSevere =
                              w.toLowerCase().includes('model') ||
                              w.toLowerCase().includes('tiếng') ||
                              w.toLowerCase().includes('ai');
                            return (
                              <div
                                key={wIdx}
                                className={`text-[10px] p-1.5 rounded-md font-medium border flex items-start space-x-1 ${
                                  isSevere
                                    ? 'bg-red-50 text-red-900 border-red-200'
                                    : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                                title={w}
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{w}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium inline-flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Hợp lệ</span>
                        </span>
                      )}
                    </td>

                    {/* Skip Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.isSkipped}
                        onChange={() => handleToggleSkip(originalIndex)}
                        className="w-4 h-4 text-slate-600 rounded focus:ring-slate-400 cursor-pointer"
                        title="Bỏ qua tệp này (không xuất)"
                      />
                    </td>

                    {/* Reanalyze Single */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => onReanalyzeSingle(originalIndex)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Phân tích lại tệp này"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            Tổng cộng: <span className="font-bold text-slate-800">{items.filter((i) => !i.isSkipped).length}</span> tệp sẽ xuất ({items.filter((i) => i.isSkipped).length} tệp đã bỏ qua).
          </div>

          <button
            type="button"
            disabled={!validationErrors.isValid}
            onClick={onProceed}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
          >
            <span>Tiến hành Xuất file (Bước 5)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewItem.thumbnailUrl}
              alt={previewItem.originalName}
              className="max-h-[75vh] w-auto object-contain"
            />
            <div className="p-3 text-white text-xs font-mono text-center w-full bg-slate-950/80">
              {previewItem.originalName} ({previewItem.width}x{previewItem.height}px)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
