import { fitSize, stretchContrast, toGrayscale } from "./image-math";

/**
 * Prepares a photo for OCR: respects EXIF rotation, scales the longest side to
 * ~1600px (big phone photos are slow and no more accurate), converts to
 * grayscale and stretches contrast. This is the biggest accuracy lever for
 * crumpled receipts. Runs entirely in the browser.
 */
export async function preprocessImage(file: Blob, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitSize(bitmap.width, bitmap.height, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const img = ctx.getImageData(0, 0, width, height);
  const gray = stretchContrast(toGrayscale(img.data));
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = gray[p]!;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the image."))), "image/png"),
  );
}
