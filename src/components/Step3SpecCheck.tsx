import React, { useState, useEffect } from 'react';
import { MediaItem, ProductInfo, SpecCheckResult } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  ShieldCheck,
  Building2,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Clock,
} from 'lucide-react';

interface Step3SpecCheckProps {
  items: MediaItem[];
  productInfo: ProductInfo;
  specCheckResult?: SpecCheckResult;
  onSaveSpecCheckResult: (result: SpecCheckResult) => void;
  onProceed: () => void;
}

export const Step3SpecCheck: React.FC<Step3SpecCheckProps> = ({
  items,
  productInfo,
  specCheckResult,
  onSaveSpecCheckResult,
  onProceed,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collect all extracted texts from completed items
  const allExtractedTexts = items
    .filter((it) => it.status === 'done' && it.aiResult?.chu_trong_anh)
    .map((it) => it.aiResult!.chu_trong_anh);

  useEffect(() => {
    // If not already fetched, trigger spec check automatically
    if (!specCheckResult && allExtractedTexts.length > 0) {
      handleFetchSpecs();
    }
  }, []);

  const handleFetchSpecs = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/check-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productInfo.productName,
          modelCode: productInfo.modelCode,
          brandLink: productInfo.brandLink,
          allExtractedTexts,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error(
            'Hạn mức Gemini API (5 yêu cầu/phút) đang cần hồi phục. Bạn có thể chờ khoảng 30–45 giây rồi bấm "Đối chiếu lại", hoặc tiếp tục sang Bước 4 (Bảng duyệt) ngay.'
          );
        }
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: SpecCheckResult = await res.json();
      onSaveSpecCheckResult(data);
    } catch (err: any) {
      console.error('Error checking specs:', err);
      setError(err.message || 'Lỗi khi đối chiếu thông số');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
        {/* Banner header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <Search className="w-3.5 h-3.5" />
              <span>Bước 3: Thẩm định thông số kỹ thuật</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Đối chiếu thông số với nhà sản xuất (Google Search)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Gemini 3.8 Flash tổng hợp chữ trong tất cả ảnh và tra cứu datasheet chính thức để đối chiếu độc lập.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={handleFetchSpecs}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Đối chiếu lại</span>
            </button>

            <button
              type="button"
              onClick={onProceed}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
            >
              <span>Vào Bảng duyệt (Bước 4)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                Đang tìm kiếm và đối chiếu với tài liệu hãng...
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hệ thống đang gọi Google Search tìm datasheet chính thức cho model &ldquo;{productInfo.modelCode}&rdquo; và so sánh từng thông số.
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-2 text-xs">
            <div className="flex items-center space-x-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Không thể đối chiếu thông số từ internet</span>
            </div>
            <p>{error}</p>
            <p className="text-slate-600">
              Bạn vẫn có thể tiếp tục sang Bước 4 (Bảng duyệt) bình thường.
            </p>
          </div>
        )}

        {/* Results view */}
        {specCheckResult && !loading && (
          <div className="space-y-6">
            {/* Source card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  specCheckResult.loai_nguon === 'chinh-thuc'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {specCheckResult.loai_nguon === 'chinh-thuc' ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800">
                      Nguồn tham chiếu: {specCheckResult.ten_nguon || 'Website chính thức'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                      specCheckResult.loai_nguon === 'chinh-thuc'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {specCheckResult.loai_nguon === 'chinh-thuc'
                        ? 'Trang chính thức của hãng'
                        : 'nguồn đại lý – cần kiểm tra lại'}
                    </span>
                  </div>
                  {specCheckResult.nguon_url && (
                    <a
                      href={specCheckResult.nguon_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline truncate max-w-md block flex items-center space-x-1 mt-0.5"
                    >
                      <span>{specCheckResult.nguon_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                Bảng đối chiếu thông số (Chỉ để tham khảo, không tự động sửa Alt text)
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-3 w-1/4">Thông số</th>
                      <th className="p-3 w-1/4">Trong ảnh</th>
                      <th className="p-3 w-1/4">Theo tài liệu hãng</th>
                      <th className="p-3 w-1/4">Kết quả &amp; Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {specCheckResult.bang_thong_so && specCheckResult.bang_thong_so.length > 0 ? (
                      specCheckResult.bang_thong_so.map((row, idx) => {
                        const isMatch = row.trang_thai === 'khop';
                        const isDiff = row.trang_thai === 'lech';

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-semibold text-slate-900">{row.thong_so}</td>
                            <td className="p-3 text-slate-700">{row.trong_anh || '—'}</td>
                            <td className="p-3 text-slate-700 font-medium">{row.theo_hang || '—'}</td>
                            <td className="p-3">
                              <div className="flex items-center space-x-1.5 mb-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    isMatch
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isDiff
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {isMatch ? '✓ Khớp' : isDiff ? '⚠ Lệch' : '? Không tìm thấy'}
                                </span>
                              </div>
                              {row.ghi_chu && (
                                <p className="text-[11px] text-slate-500">{row.ghi_chu}</p>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                          Không trích xuất được bảng thông số cụ thể.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sales suggestions */}
            {specCheckResult.ghi_chu_ban_hang && specCheckResult.ghi_chu_ban_hang.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
                  <Lightbulb className="w-4 h-4 text-emerald-600" />
                  <span>Đề xuất ghi chú bán hàng (cho nhân viên kinh doanh camerawifivn.com)</span>
                </div>
                <ul className="space-y-1.5 pl-5 list-disc text-xs text-emerald-950">
                  {specCheckResult.ghi_chu_ban_hang.map((note, nIdx) => (
                    <li key={nIdx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Footer nav */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Nội dung đối chiếu sẽ tự động đưa vào mục &ldquo;5. Ghi chú&rdquo; trong file Word.
          </span>
          <button
            type="button"
            onClick={onProceed}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center space-x-2"
          >
            <span>Tiếp tục Bước 4: Bảng duyệt</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
