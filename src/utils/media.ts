import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface ImageThumbnailResult {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface VideoMetadataResult {
  duration: number;
  width: number;
  height: number;
  isShortStaticVideo: boolean;
  thumbnailUrl: string;
  thumbnailBase64: string;
  framesBase64: string[];
}

export interface GifTier {
  width: number;
  fps: number;
  colors: number;
  label: string;
}

export const GIF_TIERS: GifTier[] = [
  { width: 900, fps: 12, colors: 128, label: '900px / 12fps / 128 màu' },
  { width: 800, fps: 10, colors: 128, label: '800px / 10fps / 128 màu' },
  { width: 720, fps: 10, colors: 96, label: '720px / 10fps / 96 màu' },
  { width: 720, fps: 8, colors: 80, label: '720px / 8fps / 80 màu' },
  { width: 640, fps: 8, colors: 64, label: '640px / 8fps / 64 màu' },
  { width: 560, fps: 8, colors: 64, label: '560px / 8fps / 64 màu' },
  { width: 480, fps: 6, colors: 48, label: '480px / 6fps / 48 màu' },
];

/**
 * Creates image thumbnail scaled to max dimension 1024px
 */
export async function createImageThumbnail(
  file: File,
  maxDimension = 1024
): Promise<ImageThumbnailResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Scale down if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Preserve transparency for PNG, WebP
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, 0.85);
      const base64 = dataUrl.split(',')[1] || '';

      resolve({
        dataUrl,
        base64,
        mimeType,
        width,
        height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Không thể đọc file ảnh: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Extracts metadata and 6 keyframes from video file
 */
export async function extractVideoMetadataAndFrames(
  file: File,
  frameCount = 6
): Promise<VideoMetadataResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = async () => {
      const duration = video.duration || 0;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;

      // Check if video is single-frame or under 0.2s -> static image
      const isShortStaticVideo = duration < 0.2 || duration === 0;

      try {
        const framesBase64: string[] = [];
        let firstFrameDataUrl = '';

        if (isShortStaticVideo) {
          // Extract only the single frame
          video.currentTime = 0;
          await waitForSeek(video);
          const frame = captureVideoFrame(video, 1024);
          framesBase64.push(frame.base64);
          firstFrameDataUrl = frame.dataUrl;
        } else {
          // Extract evenly distributed frame count
          const step = duration / (frameCount + 1);
          for (let i = 1; i <= frameCount; i++) {
            video.currentTime = Math.min(step * i, duration - 0.05);
            await waitForSeek(video);
            const frame = captureVideoFrame(video, 1024);
            framesBase64.push(frame.base64);
            if (i === 1) {
              firstFrameDataUrl = frame.dataUrl;
            }
          }
        }

        URL.revokeObjectURL(objectUrl);
        resolve({
          duration,
          width,
          height,
          isShortStaticVideo,
          thumbnailUrl: firstFrameDataUrl,
          thumbnailBase64: framesBase64[0] || '',
          framesBase64,
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Không thể giải mã video: ${file.name}`));
    };

    video.src = objectUrl;
  });
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler);
      resolve();
    };
    video.addEventListener('seeked', handler);
  });
}

function captureVideoFrame(video: HTMLVideoElement, maxDimension = 1024) {
  let width = video.videoWidth || 640;
  let height = video.videoHeight || 360;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0, width, height);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const base64 = dataUrl.split(',')[1] || '';
  return { dataUrl, base64, width, height };
}

/**
 * Compress static image or video frame to WebP:
 * - If width > 1200px -> downscale to width 1200px, keeping aspect ratio
 * - Do NOT upscale smaller images
 * - Preserve alpha transparency (no white background)
 * - Quality = 0.82
 */
export async function compressToWebP(
  source: File | HTMLImageElement | HTMLVideoElement,
  maxWidth = 1200,
  quality = 0.82
): Promise<Blob> {
  let imgElement: HTMLImageElement | null = null;
  let objectUrlToRevoke = '';

  if (source instanceof File) {
    imgElement = new Image();
    objectUrlToRevoke = URL.createObjectURL(source);
    await new Promise<void>((resolve, reject) => {
      imgElement!.onload = () => resolve();
      imgElement!.onerror = () => reject(new Error('Lỗi load ảnh để nén WebP'));
      imgElement!.src = objectUrlToRevoke;
    });
  } else if (source instanceof HTMLImageElement) {
    imgElement = source;
  }

  const naturalWidth = imgElement ? imgElement.naturalWidth : (source as HTMLVideoElement).videoWidth;
  const naturalHeight = imgElement ? imgElement.naturalHeight : (source as HTMLVideoElement).videoHeight;

  let targetWidth = naturalWidth;
  let targetHeight = naturalHeight;

  // Downscale if width > maxWidth, do not upscale
  if (naturalWidth > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = Math.round((naturalHeight * maxWidth) / naturalWidth);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    throw new Error('Canvas context không khả dụng');
  }

  // Draw source (maintains transparency for PNG)
  if (imgElement) {
    ctx.drawImage(imgElement, 0, 0, targetWidth, targetHeight);
  } else {
    ctx.drawImage(source as HTMLVideoElement, 0, 0, targetWidth, targetHeight);
  }

  if (objectUrlToRevoke) {
    URL.revokeObjectURL(objectUrlToRevoke);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Trình duyệt không hỗ trợ xuất toBlob WebP'));
        }
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Video to GIF conversion using gifenc:
 * - Hard limit: < 3.9 MB (CMS reject files > 4MB)
 * - Tiers: 900px/12fps/128 colors -> ... -> 480px/6fps/48 colors
 * - Video 3D render start tier: 720px/8fps/80 colors
 * - Global quantized palette from sample frames, no dither, loop infinite
 * - If still > 3.9 MB at last tier: keep only first 15 seconds
 */
export async function convertVideoToGif(
  file: File,
  onProgress?: (info: { progress: number; tierLabel: string; currentSizeMB?: number }) => void,
  isDark3D = false
): Promise<{ blob: Blob; tierUsed: string; sizeMB: number; warningNotice?: string }> {
  const MAX_BYTES = 3.9 * 1024 * 1024; // 3.9 MB hard limit

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Lỗi load video để xuất GIF'));
  });

  const rawDuration = video.duration || 1;
  const originalWidth = video.videoWidth || 640;
  const originalHeight = video.videoHeight || 360;

  // Decide starting tier index: 3D render starts at tier 3 (720px / 8fps / 80 colors)
  const startTierIndex = isDark3D ? 3 : 0;
  let warningNotice: string | undefined;

  for (let tierIdx = startTierIndex; tierIdx < GIF_TIERS.length; tierIdx++) {
    const tier = GIF_TIERS[tierIdx];
    const durationToUse = rawDuration;

    onProgress?.({
      progress: Math.round((tierIdx / GIF_TIERS.length) * 80),
      tierLabel: `Đang thử cấu hình: ${tier.label}...`,
    });

    const result = await encodeGifWithParams(
      video,
      originalWidth,
      originalHeight,
      durationToUse,
      tier.width,
      tier.fps,
      tier.colors
    );

    if (result.bytes.length < MAX_BYTES) {
      URL.revokeObjectURL(objectUrl);
      const blob = new Blob([result.bytes as BlobPart], { type: 'image/gif' });
      return {
        blob,
        tierUsed: tier.label,
        sizeMB: result.bytes.length / (1024 * 1024),
      };
    }
  }

  // If still > 3.9 MB at last tier, cap to first 15 seconds
  warningNotice = 'Video quá dài/nặng nên đã cắt giữ lại 15 giây đầu để đảm bảo dung lượng dưới 3.9 MB.';
  const cappedDuration = Math.min(rawDuration, 15);
  const lowestTier = GIF_TIERS[GIF_TIERS.length - 1]; // 480px / 6fps / 48 colors

  onProgress?.({
    progress: 90,
    tierLabel: 'Áp dụng giới hạn 15s đầu + 480px / 6fps / 48 màu...',
  });

  const finalResult = await encodeGifWithParams(
    video,
    originalWidth,
    originalHeight,
    cappedDuration,
    lowestTier.width,
    lowestTier.fps,
    lowestTier.colors
  );

  URL.revokeObjectURL(objectUrl);
  const blob = new Blob([finalResult.bytes as BlobPart], { type: 'image/gif' });

  return {
    blob,
    tierUsed: `${lowestTier.label} (Cắt 15 giây đầu)`,
    sizeMB: finalResult.bytes.length / (1024 * 1024),
    warningNotice,
  };
}

/**
 * Encodes GIF for a specific resolution, fps, and color count
 */
async function encodeGifWithParams(
  video: HTMLVideoElement,
  origWidth: number,
  origHeight: number,
  duration: number,
  targetWidth: number,
  fps: number,
  maxColors: number
): Promise<{ bytes: Uint8Array }> {
  let renderWidth = origWidth;
  let renderHeight = origHeight;

  if (origWidth > targetWidth) {
    renderWidth = targetWidth;
    renderHeight = Math.round((origHeight * targetWidth) / origWidth);
  }

  // Ensure dimensions are even numbers (better compatibility)
  if (renderWidth % 2 !== 0) renderWidth -= 1;
  if (renderHeight % 2 !== 0) renderHeight -= 1;

  const canvas = document.createElement('canvas');
  canvas.width = renderWidth;
  canvas.height = renderHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D context');

  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const delayMs = Math.round(1000 / fps);
  const frameInterval = duration / totalFrames;

  // 1. Collect sample frames to create a global quantized palette
  const sampleFrameIndices = [
    0,
    Math.floor(totalFrames * 0.25),
    Math.floor(totalFrames * 0.5),
    Math.floor(totalFrames * 0.75),
    Math.max(0, totalFrames - 1),
  ];

  const samplePixelsList: Uint8ClampedArray[] = [];
  for (const idx of sampleFrameIndices) {
    const time = Math.min(idx * frameInterval, duration - 0.02);
    video.currentTime = time;
    await waitForSeek(video);
    ctx.drawImage(video, 0, 0, renderWidth, renderHeight);
    const imgData = ctx.getImageData(0, 0, renderWidth, renderHeight);
    samplePixelsList.push(imgData.data);
  }

  // Combine sample frames to build a unified palette
  const totalSamplePixels = samplePixelsList.reduce((acc, curr) => acc + curr.length, 0);
  const combinedSample = new Uint8ClampedArray(totalSamplePixels);
  let offset = 0;
  for (const sp of samplePixelsList) {
    combinedSample.set(sp, offset);
    offset += sp.length;
  }

  // Quantize palette from sample frames
  const palette = quantize(combinedSample, maxColors);

  // 2. Encode all frames with the global palette
  const gif = GIFEncoder();

  for (let f = 0; f < totalFrames; f++) {
    const time = Math.min(f * frameInterval, duration - 0.02);
    video.currentTime = time;
    await waitForSeek(video);
    ctx.drawImage(video, 0, 0, renderWidth, renderHeight);
    const imgData = ctx.getImageData(0, 0, renderWidth, renderHeight);

    // Map pixels to palette index without dithering
    const indexed = applyPalette(imgData.data, palette);

    // repeat: 0 on first frame enables Netscape infinite loop
    gif.writeFrame(indexed, renderWidth, renderHeight, {
      palette,
      delay: delayMs,
      repeat: f === 0 ? 0 : undefined,
    });
  }

  gif.finish();
  return { bytes: gif.bytes() };
}
