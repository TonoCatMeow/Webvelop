// @flow
// Writing exported websites: to a folder (desktop app) or to a ZIP file.
import JSZip from 'jszip';
import optionalRequire from '../../Utils/OptionalRequire';
import { type WebsiteProject } from '../Model/Schema';
import { buildWebsiteFiles, type BuildIssue, type BuiltFile } from '../Rendering/SiteBuilder';
import { buildReactProjectFiles } from '../Rendering/ReactProjectExporter';
import { getRuntimeSources } from './RuntimeSources';
import { readAssetContent, getProjectFolder } from './AssetFiles';
import { slugify } from '../Model/Ids';

const fs = optionalRequire('fs');
const path = optionalRequire('path');
const electron = optionalRequire('electron');
const remote = optionalRequire('@electron/remote');

export type ExportFormat = 'static' | 'react';

export type ExportResult = {|
  issues: Array<BuildIssue>,
  fileCount: number,
  outputPath: ?string,
|};

export type WebvelopPaths = {|
  dataDir: string,
  projectsDir: string,
  exportsDir: string,
  previewDir: string,
  logsDir: string,
|};

/** The folders used by Webvelop (desktop app only): all separate from any other application. */
export const getWebvelopPaths = (): ?WebvelopPaths => {
  if (!remote) return null;
  try {
    return remote.getGlobal('webvelopPaths') || null;
  } catch (e) {
    return null;
  }
};

export const buildExportFiles = async (
  project: WebsiteProject,
  format: ExportFormat
): Promise<{| files: Array<BuiltFile>, issues: Array<BuildIssue> |}> => {
  const runtime = await getRuntimeSources();
  return format === 'react' ? buildReactProjectFiles(project, runtime) : buildWebsiteFiles(project, runtime);
};

const getFileContent = (
  project: WebsiteProject,
  file: BuiltFile,
  projectFolder: ?string,
  issues: Array<BuildIssue>
): ?(string | Uint8Array) => {
  if (file.content !== undefined) return file.content;
  if (file.assetId) {
    const asset = project.assets.find(a => a.id === file.assetId);
    const content = asset ? readAssetContent(asset, projectFolder) : null;
    if (!content) {
      issues.push({
        severity: 'warning',
        source: 'Assets',
        message: `The file of the asset "${asset ? asset.name : file.assetId}" could not be found.`,
      });
    }
    return content;
  }
  return null;
};

export const exportToFolder = async (
  project: WebsiteProject,
  projectFilePath: ?string,
  outputFolder: string,
  format: ExportFormat
): Promise<ExportResult> => {
  if (!fs || !path) throw new Error('Exporting to a folder is only possible in the desktop app.');
  const { files, issues } = await buildExportFiles(project, format);
  const projectFolder = getProjectFolder(projectFilePath);
  fs.mkdirSync(outputFolder, { recursive: true });
  let fileCount = 0;
  files.forEach(file => {
    const content = getFileContent(project, file, projectFolder, issues);
    if (content === null || content === undefined) return;
    const destination = path.join(outputFolder, ...file.path.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
    fileCount++;
  });
  return { issues, fileCount, outputPath: outputFolder };
};

export const exportToZipBlob = async (
  project: WebsiteProject,
  projectFilePath: ?string,
  format: ExportFormat
): Promise<{| blob: Blob, issues: Array<BuildIssue>, fileCount: number |}> => {
  const { files, issues } = await buildExportFiles(project, format);
  const projectFolder = getProjectFolder(projectFilePath);
  const zip = new JSZip();
  let fileCount = 0;
  files.forEach(file => {
    const content = getFileContent(project, file, projectFolder, issues);
    if (content === null || content === undefined) return;
    zip.file(file.path, content);
    fileCount++;
  });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, issues, fileCount };
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body && document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export const getDefaultExportFolder = (project: WebsiteProject, format: ExportFormat): ?string => {
  const paths = getWebvelopPaths();
  if (!paths || !path) return null;
  return path.join(paths.exportsDir, slugify(project.name) + (format === 'react' ? '-react' : ''));
};

/** Export the website in the preview folder of Webvelop, and open it in the browser. */
export const openExportInBrowser = async (
  project: WebsiteProject,
  projectFilePath: ?string,
  pageFile: string = 'index.html'
): Promise<Array<BuildIssue>> => {
  const paths = getWebvelopPaths();
  if (!paths || !path || !electron) return [];
  const folder = path.join(paths.previewDir, slugify(project.name));
  const { issues } = await exportToFolder(project, projectFilePath, folder, 'static');
  await electron.shell.openExternal('file:///' + path.join(folder, pageFile).replace(/\\/g, '/'));
  return issues;
};

export const openFolder = (folder: string) => {
  if (electron) electron.shell.openPath(folder);
};

export const chooseFolder = async (title: string, defaultPath: ?string): Promise<?string> => {
  if (!remote) return null;
  const result = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
    title,
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
};
