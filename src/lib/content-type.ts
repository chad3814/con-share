const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Some browsers/OSes (notably Safari on iOS for HEIC/HEIF) leave File.type
// empty. Fall back to a lowercased-extension lookup so the presign request
// still carries a usable content type; if the extension is unrecognized,
// pass the (possibly empty) fileType through and let the server 400.
export function resolveContentType(fileType: string, fileName: string): string {
  if (fileType) return fileType;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return fileType;
  const extension = fileName.slice(dotIndex).toLowerCase();
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? fileType;
}
