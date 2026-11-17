// A picked photo, uploaded as is by `toFormData()`.
export type PhotoFile = File;

// Small enough to upload several at once over mobile data, sharp enough to see a scratch
// (the same 1600 px and 0.7 quality as the phone app).
const MAX_SIDE = 1600;

export async function resizePhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob|null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    return blob ? new File([ blob ], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file; // a format the browser can't decode: the API validates it
  }
}
