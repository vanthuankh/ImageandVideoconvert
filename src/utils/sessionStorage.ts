import { MediaItem, ProductInfo, SpecCheckResult, StepNumber } from '../types';

const STORAGE_KEY_META = 'camerawifi_session_meta';
const STORAGE_KEY_STATE = 'camerawifi_session_state';
const DB_NAME = 'camerawifi_files_db';
const DB_VERSION = 1;
const STORE_NAME = 'files';

/**
 * Open IndexedDB for storing file blobs across browser sessions
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save file blob to IndexedDB
 */
async function saveFileToDB(id: string, file: File): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Cannot persist file to IndexedDB:', id, err);
  }
}

/**
 * Retrieve file blob from IndexedDB
 */
async function getFileFromDB(id: string): Promise<File | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Clear all files in IndexedDB
 */
async function clearDB(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Cannot clear IndexedDB:', err);
  }
}

export interface SavedSessionMeta {
  productName: string;
  modelCode: string;
  currentStep: StepNumber;
  maxStepReached: StepNumber;
  itemCount: number;
  savedAt: string;
}

export interface SerializedMediaItem {
  id: string;
  originalName: string;
  mediaType: 'image' | 'video';
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  isShortStaticVideo?: boolean;
  thumbnailUrl: string;
  thumbnailBase64?: string;
  videoFramesBase64?: string[];
  status: 'pending' | 'preparing' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
  retryCount: number;
  aiResult?: any;
  editedSuffix?: string;
  editedAlt?: string;
  isFeatured: boolean;
  isSkipped: boolean;
  exportedFileName?: string;
  exportedSize?: number;
  gifTierInfo?: string;
}

export interface SavedSessionData {
  currentStep: StepNumber;
  maxStepReached: StepNumber;
  productInfo: ProductInfo;
  items: SerializedMediaItem[];
  specCheckResult?: SpecCheckResult;
  savedAt: string;
}

/**
 * Check if a saved session exists
 */
export function getSavedSessionMeta(): SavedSessionMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save current workflow state to localStorage & IndexedDB
 */
export async function saveWorkflowSession(
  currentStep: StepNumber,
  maxStepReached: StepNumber,
  productInfo: ProductInfo,
  items: MediaItem[],
  specCheckResult?: SpecCheckResult
): Promise<void> {
  try {
    // Only save if there's meaningful data
    if (!productInfo.productName && !productInfo.modelCode && items.length === 0) {
      return;
    }

    const savedAt = new Date().toISOString();

    // 1. Save metadata summary to localStorage
    const meta: SavedSessionMeta = {
      productName: productInfo.productName || 'Chưa đặt tên',
      modelCode: productInfo.modelCode || '',
      currentStep,
      maxStepReached,
      itemCount: items.length,
      savedAt,
    };
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));

    // 2. Serialize items (exclude raw File object)
    const serializedItems: SerializedMediaItem[] = items.map((it) => ({
      id: it.id,
      originalName: it.originalName,
      mediaType: it.mediaType,
      size: it.size,
      width: it.width,
      height: it.height,
      duration: it.duration,
      isShortStaticVideo: it.isShortStaticVideo,
      thumbnailUrl: it.thumbnailUrl,
      thumbnailBase64: it.thumbnailBase64,
      videoFramesBase64: it.videoFramesBase64,
      status: it.status === 'analyzing' ? 'pending' : it.status, // Reset in-flight status
      errorMessage: it.errorMessage,
      retryCount: it.retryCount,
      aiResult: it.aiResult,
      editedSuffix: it.editedSuffix,
      editedAlt: it.editedAlt,
      isFeatured: it.isFeatured,
      isSkipped: it.isSkipped,
      exportedFileName: it.exportedFileName,
      exportedSize: it.exportedSize,
      gifTierInfo: it.gifTierInfo,
    }));

    const sessionData: SavedSessionData = {
      currentStep,
      maxStepReached,
      productInfo,
      items: serializedItems,
      specCheckResult,
      savedAt,
    };

    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(sessionData));

    // 3. Persist original File objects to IndexedDB
    for (const it of items) {
      if (it.file) {
        await saveFileToDB(it.id, it.file);
      }
    }
  } catch (err) {
    console.warn('Failed to save session to localStorage/IndexedDB:', err);
  }
}

/**
 * Load workflow session and restore File objects
 */
export async function loadWorkflowSession(): Promise<{
  currentStep: StepNumber;
  maxStepReached: StepNumber;
  productInfo: ProductInfo;
  items: MediaItem[];
  specCheckResult?: SpecCheckResult;
  savedAt: string;
} | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    if (!raw) return null;

    const data: SavedSessionData = JSON.parse(raw);
    const restoredItems: MediaItem[] = [];

    for (const it of data.items) {
      let file = await getFileFromDB(it.id);

      // If file not in DB, recreate lightweight File from thumbnail base64 as fallback
      if (!file && it.thumbnailBase64) {
        try {
          const byteChars = atob(it.thumbnailBase64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {
            type: it.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          });
          file = new File([blob], it.originalName, { type: blob.type });
        } catch {
          // Empty fallback file
          file = new File([new Blob()], it.originalName);
        }
      } else if (!file) {
        file = new File([new Blob()], it.originalName);
      }

      restoredItems.push({
        ...it,
        file,
      });
    }

    return {
      currentStep: data.currentStep,
      maxStepReached: data.maxStepReached,
      productInfo: data.productInfo,
      items: restoredItems,
      specCheckResult: data.specCheckResult,
      savedAt: data.savedAt,
    };
  } catch (err) {
    console.error('Failed to load workflow session:', err);
    return null;
  }
}

/**
 * Delete saved session completely
 */
export async function clearWorkflowSession(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY_META);
    localStorage.removeItem(STORAGE_KEY_STATE);
    await clearDB();
  } catch (err) {
    console.warn('Error clearing session:', err);
  }
}
