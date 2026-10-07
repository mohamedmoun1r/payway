import QRCode from 'qrcode';

/**
 * Generates an in-memory Base64 PNG Data URL for a receipt verification URL.
 * Pure in-memory computation with zero disk writes and zero external network calls.
 */
export async function generateQrDataUrl(verificationUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('[QR_GENERATION_ERROR]', err);
    throw new Error('Failed to generate receipt QR code image.');
  }
}
