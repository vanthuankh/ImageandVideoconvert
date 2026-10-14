import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StepNumber, ProductInfo, MediaItem, IgnoredFile, SpecCheckResult } from './types';
import { Header } from './components/Header';
import { Stepper } from './components/Stepper';
import { Step1FolderInput } from './components/Step1FolderInput';
import { Step2AiAnalysis } from './components/Step2AiAnalysis';
import { Step3SpecCheck } from './components/Step3SpecCheck';
import { Step4ReviewTable } from './components/Step4ReviewTable';
import { Step5Export } from './components/Step5Export';
import {
  getSavedSessionMeta,
  loadWorkflowSession,
  saveWorkflowSession,
  clearWorkflowSession,
  SavedSessionMeta,
} from './utils/sessionStorage';
import { History, ArrowRight, Trash2, X, Check, Save, RefreshCw, AlertTriangle } from 'lucide-react';

export default function App() {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [maxStepReached, setMaxStepReached] = useState<StepNumber>(1);

  const [productInfo, setProductInfo] = useState<ProductInfo>({
    productName: '',
    modelCode: '',
    brandName: '',
    brandLink: '',
    aiNotes: '',
    filePrefix: '',
    folderName: '',
  });

  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const [ignoredFiles, setIgnoredFiles] = useState<IgnoredFile[]>([]);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [specCheckResult, setSpecCheckResult] = useState<SpecCheckResult | undefined>(undefined);

  // Persistence & feedback states
  const [pendingDraftMeta, setPendingDraftMeta] = useState<SavedSessionMeta | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  // Quick Save handler for Ctrl+S
  const handleQuickSave = useCallback(async () => {
    setIsSaving(true);
    await saveWorkflowSession(
      currentStep,
      maxStepReached,
      productInfo,
      selectedItems,
      specCheckResult
    );
    setIsSaving(false);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastSavedTime(timeStr);
    showToast(`Đã lưu nhanh toàn bộ thay đổi lúc ${timeStr}! (Ctrl+S)`);
  }, [currentStep, maxStepReached, productInfo, selectedItems, specCheckResult, showToast]);

  // Check for saved draft session on mount
  useEffect(() => {
    const meta = getSavedSessionMeta();
    if (meta && meta.itemCount > 0) {
      setPendingDraftMeta(meta);
    }
  }, []);

  // Debounced auto-save of current workflow state
  useEffect(() => {
    // Only auto-save if user has started inputting or uploaded items
    if (!productInfo.productName && !productInfo.modelCode && selectedItems.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSaving(true);
      await saveWorkflowSession(
        currentStep,
        maxStepReached,
        productInfo,
        selectedItems,
        specCheckResult
      );
      setIsSaving(false);
      const now = new Date();
      setLastSavedTime(
        now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentStep, maxStepReached, productInfo, selectedItems, specCheckResult]);

  const navigateToStep = (step: StepNumber) => {
    setCurrentStep(step);
    if (step > maxStepReached) {
      setMaxStepReached(step);
    }
  };

  // Keyboard Shortcuts: Ctrl+Left, Ctrl+Right, Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      // 1. Quick Save: Ctrl + S / Cmd + S
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleQuickSave();
        return;
      }

      // 2. Step Navigation: Next Step (Ctrl + Right / Cmd + Right)
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentStep === 1) {
          if (selectedItems.length > 0 && productInfo.productName.trim() && productInfo.modelCode.trim()) {
            navigateToStep(2);
            showToast('Chuyển sang Bước 2: Phân tích AI');
          } else {
            showToast('Vui lòng chọn tệp và điền tên/mã model trước khi chuyển bước');
          }
        } else if (currentStep === 2) {
          const completedCount = selectedItems.filter((i) => i.status === 'done').length;
          if (completedCount > 0) {
            navigateToStep(3);
            showToast('Chuyển sang Bước 3: Đối chiếu thông số');
          } else {
            showToast('Đang chờ ít nhất 1 tệp hoàn thành phân tích');
          }
        } else if (currentStep === 3) {
          navigateToStep(4);
          showToast('Chuyển sang Bước 4: Bảng duyệt');
        } else if (currentStep === 4) {
          const active = selectedItems.filter((i) => !i.isSkipped);
          const suffixes = active.map((i) => (i.editedSuffix || i.aiResult?.hau_to || '').trim());
          const hasEmpty = suffixes.some((s) => !s);
          const hasDuplicates = new Set(suffixes).size !== suffixes.length;

          if (hasDuplicates) {
            showToast('Phát hiện hậu tố bị trùng lặp, vui lòng sửa trước khi xuất');
          } else if (hasEmpty) {
            showToast('Có tệp chưa có hậu tố hợp lệ');
          } else if (active.length === 0) {
            showToast('Không có tệp nào được chọn để xuất');
          } else {
            navigateToStep(5);
            showToast('Chuyển sang Bước 5: Xuất file & Báo cáo');
          }
        }
        return;
      }

      // 3. Step Navigation: Previous Step (Ctrl + Left / Cmd + Left)
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStep > 1) {
          const prev = (currentStep - 1) as StepNumber;
          navigateToStep(prev);
          showToast(`Quay lại Bước ${prev}`);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentStep,
    maxStepReached,
    selectedItems,
    productInfo,
    specCheckResult,
    handleQuickSave,
    showToast,
  ]);

  const handleRestoreSession = async () => {
    const data = await loadWorkflowSession();
    if (data) {
      setCurrentStep(data.currentStep);
      setMaxStepReached(data.maxStepReached);
      setProductInfo(data.productInfo);
      setSelectedItems(data.items);
      setSpecCheckResult(data.specCheckResult);
      setPendingDraftMeta(null);
      const savedDate = new Date(data.savedAt);
      setLastSavedTime(
        savedDate.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      showToast(`Đã khôi phục thành công phiên làm việc của "${data.productInfo.productName}"`);
    }
  };

  const handleDiscardSavedSession = async () => {
    await clearWorkflowSession();
    setPendingDraftMeta(null);
    showToast('Đã xóa phiên nháp cũ.');
  };

  const handleUpdateProductInfo = useCallback((patch: Partial<ProductInfo>) => {
    setProductInfo((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleFilesSelected = useCallback((
    items: MediaItem[],
    ignored: IgnoredFile[],
    dirHandle?: FileSystemDirectoryHandle | null
  ) => {
    setSelectedItems(items);
    setIgnoredFiles(ignored);
    if (dirHandle !== undefined) {
      setDirectoryHandle(dirHandle);
    }
  }, []);

  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const executeFullReset = async () => {
    setShowResetConfirmModal(false);
    await clearWorkflowSession();
    setSelectedItems([]);
    setIgnoredFiles([]);
    setDirectoryHandle(null);
    setSpecCheckResult(undefined);
    setPendingDraftMeta(null);
    setLastSavedTime(undefined);
    setProductInfo({
      productName: '',
      modelCode: '',
      brandName: '',
      brandLink: '',
      aiNotes: '',
      filePrefix: '',
      folderName: '',
    });
    setCurrentStep(1);
    setMaxStepReached(1);
    showToast('Đã làm mới toàn bộ tiến trình.');
  };

  const handleFullReset = async () => {
    // If no work has been loaded, reset cleanly right away
    const hasData =
      selectedItems.length > 0 ||
      Boolean(productInfo.brandName?.trim()) ||
      Boolean(productInfo.modelCode?.trim()) ||
      Boolean(productInfo.productName?.trim()) ||
      Boolean(productInfo.folderName?.trim()) ||
      Boolean(pendingDraftMeta);

    if (!hasData) {
      await executeFullReset();
    } else {
      setShowResetConfirmModal(true);
    }
  };

  const handleResetForNextProduct = async () => {
    await clearWorkflowSession();
    const prevNameParts = productInfo.productName.split(' ');
    const preservedPrefixWords = prevNameParts.slice(0, 2).join(' ');

    setSelectedItems([]);
    setIgnoredFiles([]);
    setDirectoryHandle(null);
    setSpecCheckResult(undefined);
    setPendingDraftMeta(null);
    setLastSavedTime(undefined);
    setProductInfo({
      productName: preservedPrefixWords ? `${preservedPrefixWords} ` : '',
      modelCode: '',
      brandName: productInfo.brandName || '',
      brandLink: productInfo.brandLink,
      aiNotes: '',
      filePrefix: '',
      folderName: '',
    });
    setCurrentStep(1);
    setMaxStepReached(1);
    showToast('Sẵn sàng xử lý sản phẩm tiếp theo.');
  };

  const handleReanalyzeSingle = async (index: number) => {
    const item = selectedItems[index];
    if (!item) return;

    setSelectedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: 'analyzing' };
      return copy;
    });

    try {
      const imagesPayload: { mimeType: string; data: string }[] = [];
      if (item.mediaType === 'video' && item.videoFramesBase64 && item.videoFramesBase64.length > 0) {
        item.videoFramesBase64.forEach((b64) => {
          imagesPayload.push({ mimeType: 'image/jpeg', data: b64 });
        });
      } else if (item.thumbnailBase64) {
        imagesPayload.push({
          mimeType: item.file.type || 'image/jpeg',
          data: item.thumbnailBase64,
        });
      }

      const res = await fetch('/api/analyze-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: item.originalName,
          mediaType: item.mediaType,
          productName: productInfo.productName,
          modelCode: productInfo.modelCode,
          aiNotes: productInfo.aiNotes,
          images: imagesPayload,
        }),
      });

      if (!res.ok) throw new Error('Lỗi khi phân tích lại');
      const data = await res.json();

      setSelectedItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          status: 'done',
          aiResult: data,
          editedSuffix: data.hau_to,
          editedAlt: data.alt,
        };
        return copy;
      });
      showToast(`Đã phân tích lại xong "${item.originalName}"`);
    } catch (e: any) {
      showToast(`Phân tích lại thất bại: ${e.message}`);
      setSelectedItems((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], status: 'done' };
        return copy;
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans relative">
      <Header
        onReset={handleFullReset}
        folderName={productInfo.folderName}
        productName={productInfo.productName}
        lastSavedTime={lastSavedTime}
        isSaving={isSaving}
      />

      {/* Draft restoration banner */}
      {pendingDraftMeta && selectedItems.length === 0 && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-4 py-3 border-b border-indigo-700 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-400/30">
                <History className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">
                  Tìm thấy phiên làm việc dở dang:
                </span>{' '}
                <span className="text-blue-200 font-semibold">
                  {pendingDraftMeta.productName} ({pendingDraftMeta.modelCode || 'Chưa có model'})
                </span>
                <span className="text-slate-300 block sm:inline sm:ml-2">
                  • {pendingDraftMeta.itemCount} tệp • Đang ở Bước {pendingDraftMeta.currentStep} • Lưu lúc{' '}
                  {new Date(pendingDraftMeta.savedAt).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleRestoreSession}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold transition shadow-xs"
              >
                <span>Tiếp tục phiên này</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDiscardSavedSession}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                title="Bỏ qua và bắt đầu phiên mới"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Bỏ qua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Stepper
        currentStep={currentStep}
        maxStepReached={maxStepReached}
        onStepClick={navigateToStep}
      />

      <main className="flex-1 pb-16">
        {currentStep === 1 && (
          <Step1FolderInput
            productInfo={productInfo}
            onUpdateProductInfo={handleUpdateProductInfo}
            onFilesSelected={handleFilesSelected}
            selectedItems={selectedItems}
            ignoredFiles={ignoredFiles}
            onProceed={() => navigateToStep(2)}
          />
        )}

        {currentStep === 2 && (
          <Step2AiAnalysis
            items={selectedItems}
            productInfo={productInfo}
            onUpdateItems={setSelectedItems}
            onProceed={() => navigateToStep(3)}
          />
        )}

        {currentStep === 3 && (
          <Step3SpecCheck
            items={selectedItems}
            productInfo={productInfo}
            specCheckResult={specCheckResult}
            onSaveSpecCheckResult={setSpecCheckResult}
            onProceed={() => navigateToStep(4)}
          />
        )}

        {currentStep === 4 && (
          <Step4ReviewTable
            items={selectedItems}
            productInfo={productInfo}
            onUpdateItems={setSelectedItems}
            onReanalyzeSingle={handleReanalyzeSingle}
            onProceed={() => navigateToStep(5)}
            onQuickSave={handleQuickSave}
          />
        )}

        {currentStep === 5 && (
          <Step5Export
            items={selectedItems}
            productInfo={productInfo}
            specCheckResult={specCheckResult}
            directoryHandle={directoryHandle}
            onUpdateItems={setSelectedItems}
            onResetForNextProduct={handleResetForNextProduct}
          />
        )}
      </main>

      {/* Confirmation Modal for Reset (Làm mới) */}
      {showResetConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowResetConfirmModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  Xác nhận làm mới toàn bộ tiến trình?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Phiên làm việc hiện tại, các tệp ảnh/video đã tải và bản nháp lưu tạm sẽ được dọn dẹp sạch sẽ để bạn bắt đầu xử lý sản phẩm mới từ Bước 1.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(selectedItems.length > 0 || productInfo.brandName || productInfo.modelCode || productInfo.productName) && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Dữ liệu hiện tại sẽ được xóa:</div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {selectedItems.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                      {selectedItems.length} tệp phương tiện
                    </span>
                  )}
                  {productInfo.brandName && (
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">
                      Hãng: {productInfo.brandName}
                    </span>
                  )}
                  {productInfo.modelCode && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                      Model: {productInfo.modelCode}
                    </span>
                  )}
                  {productInfo.productName && !productInfo.brandName && (
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-medium truncate max-w-[200px]">
                      {productInfo.productName}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeFullReset}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Làm mới ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center space-x-2.5 px-4 py-3 rounded-xl bg-slate-900/95 text-white text-xs font-semibold shadow-2xl border border-slate-700 backdrop-blur-md">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
