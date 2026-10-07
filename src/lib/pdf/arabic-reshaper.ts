import bidiFactory from 'bidi-js';
// @ts-expect-error - arabic-persian-reshaper does not ship with official type definitions
import { ArabicShaper } from 'arabic-persian-reshaper';

const bidi = bidiFactory();

/**
 * Reshapes Arabic text to contextual forms (initial, medial, final, isolated)
 * and applies BiDi visual reordering for proper RTL rendering in PDF documents.
 */
export function formatArabicForPdf(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (!str.trim()) return str;

  // Check if string contains Arabic characters
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str);
  if (!hasArabic) {
    return str;
  }

  try {
    // 1. Reshape Arabic letters to Presentation Forms-B (joining medial/initial/final glyphs)
    const reshaped = ArabicShaper.convertArabic(str);

    // 2. Apply Unicode Bidirectional Algorithm (BiDi) reordering for RTL presentation
    const embeddingLevels = bidi.getEmbeddingLevels(reshaped, 'rtl');
    return bidi.getReorderedString(reshaped, embeddingLevels);
  } catch (err) {
    console.warn('[ARABIC_PDF_SHAPER_FALLBACK]', err);
    return str;
  }
}

/**
 * Converts a numeric currency amount into formal Arabic words (Tafqeet).
 * Example: 1000.00 -> "فقط ألف جنيه مصري لا غير"
 */
export function tafqeetCurrency(amount: number): string {
  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const teens = [
    'عشرة',
    'أحد عشر',
    'اثنا عشر',
    'ثلاثة عشر',
    'أربعة عشر',
    'خمسة عشر',
    'ستة عشر',
    'سبعة عشر',
    'ثمانية عشر',
    'تسعة عشر',
  ];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];


  const rounded = Math.floor(amount);
  if (rounded === 0) return 'فقط صفر جنيه مصري لا غير';

  function convertGroup(n: number): string {
    const parts: string[] = [];
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const u = rem % 10;

    if (h > 0) parts.push(hundreds[h]);

    if (rem > 0) {
      if (rem <= 10) {
        parts.push(units[rem]);
      } else if (rem < 20) {
        parts.push(teens[rem - 10]);
      } else {
        if (u > 0) parts.push(units[u]);
        if (t > 0) parts.push(tens[t]);
      }
    }

    return parts.filter(Boolean).join(' و');
  }

  const parts: string[] = [];
  const th = Math.floor(rounded / 1000);
  const rem1000 = rounded % 1000;

  if (th > 0) {
    if (th === 1) {
      parts.push('ألف');
    } else if (th === 2) {
      parts.push('ألفان');
    } else if (th >= 3 && th <= 10) {
      parts.push(`${units[th]} آلاف`);
    } else {
      parts.push(`${convertGroup(th)} ألف`);
    }
  }

  if (rem1000 > 0) {
    parts.push(convertGroup(rem1000));
  }

  const result = parts.join(' و');
  return `فقط ${result} جنيه مصري لا غير`;
}
