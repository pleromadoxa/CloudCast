const DEFAULT_MAX_WIDTH = 960;
const DEFAULT_MAX_HEIGHT = 540;
const JPEG_QUALITY = 0.92;

export interface ResizeResult {
  dataUrl: string;
  width: number;
  height: number;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file.'));
    };
    img.src = url;
  });
}

/** Resize image for overlay use; preserves PNG alpha when source is PNG. */
export async function resizeImageForOverlay(
  file: File,
  maxWidth = DEFAULT_MAX_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
): Promise<ResizeResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a PNG, JPG, or WebP image.');
  }

  const img = await loadImageFromFile(file);
  let { width, height } = img;

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const usePng = file.type === 'image/png' || file.type === 'image/webp';
  const dataUrl = usePng
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', JPEG_QUALITY);

  return { dataUrl, width, height };
}

export function rescaleOverlayDimensions(
  naturalWidth: number,
  naturalHeight: number,
  scalePercent: number,
): { width: string; height: string } {
  const factor = scalePercent / 100;
  return {
    width: `${Math.round(naturalWidth * factor)}px`,
    height: `${Math.round(naturalHeight * factor)}px`,
  };
}
