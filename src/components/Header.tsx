import React, { useState } from 'react';
import {
  Camera,
  RefreshCw,
  FolderSearch,
  CheckCircle,
  CloudUpload,
  Keyboard,
  X,
  Save,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  folderName?: string;
  productName?: string;
  lastSavedTime?: string;
  isSaving?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  folderName,
  productName,
  lastSavedTime,
  isSaving,
}) => {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Xử lý ảnh sản phẩm
                </h1>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  camerawifivn.com
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Chuẩn SEO WebP • GIF &lt; 4MB • Alt Text chuẩn model • Xuất Word diễn giải
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Auto-save indicator */}
            {isSaving ? (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-900/40 border border-blue-700/50 text-[11px] text-blue-300">
                <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">Đang lưu...</span>
              </div>
            ) : lastSavedTime ? (
              <div
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-400"
                title="Trạng thái đã được tự động lưu vào localStorage và IndexedDB"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Đã lưu: {lastSavedTime}</span>
              </div>
            ) : null}

            {/* Keyboard shortcut help button */}
            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              title="Xem danh sách phím tắt điều hướng nhanh"
            >
              <Keyboard className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline font-mono text-[11px]">Phím tắt</span>
            </button>

            {(folderName || productName) && (
              <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                <FolderSearch className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-300 max-w-[180px] truncate font-medium">
                  {productName || folderName}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onReset}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
              title="Làm mới hoặc xóa phiên làm việc dở dang"
              aria-label="Làm mới"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        </div>
      </header>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Phím tắt thao tác nhanh</h3>
                  <p className="text-[11px] text-slate-400">Tăng tốc độ duyệt ảnh &amp; điều hướng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                <div className="flex items-center space-x-3">
                  <Save className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white block">Lưu nhanh tức thì</span>
                    <span className="text-[11px] text-slate-400">
                      Lưu ngay toàn bộ sửa đổi trong Bảng duyệt vào localStorage
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <kbd className="px-2 py-1 rounded bg-slate-700 border border-slate-600 font-mono text-amber-300 font-bold text-[11px]">
                    Ctrl
                  </kbd>
                  <span className="text-slate-400">+</span>
                  <kbd className="px-2 py-1 rounded bg-slate-700 border border-slate-600 font-mono text-amber-300 font-bold text-[11px]">
                    S
                  </kbd>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                <div className="flex items-center space-x-3">
                  <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white block">Bước tiếp theo</span>
                    <span className="text-[11px] text-slate-400">
                      Chuyển sang bước tiếp theo khi đã đủ điều kiện
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <kbd className="px-2 py-1 rounded bg-slate-700 border border-slate-600 font-mono text-blue-300 font-bold text-[11px]">
                    Ctrl
                  </kbd>
                  <span className="text-slate-400">+</span>
                  <kbd className="px-2 py-1 rounded bg-slate-700 border border-slate-600 font-mono text-blue-300 font-bold text-[11px]">
                    &rarr;
                  </kbd>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                <div className="flex items-center space-x-3">
                  <ArrowLeft className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white block">Bước trước đó</span>
                    <span className="text-[11px] text-slate-400">Quay lại bước trước để kiểm tra</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <kbd className="px-2 py-1 rounded bg-slate-700 border border-slate-600 font-mono text-indigo-300 font-bold text-[11px]">
                    Ctrl
                  </kbd>
                  <span className="text-slate-400">+</span>
                  <kbd className="px-2 py-1 rounded bg-slate-700 border border-slate-600 font-mono text-indigo-300 font-bold text-[11px]">
                    &larr;
                  </kbd>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
