/**
 * @fileOverview Client-side Image Optimization & Compression Utility.
 * Resizes large smartphone/camera photos to optimal dimensions (max 1024px)
 * and compresses to high-quality JPEG to prevent payload size limits and socket timeouts.
 */

export async function compressImage(
  fileOrDataUri: File | string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions preserving aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to original data URI if canvas context fails
        if (typeof fileOrDataUri === 'string') {
          resolve(fileOrDataUri);
        } else {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileOrDataUri);
        }
        return;
      }

      // Smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Export as compressed JPEG data URI
      const compressedDataUri = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUri);
    };

    img.onerror = (err) => {
      // If image loading fails, fallback
      if (typeof fileOrDataUri === 'string') {
        resolve(fileOrDataUri);
      } else {
        reject(err);
      }
    };

    if (typeof fileOrDataUri === 'string') {
      img.src = fileOrDataUri;
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          img.src = reader.result;
        } else {
          reject(new Error('Failed to read file as data URI'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUri);
    }
  });
}
