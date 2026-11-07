// @flow
// Storage providers of Webvelop:
// - LocalFile: website projects saved as ".webvelop" files on the disk
//   (desktop app). Assets are copied into an "assets" folder next to the file.
//   Autosaves are kept in the data folder of Webvelop.
// - Browser: projects saved in the browser (IndexedDB), for the web version.
import optionalRequire from '../Utils/OptionalRequire';
import { type StorageProvider, type FileMetadata } from '.';
import {
  type WebsiteProject,
  isWebsiteProjectContent,
  PROJECT_FILE_EXTENSION,
} from '../Website/Model/Schema';
import { migrateWebsiteProject } from '../Website/Model/Migration';
import {
  writeDataUrlAssetsToFolder,
  copyAssetFilesToFolder,
  getProjectFolder,
} from '../Website/Services/AssetFiles';
import { getWebvelopPaths } from '../Website/Services/WebsiteExporter';
import { slugify, newUuid } from '../Website/Model/Ids';

const fs = optionalRequire('fs');
const path = optionalRequire('path');
const remote = optionalRequire('@electron/remote');

const parseProject = (text: string, where: string): WebsiteProject => {
  let content;
  try {
    content = JSON.parse(text);
  } catch (error) {
    throw new Error(`The file ${where} is not a valid website project (invalid JSON).`);
  }
  if (!isWebsiteProjectContent(content)) {
    throw new Error(`The file ${where} is not a Webvelop website project.`);
  }
  return migrateWebsiteProject(content);
};

const serializeProject = (project: WebsiteProject): string => JSON.stringify(project, null, 2);

// Desktop: local files

const getAutosavePath = (fileIdentifier: string): ?string => {
  const paths = getWebvelopPaths();
  if (!paths || !path) return null;
  let hash = 0;
  for (let i = 0; i < fileIdentifier.length; i++) hash = ((hash << 5) - hash + fileIdentifier.charCodeAt(i)) | 0;
  const baseName = path.basename(fileIdentifier, '.' + PROJECT_FILE_EXTENSION);
  return path.join(paths.dataDir, 'autosaves', `${slugify(baseName)}-${(hash >>> 0).toString(16)}.${PROJECT_FILE_EXTENSION}`);
};

const writeFileAtomically = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + '.tmp';
  fs.writeFileSync(temporaryPath, content, 'utf8');
  fs.renameSync(temporaryPath, filePath);
};

export const LocalFileStorageProvider: StorageProvider = {
  internalName: 'LocalFile',
  name: 'Your computer',
  usesFileSystem: true,
  open: async (fileMetadata: FileMetadata) => {
    if (!fs) throw new Error('Files can only be opened in the desktop app.');
    const text = fs.readFileSync(fileMetadata.fileIdentifier, 'utf8');
    return parseProject(text, fileMetadata.fileIdentifier);
  },
  chooseFileToOpen: async () => {
    if (!remote) return null;
    const paths = getWebvelopPaths();
    const result = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
      title: 'Open a website',
      defaultPath: paths ? paths.projectsDir : undefined,
      properties: ['openFile'],
      filters: [{ name: 'Webvelop website', extensions: [PROJECT_FILE_EXTENSION] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return { fileIdentifier: result.filePaths[0], lastModifiedDate: Date.now() };
  },
  save: async (project: WebsiteProject, fileMetadata: FileMetadata) => {
    const folder = getProjectFolder(fileMetadata.fileIdentifier);
    const projectToSave = folder ? writeDataUrlAssetsToFolder(project, folder) : project;
    writeFileAtomically(fileMetadata.fileIdentifier, serializeProject(projectToSave));
    await LocalFileStorageProvider.deleteAutosave(fileMetadata);
    return {
      fileMetadata: { ...fileMetadata, name: project.name, lastModifiedDate: Date.now() },
      project: projectToSave,
    };
  },
  chooseSaveAsLocation: async (project: WebsiteProject, current: ?FileMetadata) => {
    if (!remote || !path) return null;
    const paths = getWebvelopPaths();
    const slug = slugify(project.name);
    const defaultFolder = current ? path.dirname(path.dirname(current.fileIdentifier)) : paths ? paths.projectsDir : '';
    const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
      title: 'Save the website as',
      defaultPath: path.join(defaultFolder, slug, `${slug}.${PROJECT_FILE_EXTENSION}`),
      filters: [{ name: 'Webvelop website', extensions: [PROJECT_FILE_EXTENSION] }],
    });
    if (result.canceled || !result.filePath) return null;
    return { fileIdentifier: result.filePath, lastModifiedDate: Date.now() };
  },
  saveAs: async (project: WebsiteProject, newFileMetadata: FileMetadata, previousFileMetadata: ?FileMetadata) => {
    const previousFolder = previousFileMetadata ? getProjectFolder(previousFileMetadata.fileIdentifier) : null;
    const newFolder = getProjectFolder(newFileMetadata.fileIdentifier);
    if (previousFolder && newFolder) copyAssetFilesToFolder(project, previousFolder, newFolder);
    return LocalFileStorageProvider.save(project, newFileMetadata);
  },
  getNewProjectLocation: ({ name, folder }) => {
    const paths = getWebvelopPaths();
    const slug = slugify(name);
    const baseFolder = folder || (paths ? paths.projectsDir : '');
    let projectFolder = path ? path.join(baseFolder, slug) : slug;
    // Don't overwrite an existing website.
    if (fs && path) {
      let index = 2;
      while (fs.existsSync(path.join(projectFolder, `${slug}.${PROJECT_FILE_EXTENSION}`))) {
        projectFolder = path.join(baseFolder, `${slug}-${index++}`);
      }
    }
    return {
      fileIdentifier: path
        ? path.join(projectFolder, `${path.basename(projectFolder)}.${PROJECT_FILE_EXTENSION}`)
        : `${slug}.${PROJECT_FILE_EXTENSION}`,
      name,
      lastModifiedDate: Date.now(),
    };
  },
  autosave: async (project: WebsiteProject, fileMetadata: FileMetadata) => {
    const autosavePath = getAutosavePath(fileMetadata.fileIdentifier);
    if (!autosavePath || !fs) return;
    writeFileAtomically(autosavePath, JSON.stringify(project));
  },
  getAutosave: async (fileMetadata: FileMetadata) => {
    const autosavePath = getAutosavePath(fileMetadata.fileIdentifier);
    if (!autosavePath || !fs || !fs.existsSync(autosavePath)) return null;
    const autosaveDate = fs.statSync(autosavePath).mtimeMs;
    const projectDate = fs.existsSync(fileMetadata.fileIdentifier) ? fs.statSync(fileMetadata.fileIdentifier).mtimeMs : 0;
    if (autosaveDate <= projectDate) return null;
    try {
      return { project: parseProject(fs.readFileSync(autosavePath, 'utf8'), autosavePath), date: autosaveDate };
    } catch (error) {
      console.warn('Ignoring an invalid autosave:', error);
      return null;
    }
  },
  deleteAutosave: async (fileMetadata: FileMetadata) => {
    const autosavePath = getAutosavePath(fileMetadata.fileIdentifier);
    if (autosavePath && fs && fs.existsSync(autosavePath)) fs.unlinkSync(autosavePath);
  },
  describeLocation: (fileMetadata: FileMetadata) => fileMetadata.fileIdentifier,
};

// Web: IndexedDB

const DATABASE_NAME = 'webvelop-projects';
const PROJECTS_STORE = 'projects';
const AUTOSAVES_STORE = 'autosaves';

const openDatabase = (): Promise<any> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECTS_STORE)) database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(AUTOSAVES_STORE)) database.createObjectStore(AUTOSAVES_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTransaction = async (storeName: string, mode: string, operation: any => any): Promise<any> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
  });
};

export type BrowserProjectSummary = {| id: string, name: string, lastModifiedDate: number |};

export const listBrowserProjects = async (): Promise<Array<BrowserProjectSummary>> => {
  const records = (await runTransaction(PROJECTS_STORE, 'readonly', store => store.getAll())) || [];
  return records
    .map(record => ({ id: record.id, name: record.name, lastModifiedDate: record.lastModifiedDate }))
    .sort((a, b) => b.lastModifiedDate - a.lastModifiedDate);
};

export const deleteBrowserProject = async (id: string) => {
  await runTransaction(PROJECTS_STORE, 'readwrite', store => store.delete(id));
  await runTransaction(AUTOSAVES_STORE, 'readwrite', store => store.delete(id));
};

/** Import a ".webvelop" file chosen by the user into the browser storage. */
export const importProjectFile = async (file: File): Promise<FileMetadata> => {
  const project = parseProject(await file.text(), file.name);
  const id = newUuid();
  await runTransaction(PROJECTS_STORE, 'readwrite', store =>
    store.put({ id, name: project.name, lastModifiedDate: Date.now(), content: JSON.stringify(project) })
  );
  return { fileIdentifier: id, name: project.name, lastModifiedDate: Date.now() };
};

// The "open" dialog of the browser version is provided by the editor (it lists
// the projects of listBrowserProjects), so this provider only stores a callback.
let chooseBrowserProjectCallback: ?() => Promise<?FileMetadata> = null;
export const setChooseBrowserProjectCallback = (callback: ?() => Promise<?FileMetadata>) => {
  chooseBrowserProjectCallback = callback;
};

export const BrowserStorageProvider: StorageProvider = {
  internalName: 'Browser',
  name: 'This browser',
  usesFileSystem: false,
  open: async (fileMetadata: FileMetadata) => {
    const record = await runTransaction(PROJECTS_STORE, 'readonly', store => store.get(fileMetadata.fileIdentifier));
    if (!record) throw new Error('This website was not found in the storage of the browser.');
    return parseProject(record.content, record.name);
  },
  chooseFileToOpen: async () => (chooseBrowserProjectCallback ? chooseBrowserProjectCallback() : null),
  save: async (project: WebsiteProject, fileMetadata: FileMetadata) => {
    await runTransaction(PROJECTS_STORE, 'readwrite', store =>
      store.put({
        id: fileMetadata.fileIdentifier,
        name: project.name,
        lastModifiedDate: Date.now(),
        content: JSON.stringify(project),
      })
    );
    await BrowserStorageProvider.deleteAutosave(fileMetadata);
    return { fileMetadata: { ...fileMetadata, name: project.name, lastModifiedDate: Date.now() }, project };
  },
  chooseSaveAsLocation: async (project: WebsiteProject) => ({
    fileIdentifier: newUuid(),
    name: project.name,
    lastModifiedDate: Date.now(),
  }),
  saveAs: async (project: WebsiteProject, newFileMetadata: FileMetadata) =>
    BrowserStorageProvider.save(project, newFileMetadata),
  getNewProjectLocation: ({ name }) => ({ fileIdentifier: newUuid(), name, lastModifiedDate: Date.now() }),
  autosave: async (project: WebsiteProject, fileMetadata: FileMetadata) => {
    await runTransaction(AUTOSAVES_STORE, 'readwrite', store =>
      store.put({ id: fileMetadata.fileIdentifier, date: Date.now(), content: JSON.stringify(project) })
    );
  },
  getAutosave: async (fileMetadata: FileMetadata) => {
    const autosave = await runTransaction(AUTOSAVES_STORE, 'readonly', store => store.get(fileMetadata.fileIdentifier));
    if (!autosave) return null;
    const record = await runTransaction(PROJECTS_STORE, 'readonly', store => store.get(fileMetadata.fileIdentifier));
    if (record && record.lastModifiedDate >= autosave.date) return null;
    return { project: parseProject(autosave.content, 'autosave'), date: autosave.date };
  },
  deleteAutosave: async (fileMetadata: FileMetadata) => {
    await runTransaction(AUTOSAVES_STORE, 'readwrite', store => store.delete(fileMetadata.fileIdentifier));
  },
  describeLocation: () => 'Stored in this browser',
};

export const getStorageProvider = (internalName: string): ?StorageProvider =>
  internalName === LocalFileStorageProvider.internalName
    ? LocalFileStorageProvider
    : internalName === BrowserStorageProvider.internalName
    ? BrowserStorageProvider
    : null;

export const getDefaultStorageProvider = (): StorageProvider =>
  fs ? LocalFileStorageProvider : BrowserStorageProvider;
