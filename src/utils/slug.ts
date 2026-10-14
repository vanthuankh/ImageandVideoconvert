/**
 * Vietnamese slug generator and file prefix builder
 * Adheres to camerawifivn.com SEO guidelines
 */

export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  let result = str;
  // Convert đ and Đ
  result = result.replace(/đ/g, 'd').replace(/Đ/g, 'D');

  // Decompose accented characters and remove diacritics
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return result;
}

export function toSlug(str: string): string {
  if (!str) return '';
  const withoutAccents = removeVietnameseAccents(str).toLowerCase();
  
  // Replace non a-z0-9 characters with hyphen
  let slug = withoutAccents.replace(/[^a-z0-9]+/g, '-');
  
  // Collapse multiple hyphens
  slug = slug.replace(/-+/g, '-');
  
  // Trim leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug;
}

/**
 * Builds file prefix:
 * prefix = slug(productName)
 * Must contain slug(modelCode); if not, appends it.
 * Ends with a hyphen '-', e.g. "router-wifi-6-ruijie-reyee-rg-eg105gw-x-"
 */
export function buildFilePrefix(productName: string, modelCode: string): string {
  const pSlug = toSlug(productName);
  const mSlug = toSlug(modelCode);

  if (!pSlug && !mSlug) return 'san-pham-';
  if (!mSlug) return `${pSlug}-`;
  if (!pSlug) return `${mSlug}-`;

  // Check if product slug already contains model slug
  if (pSlug.includes(mSlug)) {
    return `${pSlug}-`;
  }

  return `${pSlug}-${mSlug}-`;
}

/**
 * Fixed camera angle suffixes dictionary for product photos:
 * mat-truoc, goc-nghieng-mat-truoc, mat-tren, mat-duoi, mat-sau-cong-ket-noi, canh-trai, canh-phai
 */
export const STANDARD_PRODUCT_ANGLES = [
  'mat-truoc',
  'goc-nghieng-mat-truoc',
  'mat-tren',
  'mat-duoi',
  'mat-sau-cong-ket-noi',
  'canh-trai',
  'canh-phai',
] as const;

/**
 * Ensures unique suffixes across items
 * Only appends -2, -3 when there is a genuine duplicate angle/suffix.
 */
export function ensureUniqueSuffixes<T extends { editedSuffix?: string; aiResult?: { hau_to: string } }>(
  items: T[]
): string[] {
  const seenCounts = new Map<string, number>();
  const results: string[] = [];

  for (const item of items) {
    let raw = (item.editedSuffix || item.aiResult?.hau_to || 'goc-nghieng-mat-truoc').trim();
    let baseSlug = toSlug(raw) || 'goc-nghieng-mat-truoc';

    // If already ending with -2, -3..., strip it to find genuine base angle
    const matchDuplicateIndex = baseSlug.match(/^(.*)-(\d+)$/);
    if (matchDuplicateIndex && matchDuplicateIndex[1]) {
      baseSlug = matchDuplicateIndex[1];
    }

    const currentCount = seenCounts.get(baseSlug) || 0;
    if (currentCount === 0) {
      seenCounts.set(baseSlug, 1);
      results.push(baseSlug);
    } else {
      const nextCount = currentCount + 1;
      seenCounts.set(baseSlug, nextCount);
      results.push(`${baseSlug}-${nextCount}`);
    }
  }

  return results;
}

/**
 * Extracts a likely model code from folder name, product name or file names
 * e.g. "Router Ruijie RG-EG105GW-X" -> "RG-EG105GW-X"
 * e.g. "Camera Ezviz C6N 2MP" -> "C6N"
 */
export function guessModelCode(folderName: string, sampleFileNames: string[] = []): string {
  // Common model code pattern with hyphens (e.g., RG-EG105GW-X, DS-2CD2143G2-I, IPC-HFW1230S, RE-600)
  const modelRegex = /[A-Z0-9]+-[A-Z0-9]+(-[A-Z0-9]+)*/i;

  if (folderName) {
    const folderMatch = folderName.match(modelRegex);
    if (folderMatch) {
      return folderMatch[0];
    }
  }

  for (const name of sampleFileNames) {
    if (!name) continue;
    const match = name.match(modelRegex);
    if (match) {
      return match[0];
    }
    // Match standalone model codes like C6N, TY1, RE605X, AX3000, IPC120
    const standaloneMatch = name.match(/\b([A-Z]{1,4}\d{2,5}[A-Z0-9]*)\b/i);
    if (standaloneMatch && standaloneMatch[1].length >= 3) {
      return standaloneMatch[1];
    }
  }

  // Fallback to cleaned folder name if short
  if (folderName) {
    const cleaned = folderName.replace(/[_\s]+/g, '-').trim();
    if (cleaned.length <= 25 && cleaned.length >= 3) {
      return cleaned;
    }
  }

  return '';
}
