// @flow
// Assets (images, videos, fonts...) of a website.
// - On the desktop app, assets are files copied into the "assets" folder,
//   next to the project file. They are displayed in the editor with blob URLs.
// - On the web app (or for projects not saved yet), assets are stored in the
//   project as data URLs.
import optionalRequire from '../../Utils/OptionalRequire';
import { type WebsiteProject, type WebsiteAsset } from '../Model/Schema';
import { newId, makeUniqueName } from '../Model/Ids';

const fs = optionalRequire('fs');
const path = optionalRequire('path');

export const ASSETS_FOLDER = 'assets';

export const getAssetKind = (mimeType: string, fileName: string): $PropertyType<WebsiteAsset, 'kind'> => {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)$/.test(lower)) return 'image';
  if (mimeType.startsWith('video/') || /\.(mp4|webm|ogv|mov)$/.test(lower)) return 'video';
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/.test(lower)) return 'audio';
  if (mimeType.startsWith('font/') || /\.(woff2?|ttf|otf)$/.test(lower)) return 'font';
  return 'file';
};

const mimeTypesByExtension = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
};

export const getMimeType = (fileName: string): string => {
  const extension = (fileName.split('.').pop() || '').toLowerCase();
  return mimeTypesByExtension[extension] || 'application/octet-stream';
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const commaIndex = dataUrl.indexOf(',');
  const header = dataUrl.substring(0, commaIndex);
  const data = dataUrl.substring(commaIndex + 1);
  if (header.includes(';base64')) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(data));
};

export const getProjectFolder = (projectFilePath: ?string): ?string =>
  projectFilePath && path ? path.dirname(projectFilePath) : null;

/**
 * Create assets from files chosen by the user. If the project is saved on
 * the disk, files are copied in its assets folder. Otherwise, they are stored
 * as data URLs.
 */
export const createAssetsFromFiles = async (
  project: WebsiteProject,
  files: Array<File>,
  projectFilePath: ?string
): Promise<Array<WebsiteAsset>> => {
  const projectFolder = getProjectFolder(projectFilePath);
  const existingNames = project.assets.map(asset => asset.name);
  const assets = [];
  for (const file of files) {
    const name = makeUniqueName(file.name, existingNames, '-');
    existingNames.push(name);
    const mimeType = file.type || getMimeType(file.name);
    const asset: WebsiteAsset = {
      id: newId('f'),
      name,
      kind: getAssetKind(mimeType, file.name),
      mimeType,
      size: file.size,
    };
    if (projectFolder && fs && path) {
      const folder = path.join(projectFolder, ASSETS_FOLDER);
      fs.mkdirSync(folder, { recursive: true });
      const fileName = name.replace(/[^\w.-]+/g, '-');
      const buffer = new Uint8Array(await file.arrayBuffer());
      fs.writeFileSync(path.join(folder, fileName), buffer);
      asset.path = ASSETS_FOLDER + '/' + fileName;
    } else {
      asset.dataUrl = await readBlobAsDataUrl(file);
    }
    assets.push(asset);
  }
  return assets;
};

/**
 * Write the assets stored as data URLs into the assets folder of the project
 * (done when a project is saved on the disk).
 */
export const writeDataUrlAssetsToFolder = (
  project: WebsiteProject,
  projectFolder: string
): WebsiteProject => {
  if (!fs || !path) return project;
  if (!project.assets.some(asset => asset.dataUrl)) return project;
  const folder = path.join(projectFolder, ASSETS_FOLDER);
  fs.mkdirSync(folder, { recursive: true });
  return {
    ...project,
    assets: project.assets.map(asset => {
      if (!asset.dataUrl) return asset;
      const fileName = asset.name.replace(/[^\w.-]+/g, '-');
      fs.writeFileSync(path.join(folder, fileName), dataUrlToUint8Array(asset.dataUrl));
      const { dataUrl, ...rest } = asset;
      return { ...rest, path: ASSETS_FOLDER + '/' + fileName };
    }),
  };
};

/** Copy the asset files of a project to a new project folder (used by "Save as"). */
export const copyAssetFilesToFolder = (
  project: WebsiteProject,
  fromFolder: string,
  toFolder: string
) => {
  if (!fs || !path || fromFolder === toFolder) return;
  project.assets.forEach(asset => {
    if (!asset.path) return;
    const source = path.join(fromFolder, asset.path);
    const destination = path.join(toFolder, asset.path);
    if (!fs.existsSync(source)) return;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  });
};

/** Read the content of an asset (for exports). */
export const readAssetContent = (
  asset: WebsiteAsset,
  projectFolder: ?string
): ?Uint8Array => {
  if (asset.dataUrl) return dataUrlToUint8Array(asset.dataUrl);
  if (asset.path && projectFolder && fs && path) {
    const filePath = path.join(projectFolder, asset.path);
    if (fs.existsSync(filePath)) return new Uint8Array(fs.readFileSync(filePath));
  }
  return null;
};

/**
 * Resolve the URL of assets for the editor, preview and canvas.
 * Files are read once and exposed as blob URLs (usable in the canvas and
 * preview iframes, which share the origin of the editor).
 */
export class AssetUrlResolver {
  _cache: Map<string, string> = new Map();

  resolve(project: WebsiteProject, assetId: string, projectFilePath: ?string): string {
    const asset = project.assets.find(a => a.id === assetId);
    if (!asset) return '';
    if (asset.dataUrl) return asset.dataUrl;
    const projectFolder = getProjectFolder(projectFilePath);
    if (!asset.path || !projectFolder || !fs || !path) return '';
    const filePath = path.join(projectFolder, asset.path);
    const cached = this._cache.get(filePath);
    if (cached) return cached;
    try {
      const content = fs.readFileSync(filePath);
      const url = URL.createObjectURL(new Blob([content], { type: asset.mimeType }));
      this._cache.set(filePath, url);
      return url;
    } catch (error) {
      console.warn(`Unable to read the asset ${filePath}:`, error);
      return '';
    }
  }

  /** Forget the cached URL of a file (when it was replaced). */
  invalidate() {
    this._cache.forEach(url => URL.revokeObjectURL(url));
    this._cache.clear();
  }
}
