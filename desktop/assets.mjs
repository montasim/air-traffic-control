import { isAbsolute, relative, resolve, sep } from 'node:path';

export function resolveAsset(root, requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'atc:' || url.hostname !== 'game' || url.port || url.username || url.password) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const local = relative(root, file);
  return local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local) ? null : file;
}
