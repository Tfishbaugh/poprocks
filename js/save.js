// Saves a video: the share sheet on phones and tablets (Save Video → Photos/Gallery),
// a download on laptops.

const pad2 = (n) => String(n).padStart(2, '0');

export function fileName(date, ext) {
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return `PopRocks-${day}-${pad2(date.getHours())}${pad2(date.getMinutes())}.${ext}`;
}

export function saveMethod({ nav, coarse, file }) {
  if (!coarse || typeof nav?.canShare !== 'function') return 'download';
  return nav.canShare({ files: [file] }) ? 'share' : 'download';
}

export function download(file, doc = document, urls = URL) {
  const url = urls.createObjectURL(file);
  const link = doc.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => urls.revokeObjectURL(url), 60_000);
}

// Resolves to 'shared', 'cancelled' or 'downloaded'.
export async function saveVideo(file, { nav = navigator, coarse, doc = document, urls = URL } = {}) {
  if (saveMethod({ nav, coarse, file }) === 'download') {
    download(file, doc, urls);
    return 'downloaded';
  }
  try {
    await nav.share({ files: [file] });
    return 'shared';
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
    download(file, doc, urls);
    return 'downloaded';
  }
}
