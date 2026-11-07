// @flow
// The main frame of Webvelop: title bar with the tabs of the opened editors,
// the website panel, and the management of the website project (creation,
// opening, saving, autosave, undo/redo, preview and export).
import * as React from 'react';
import './MainFrame.css';
import '../WebsiteEditor/WebsiteEditor.css';
import TabsTitlebar from './TabsTitlebar';
import { DraggableEditorTabs } from './EditorTabs/DraggableEditorTabs';
import PreferencesContext from './Preferences/PreferencesContext';
import PreferencesDialog from './Preferences/PreferencesDialog';
import UnsavedChangesContext from './UnsavedChangesContext';
import AboutDialog from './AboutDialog';
import ElectronMainMenu from './ElectronMainMenu';
import WebMainMenu from './WebMainMenu';
import { type MainMenuCallbacks } from './MainMenu';
import useAlertDialog from '../UI/Alert/useAlertDialog';
import ErrorBoundary from '../UI/ErrorBoundary';
import {
  getHistoryInitialState,
  saveToHistory,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
  type HistoryState,
} from '../Utils/History';
import { type WebsiteProject, type WebsiteAsset } from '../Website/Model/Schema';
import { createWebsiteProject } from '../Website/Model/Templates';
import { addPage } from '../Website/Model/ProjectOps';
import { buildHero } from '../Website/Elements/Presets';
import { checkProject, type BuildIssue } from '../Website/Rendering/SiteBuilder';
import { AssetUrlResolver, createAssetsFromFiles } from '../Website/Services/AssetFiles';
import { getWebvelopPaths, openFolder } from '../Website/Services/WebsiteExporter';
import {
  type FileMetadata,
  type FileMetadataAndStorageProviderName,
  type StorageProvider,
} from '../ProjectsStorage';
import {
  getStorageProvider,
  getDefaultStorageProvider,
  setChooseBrowserProjectCallback,
} from '../ProjectsStorage/WebvelopStorageProviders';
import WebsiteEditorContext, {
  type EditorTabTarget,
  type UpdateProjectOptions,
} from '../WebsiteEditor/WebsiteEditorContext';
import { PromptProvider, usePrompt } from '../WebsiteEditor/Fields/PromptDialog';
import DocumentEditor from '../WebsiteEditor/DocumentEditor/DocumentEditor';
import HomePage from '../WebsiteEditor/Home/HomePage';
import NewWebsiteDialog from '../WebsiteEditor/Home/NewWebsiteDialog';
import BrowserProjectsDialog from '../WebsiteEditor/Home/BrowserProjectsDialog';
import AppSidebar from '../WebsiteEditor/Sidebar/AppSidebar';
import PreviewDialog from '../WebsiteEditor/Preview/PreviewDialog';
import ExportDialog from '../WebsiteEditor/Export/ExportDialog';
import { PageEventsTab, SiteEventsTab } from '../WebsiteEditor/Tabs/EventsTab';
import SiteSettingsTab from '../WebsiteEditor/Tabs/SiteSettingsTab';
import AssetsTab from '../WebsiteEditor/Tabs/AssetsTab';
import {
  ReactComponentTab,
  ScriptTab,
  PageCodeTab,
  CustomActionTab,
} from '../WebsiteEditor/Code/CodeTabs';
import { ElementIcon, ReactIcon } from '../WebsiteEditor/ElementIcons';
import Dialog from '../UI/Dialog';
import FlatButton from '../UI/FlatButton';
import Home from '../UI/CustomSvgIcons/Home';
import Floppy from '../UI/CustomSvgIcons/Floppy';
import Play from '../UI/CustomSvgIcons/Play';
import Publish from '../UI/CustomSvgIcons/Publish';
import optionalRequire from '../Utils/OptionalRequire';
import Window from '../Utils/Window';
import GDevelopThemeContext from '../UI/Theme/GDevelopThemeContext';

const electron = optionalRequire('electron');
const remote = optionalRequire('@electron/remote');
const isDesktop = !!electron;

const HISTORY_MAX_SIZE = 200;

type OpenedTab = {| key: string, target: EditorTabTarget |};

type CurrentFile = {| fileMetadata: FileMetadata, storageProvider: StorageProvider |};

const getTabKey = (target: EditorTabTarget): string =>
  target.kind === 'home' || target.kind === 'site-events' || target.kind === 'site-settings' || target.kind === 'assets'
    ? target.kind
    : // $FlowFixMe[prop-missing]
      `${target.kind}-${target.id}`;

const homeTab: OpenedTab = { key: 'home', target: { kind: 'home' } };

const targetExists = (project: ?WebsiteProject, target: EditorTabTarget): boolean => {
  if (target.kind === 'home') return true;
  if (!project) return false;
  switch (target.kind) {
    case 'page':
    case 'page-events':
    case 'page-code':
      return project.pages.some(p => p.id === target.id);
    case 'component':
      return project.components.some(c => c.id === target.id);
    case 'react-component':
      return project.reactComponents.some(c => c.id === target.id);
    case 'script':
      return project.scripts.some(s => s.id === target.id);
    case 'custom-action':
      return project.customActions.some(a => a.id === target.id);
    default:
      return true;
  }
};

const getTabLabelAndIcon = (project: ?WebsiteProject, target: EditorTabTarget): {| label: string, icon: React.Node |} => {
  const find = (list: Array<any>, id: string) => list.find(item => item.id === id) || { name: '?' };
  switch (target.kind) {
    case 'home':
      return { label: '', icon: <Home fontSize="small" /> };
    case 'page':
      return { label: find(project ? project.pages : [], target.id).name, icon: <ElementIcon name="page" fontSize="small" /> };
    case 'page-events':
      return {
        label: find(project ? project.pages : [], target.id).name + ' (Interactions)',
        icon: <ElementIcon name="interactions" fontSize="small" />,
      };
    case 'page-code':
      return { label: find(project ? project.pages : [], target.id).name + ' (Code)', icon: <ElementIcon name="script" fontSize="small" /> };
    case 'component':
      return { label: find(project ? project.components : [], target.id).name, icon: <ElementIcon name="component" fontSize="small" /> };
    case 'react-component':
      return { label: find(project ? project.reactComponents : [], target.id).name + '.jsx', icon: <ReactIcon fontSize="small" /> };
    case 'script':
      return { label: find(project ? project.scripts : [], target.id).name, icon: <ElementIcon name="script" fontSize="small" /> };
    case 'custom-action': {
      const action: any = find(project ? project.customActions : [], target.id);
      return { label: action.label || action.name, icon: <ElementIcon name="customAction" fontSize="small" /> };
    }
    case 'site-events':
      return { label: 'Interactions of all pages', icon: <ElementIcon name="interactions" fontSize="small" /> };
    case 'site-settings':
      return { label: 'Website settings', icon: <ElementIcon name="settings" fontSize="small" /> };
    case 'assets':
      return { label: 'Assets', icon: <ElementIcon name="file" fontSize="small" /> };
    default:
      return { label: '', icon: null };
  }
};

const isEditableTarget = (target: any): boolean =>
  !!target &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

type Props = {|
  initialFileToOpen: ?FileMetadataAndStorageProviderName,
|};

const MainFrameContent = ({ initialFileToOpen }: Props) => {
  const preferences = React.useContext(PreferencesContext);
  const { hasUnsavedChanges, triggerUnsavedChanges, sealUnsavedChanges } = React.useContext(UnsavedChangesContext);
  const { showAlert, showConfirmation } = useAlertDialog();
  const prompt = usePrompt();

  const [history, setHistoryState] = React.useState<?HistoryState>(null);
  const historyRef = React.useRef<?HistoryState>(null);
  const setHistory = React.useCallback((newHistory: ?HistoryState) => {
    historyRef.current = newHistory;
    setHistoryState(newHistory);
  }, []);
  const project: ?WebsiteProject = history ? history.currentValue : null;

  const [currentFile, setCurrentFile] = React.useState<?CurrentFile>(null);
  const [tabs, setTabs] = React.useState<Array<OpenedTab>>([homeTab]);
  const [currentTabKey, setCurrentTabKey] = React.useState<string>('home');
  const sidebarOpen = preferences.values.sidebarOpen;
  const setSidebarOpen = (open: boolean) => preferences.setValues({ sidebarOpen: open });
  const [webMenuAnchor, setWebMenuAnchor] = React.useState<?HTMLElement>(null);
  const [newWebsiteDialog, setNewWebsiteDialog] = React.useState<?{| templateId: ?string |}>(null);
  const [preferencesOpen, setPreferencesOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [previewPageId, setPreviewPageId] = React.useState<?string>(null);
  const [problems, setProblems] = React.useState<?Array<BuildIssue>>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [browserProjectsResolver, setBrowserProjectsResolver] = React.useState<?(?FileMetadata) => void>(null);
  const assetResolver = React.useRef(new AssetUrlResolver());
  const projectFilePath =
    currentFile && currentFile.storageProvider.usesFileSystem ? currentFile.fileMetadata.fileIdentifier : null;

  // The "open" dialog of the browser storage.
  React.useEffect(() => {
    setChooseBrowserProjectCallback(
      () =>
        new Promise(resolve => {
          setBrowserProjectsResolver(() => resolve);
        })
    );
    return () => setChooseBrowserProjectCallback(null);
  }, []);

  // Project changes and history.

  const updateProject = React.useCallback(
    (updater: WebsiteProject => WebsiteProject, options?: UpdateProjectOptions = {}) => {
      const current = historyRef.current;
      if (!current) return;
      const newValue = updater(current.currentValue);
      if (!newValue || newValue === current.currentValue) return;
      setHistory(saveToHistory(current, newValue, options.type || 'EDIT', options.changeContext, options.mergeKey));
      triggerUnsavedChanges();
    },
    [setHistory, triggerUnsavedChanges]
  );

  const undo = React.useCallback(() => {
    const current = historyRef.current;
    if (!current || !canUndo(current)) return;
    setHistory(undoHistory(current));
    triggerUnsavedChanges();
  }, [setHistory, triggerUnsavedChanges]);

  const redo = React.useCallback(() => {
    const current = historyRef.current;
    if (!current || !canRedo(current)) return;
    setHistory(redoHistory(current));
    triggerUnsavedChanges();
  }, [setHistory, triggerUnsavedChanges]);

  // Tabs.

  const openTab = React.useCallback(
    (target: EditorTabTarget) => {
      if (target.kind !== 'home' && !historyRef.current) return;
      const key = getTabKey(target);
      setTabs(current => {
        const existing = current.find(tab => tab.key === key);
        if (existing) return current.map(tab => (tab.key === key ? { key, target } : tab));
        return [...current, { key, target }];
      });
      setCurrentTabKey(key);
    },
    []
  );

  const closeTab = React.useCallback((key: string) => {
    if (key === 'home') return;
    setTabs(current => {
      const index = current.findIndex(tab => tab.key === key);
      const newTabs = current.filter(tab => tab.key !== key);
      setCurrentTabKey(currentKey =>
        currentKey === key ? (newTabs[Math.max(0, index - 1)] || homeTab).key : currentKey
      );
      return newTabs;
    });
  }, []);

  // Close the tabs of deleted pages, components...
  React.useEffect(
    () => {
      if (tabs.some(tab => !targetExists(project, tab.target))) {
        const remaining = tabs.filter(tab => targetExists(project, tab.target));
        setTabs(remaining);
        if (!remaining.some(tab => tab.key === currentTabKey)) setCurrentTabKey(remaining[remaining.length - 1].key);
      }
    },
    [project, tabs, currentTabKey]
  );

  // Assets.

  const resolveAssetUrl = React.useCallback(
    (assetId: string) => {
      const current = historyRef.current;
      return current ? assetResolver.current.resolve(current.currentValue, assetId, projectFilePath) : '';
    },
    // Recreated when the assets change, so that editors re-render them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project ? project.assets : null, projectFilePath]
  );

  const importAssets = React.useCallback(
    async (files: Array<File>): Promise<Array<WebsiteAsset>> => {
      const current = historyRef.current;
      if (!current) return [];
      try {
        const assets = await createAssetsFromFiles(current.currentValue, files, projectFilePath);
        updateProject(currentProject => ({ ...currentProject, assets: [...currentProject.assets, ...assets] }), { type: 'ADD' });
        return assets;
      } catch (error) {
        console.error('Unable to import the files:', error);
        showAlert({ title: 'Unable to import the files', message: error.message || String(error) });
        return [];
      }
    },
    [projectFilePath, updateProject, showAlert]
  );

  // Opening, creating, saving and closing.

  const loadProject = React.useCallback(
    (newProject: WebsiteProject, file: ?CurrentFile) => {
      assetResolver.current.invalidate();
      setHistory(getHistoryInitialState(newProject, { historyMaxSize: HISTORY_MAX_SIZE }));
      setCurrentFile(file);
      const homePage = newProject.pages.find(p => p.id === newProject.settings.homePageId) || newProject.pages[0];
      const firstTab = homePage ? { key: 'page-' + homePage.id, target: { kind: 'page', id: homePage.id } } : null;
      setTabs(firstTab ? [homeTab, firstTab] : [homeTab]);
      setCurrentTabKey(firstTab ? firstTab.key : 'home');
      if (file) {
        preferences.insertRecentProjectFile({
          fileMetadata: { ...file.fileMetadata, name: newProject.name, lastModifiedDate: Date.now() },
          storageProviderName: file.storageProvider.internalName,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setHistory]
  );

  const confirmCloseUnsaved = React.useCallback(
    async (): Promise<boolean> => {
      if (!historyRef.current || !hasUnsavedChanges) return true;
      return showConfirmation({
        title: 'Unsaved changes',
        message: 'The website has unsaved changes. Do you want to continue and lose them?',
        confirmButtonLabel: 'Continue without saving',
        dismissButtonLabel: 'Cancel',
        level: 'warning',
      });
    },
    [hasUnsavedChanges, showConfirmation]
  );

  const openFile = React.useCallback(
    async (fileMetadata: FileMetadata, storageProvider: StorageProvider, { skipConfirmation }: {| skipConfirmation?: boolean |} = {}) => {
      if (!skipConfirmation && !(await confirmCloseUnsaved())) return;
      try {
        let openedProject = await storageProvider.open(fileMetadata);
        const autosave = await storageProvider.getAutosave(fileMetadata);
        if (autosave) {
          const restore = await showConfirmation({
            title: 'Restore the autosave?',
            message: `An autosave of this website, more recent than the saved version, was found (${new Date(
              autosave.date
            ).toLocaleString()}). Do you want to restore it? Otherwise, the saved version is opened.`,
            confirmButtonLabel: 'Restore the autosave',
            dismissButtonLabel: 'Open the saved version',
          });
          if (restore) openedProject = autosave.project;
        }
        loadProject(openedProject, { fileMetadata, storageProvider });
        if (autosave) triggerUnsavedChanges();
        else sealUnsavedChanges();
      } catch (error) {
        console.error('Unable to open the website:', error);
        showAlert({
          title: 'Unable to open the website',
          message: `${error.message || String(error)}`,
        });
        preferences.removeRecentProjectFile({
          fileMetadata,
          storageProviderName: storageProvider.internalName,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmCloseUnsaved, loadProject, showAlert, showConfirmation, sealUnsavedChanges, triggerUnsavedChanges]
  );

  const chooseAndOpen = React.useCallback(
    async () => {
      const storageProvider = getDefaultStorageProvider();
      const fileMetadata = await storageProvider.chooseFileToOpen();
      if (fileMetadata) openFile(fileMetadata, storageProvider);
    },
    [openFile]
  );

  const openRecent = React.useCallback(
    (item: FileMetadataAndStorageProviderName) => {
      const storageProvider = getStorageProvider(item.storageProviderName);
      if (storageProvider) openFile(item.fileMetadata, storageProvider);
    },
    [openFile]
  );

  const saveProjectTo = React.useCallback(
    async (file: CurrentFile, saveAsFrom: ?FileMetadata) => {
      const current = historyRef.current;
      if (!current) return false;
      setIsSaving(true);
      try {
        const result = saveAsFrom !== undefined
          ? await file.storageProvider.saveAs(current.currentValue, file.fileMetadata, saveAsFrom)
          : await file.storageProvider.save(current.currentValue, file.fileMetadata);
        // Saving can change the project (assets written in the project folder):
        // keep the history, but use the saved project as the current value.
        if (result.project !== current.currentValue && historyRef.current) {
          setHistory({ ...historyRef.current, currentValue: result.project });
          assetResolver.current.invalidate();
        }
        setCurrentFile({ fileMetadata: result.fileMetadata, storageProvider: file.storageProvider });
        preferences.insertRecentProjectFile({
          fileMetadata: result.fileMetadata,
          storageProviderName: file.storageProvider.internalName,
        });
        sealUnsavedChanges();
        return true;
      } catch (error) {
        console.error('Unable to save the website:', error);
        showAlert({ title: 'Unable to save the website', message: error.message || String(error) });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setHistory, sealUnsavedChanges, showAlert]
  );

  const saveAs = React.useCallback(
    async () => {
      const current = historyRef.current;
      if (!current) return;
      const storageProvider = currentFile ? currentFile.storageProvider : getDefaultStorageProvider();
      const newFileMetadata = await storageProvider.chooseSaveAsLocation(
        current.currentValue,
        currentFile ? currentFile.fileMetadata : null
      );
      if (!newFileMetadata) return;
      await saveProjectTo({ fileMetadata: newFileMetadata, storageProvider }, currentFile ? currentFile.fileMetadata : null);
    },
    [currentFile, saveProjectTo]
  );

  const save = React.useCallback(
    async () => {
      if (!historyRef.current) return;
      if (!currentFile) return saveAs();
      await saveProjectTo(currentFile);
    },
    [currentFile, saveAs, saveProjectTo]
  );

  const createWebsite = React.useCallback(
    async ({ name, templateId, folder }: {| name: string, templateId: string, folder: ?string |}) => {
      setNewWebsiteDialog(null);
      if (!(await confirmCloseUnsaved())) return;
      const newProject = createWebsiteProject({ name, templateId });
      const storageProvider = getDefaultStorageProvider();
      const fileMetadata = storageProvider.getNewProjectLocation({ name, folder });
      try {
        const result = await storageProvider.save(newProject, fileMetadata);
        loadProject(result.project, { fileMetadata: result.fileMetadata, storageProvider });
        sealUnsavedChanges();
      } catch (error) {
        console.error('Unable to create the website:', error);
        showAlert({ title: 'Unable to create the website', message: error.message || String(error) });
      }
    },
    [confirmCloseUnsaved, loadProject, sealUnsavedChanges, showAlert]
  );

  const closeProject = React.useCallback(
    async () => {
      if (!historyRef.current) return;
      if (!(await confirmCloseUnsaved())) return;
      setHistory(null);
      setCurrentFile(null);
      setTabs([homeTab]);
      setCurrentTabKey('home');
      sealUnsavedChanges();
    },
    [confirmCloseUnsaved, setHistory, sealUnsavedChanges]
  );

  const addPageWithPrompt = React.useCallback(
    async () => {
      if (!historyRef.current) return;
      const name = await prompt({ title: 'New page', label: 'Name of the page', defaultValue: 'New page' });
      if (!name) return;
      let pageId = null;
      updateProject(current => {
        const result = addPage(current, name, buildHero().elements);
        pageId = result.page.id;
        return result.project;
      }, { type: 'ADD' });
      if (pageId) openTab({ kind: 'page', id: pageId });
    },
    [prompt, updateProject, openTab]
  );

  const openProblems = React.useCallback(() => {
    if (historyRef.current) setProblems(checkProject(historyRef.current.currentValue));
  }, []);

  const openIssueLocation = React.useCallback(
    (issue: BuildIssue) => {
      const location = issue.location;
      if (!location) return;
      setProblems(null);
      setExportOpen(false);
      const kindToTarget = {
        page: { kind: 'page', id: location.id },
        'page-events': { kind: 'page-events', id: location.id },
        'page-script': { kind: 'page-code', id: location.id },
        component: { kind: 'component', id: location.id },
        'react-component': { kind: 'react-component', id: location.id },
        script: { kind: 'script', id: location.id },
        'custom-action': { kind: 'custom-action', id: location.id },
        'site-events': { kind: 'site-events' },
      };
      const target = kindToTarget[location.kind];
      if (target) openTab((target: any));
    },
    [openTab]
  );

  const currentTab = tabs.find(tab => tab.key === currentTabKey) || homeTab;
  const openPreview = React.useCallback(
    (pageId?: string) => {
      const current = historyRef.current;
      if (!current) return;
      const target: any = currentTab.target;
      const fromTab = target.kind === 'page' || target.kind === 'page-events' || target.kind === 'page-code' ? target.id : null;
      setPreviewPageId(pageId || fromTab || current.currentValue.settings.homePageId || current.currentValue.pages[0].id);
    },
    [currentTab]
  );

  // Edit commands from the menu: applied to the focused text field, or to the active visual editor.
  const runEditCommand = React.useCallback((command: 'cut' | 'copy' | 'paste' | 'duplicate' | 'delete') => {
    const active: any = document.activeElement;
    if (isEditableTarget(active) && (command === 'cut' || command === 'copy' || command === 'paste')) {
      if (command === 'paste' && navigator.clipboard) {
        navigator.clipboard.readText().then(text => document.execCommand('insertText', false, text));
      } else document.execCommand(command);
      return;
    }
    const editor = document.querySelector('[data-active-document-editor="true"] .wve-editor');
    if (!editor) return;
    const keys = { cut: 'x', copy: 'c', paste: 'v', duplicate: 'd', delete: 'Delete' };
    editor.dispatchEvent(
      new KeyboardEvent('keydown', { key: keys[command], ctrlKey: command !== 'delete', bubbles: true, cancelable: true })
    );
  }, []);

  const menuCallbacks: MainMenuCallbacks = {
    'new-website': () => setNewWebsiteDialog({ templateId: null }),
    open: chooseAndOpen,
    'open-recent': openRecent,
    save,
    'save-as': saveAs,
    export: () => historyRef.current && setExportOpen(true),
    preview: () => openPreview(),
    'close-website': closeProject,
    preferences: () => setPreferencesOpen(true),
    quit: () => remote && remote.getCurrentWindow().close(),
    undo: () => {
      if (isEditableTarget(document.activeElement)) document.execCommand('undo');
      else undo();
    },
    redo: () => {
      if (isEditableTarget(document.activeElement)) document.execCommand('redo');
      else redo();
    },
    cut: () => runEditCommand('cut'),
    copy: () => runEditCommand('copy'),
    paste: () => runEditCommand('paste'),
    duplicate: () => runEditCommand('duplicate'),
    delete: () => runEditCommand('delete'),
    'open-site-panel': () => setSidebarOpen(true),
    'add-page': addPageWithPrompt,
    'site-settings': () => openTab({ kind: 'site-settings' }),
    assets: () => openTab({ kind: 'assets' }),
    'site-events': () => openTab({ kind: 'site-events' }),
    'check-problems': openProblems,
    home: () => openTab({ kind: 'home' }),
    about: () => setAboutOpen(true),
    'open-data-folder': () => {
      const paths = getWebvelopPaths();
      if (paths) openFolder(paths.dataDir);
    },
  };
  const menuCallbacksRef = React.useRef(menuCallbacks);
  menuCallbacksRef.current = menuCallbacks;

  // Keyboard shortcuts.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const callbacks = menuCallbacksRef.current;
      if (ctrl && !isEditableTarget(event.target) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        callbacks.undo();
        return;
      }
      if (ctrl && !isEditableTarget(event.target) && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        callbacks.redo();
        return;
      }
      // On the desktop app, the other shortcuts are handled by the native menu.
      if (isDesktop) return;
      let action = null;
      if (ctrl && key === 's') action = event.shiftKey ? 'save-as' : 'save';
      else if (ctrl && key === 'o') action = 'open';
      else if (ctrl && key === 'e') action = 'export';
      else if (event.key === 'F5') action = 'preview';
      if (action) {
        event.preventDefault();
        callbacks[action]();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Window title, and colors of the window controls (following the theme).
  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const windowBackgroundColor = gdevelopTheme.surface.window.backgroundColor;
  React.useEffect(
    () => {
      const title = project ? `${hasUnsavedChanges ? '• ' : ''}${project.name} — Webvelop` : 'Webvelop';
      document.title = title;
      Window.setTitle(title);
      Window.setWindowBackgroundColor(windowBackgroundColor);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project ? project.name : null, hasUnsavedChanges, windowBackgroundColor]
  );

  // Warn before leaving with unsaved changes (the desktop app shows a dialog).
  React.useEffect(
    () => {
      const onBeforeUnload = (event: any) => {
        if (historyRef.current && hasUnsavedChanges) {
          event.preventDefault();
          event.returnValue = '';
          return '';
        }
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    },
    [hasUnsavedChanges]
  );

  // Autosave, used to recover the work after a crash.
  React.useEffect(
    () => {
      const minutes = preferences.values.autosaveEveryMinutes;
      if (!minutes || !currentFile) return;
      const interval = setInterval(() => {
        const current = historyRef.current;
        if (!current || !hasUnsavedChanges) return;
        currentFile.storageProvider
          .autosave(current.currentValue, currentFile.fileMetadata)
          .catch(error => console.warn('Autosave failed:', error));
      }, minutes * 60 * 1000);
      return () => clearInterval(interval);
    },
    [preferences.values.autosaveEveryMinutes, currentFile, hasUnsavedChanges]
  );

  // Open a website at startup (given as argument, or the last one).
  React.useEffect(() => {
    if (initialFileToOpen) {
      const storageProvider = getStorageProvider(initialFileToOpen.storageProviderName);
      if (storageProvider) openFile(initialFileToOpen.fileMetadata, storageProvider, { skipConfirmation: true });
    } else if (preferences.values.openLastProjectAtStartup && preferences.values.recentProjectFiles[0]) {
      const recent = preferences.values.recentProjectFiles[0];
      const storageProvider = getStorageProvider(recent.storageProviderName);
      if (storageProvider) openFile(recent.fileMetadata, storageProvider, { skipConfirmation: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasSettings = React.useMemo(
    () => ({
      showOutlines: preferences.values.canvasShowOutlines,
      showHiddenElements: preferences.values.canvasShowHiddenElements,
    }),
    [preferences.values.canvasShowOutlines, preferences.values.canvasShowHiddenElements]
  );
  const setCanvasSettings = React.useCallback(
    (settings: {| showOutlines: boolean, showHiddenElements: boolean |}) =>
      preferences.setValues({
        canvasShowOutlines: settings.showOutlines,
        canvasShowHiddenElements: settings.showHiddenElements,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editorContext = React.useMemo(
    () =>
      project
        ? {
            project,
            projectFilePath,
            updateProject,
            resolveAssetUrl,
            importAssets,
            openTab,
            openPreview,
            canvasSettings,
            setCanvasSettings,
            undo,
            redo,
            canUndo: !!history && canUndo(history),
            canRedo: !!history && canRedo(history),
          }
        : null,
    [project, projectFilePath, updateProject, resolveAssetUrl, importAssets, openTab, openPreview, canvasSettings, setCanvasSettings, undo, redo, history]
  );

  // Tabs shown in the title bar.
  // With no website opened, the start page is the only content: no tabs are shown.
  const editorTabs = (project ? tabs : []).map(tab => {
    const { label, icon } = getTabLabelAndIcon(project, tab.target);
    return { key: tab.key, id: tab.key, label, icon, closable: tab.key !== 'home', kind: tab.target.kind, tabOptions: null };
  });
  const currentEditorTab = editorTabs.find(tab => tab.key === currentTabKey) || editorTabs[0] || null;

  const renderTabContent = (tab: OpenedTab, isActive: boolean): React.Node => {
    const target: any = tab.target;
    switch (target.kind) {
      case 'home':
        return (
          <HomePage
            recentProjects={preferences.values.recentProjectFiles}
            hasOpenedProject={!!project}
            projectName={project ? project.name : null}
            onCreate={templateId => setNewWebsiteDialog({ templateId })}
            onOpen={chooseAndOpen}
            onOpenRecent={openRecent}
            onRemoveRecent={preferences.removeRecentProjectFile}
            onContinue={() => {
              const lastTab = tabs.filter(t => t.key !== 'home').pop();
              if (lastTab) setCurrentTabKey(lastTab.key);
              else if (project && project.pages[0]) openTab({ kind: 'page', id: project.pages[0].id });
            }}
          />
        );
      case 'page':
      case 'component':
        return (
          <DocumentEditor
            docRef={{ kind: target.kind, id: target.id }}
            isActive={isActive}
            initialSelectedElementId={target.elementId}
          />
        );
      case 'page-events':
        return <PageEventsTab pageId={target.id} highlightedEventId={target.eventId} />;
      case 'page-code':
        return <PageCodeTab pageId={target.id} />;
      case 'react-component':
        return <ReactComponentTab componentId={target.id} />;
      case 'script':
        return <ScriptTab scriptId={target.id} />;
      case 'custom-action':
        return <CustomActionTab customActionId={target.id} />;
      case 'site-events':
        return <SiteEventsTab />;
      case 'site-settings':
        return <SiteSettingsTab initialSection={target.section} />;
      case 'assets':
        return <AssetsTab />;
      default:
        return null;
    }
  };

  const titlebarButton = (
    label: string,
    icon: React.Node,
    onClick: () => void,
    title: string,
    disabled?: boolean,
    variant?: 'primary'
  ) => (
    <button
      className={`wve-titlebar-button ${variant === 'primary' ? 'wve-titlebar-button-primary' : ''}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const content = (
    <div className="main-frame" style={{ background: 'var(--theme-surface-window-background-color)' }}>
      {isDesktop && (
        <ElectronMainMenu
          hasProject={!!project}
          recentProjectFiles={preferences.values.recentProjectFiles}
          callbacks={menuCallbacks}
        />
      )}
      <TabsTitlebar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        renderTabs={() => (
          <DraggableEditorTabs
            editors={(editorTabs: any)}
            currentTab={(currentEditorTab: any)}
            onClickTab={index => setCurrentTabKey(tabs[index].key)}
            onCloseTab={tab => closeTab(tab.key)}
            onCloseOtherTabs={tab => {
              setTabs(current => current.filter(t => t.key === 'home' || t.key === tab.key));
              setCurrentTabKey(tab.key);
            }}
            onCloseAll={() => {
              setTabs([homeTab]);
              setCurrentTabKey('home');
            }}
            onTabActivated={() => {}}
            onDropTab={(fromIndex, toIndex) =>
              setTabs(current => {
                if (fromIndex === 0 || toIndex === 0) return current;
                const copy = [...current];
                const [moved] = copy.splice(fromIndex, 1);
                copy.splice(toIndex, 0, moved);
                return copy;
              })
            }
            onHoverTab={() => {}}
          />
        )}
        rightContent={
          <>
            {!isDesktop &&
              titlebarButton('Menu', null, () => setWebMenuAnchor(document.getElementById('main-menu-button')), 'Menu')}
            {project &&
              titlebarButton(
                isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save •' : 'Saved',
                <Floppy />,
                save,
                'Save the website (Ctrl+S)',
                isSaving
              )}
            {project && titlebarButton('Preview', <Play />, () => openPreview(), 'Preview the website (F5)')}
            {project &&
              titlebarButton('Export', <Publish />, () => setExportOpen(true), 'Export the website (Ctrl+E)', false, 'primary')}
          </>
        }
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
        {sidebarOpen && (
          <AppSidebar
            projectName={project ? project.name : null}
            projectLocation={currentFile ? currentFile.storageProvider.describeLocation(currentFile.fileMetadata) : null}
            hasUnsavedChanges={hasUnsavedChanges}
            currentTabKey={currentTabKey}
            recentProjects={preferences.values.recentProjectFiles}
            onHome={() => openTab({ kind: 'home' })}
            onNewWebsite={() => setNewWebsiteDialog({ templateId: null })}
            onOpen={chooseAndOpen}
            onOpenRecent={openRecent}
            onSave={save}
            onCloseProject={closeProject}
            onPreferences={() => setPreferencesOpen(true)}
            onAbout={() => setAboutOpen(true)}
          />
        )}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0, position: 'relative' }}>
        {(project ? tabs : [homeTab]).map(tab => {
          const isActive = project ? tab.key === currentTabKey : true;
          return (
            <div
              key={tab.key}
              data-active-document-editor={isActive && (tab.target.kind === 'page' || tab.target.kind === 'component') ? 'true' : 'false'}
              style={{ display: isActive ? 'flex' : 'none', flex: 1, minWidth: 0, minHeight: 0 }}
            >
              <ErrorBoundary componentTitle={getTabLabelAndIcon(project, tab.target).label || 'Start page'} scope="webvelop-editor">
                {renderTabContent(tab, isActive)}
              </ErrorBoundary>
            </div>
          );
        })}
      </div>
      </div>
      {!isDesktop && (
        <WebMainMenu
          anchorEl={webMenuAnchor}
          onClose={() => setWebMenuAnchor(null)}
          hasProject={!!project}
          recentProjectFiles={preferences.values.recentProjectFiles}
          callbacks={menuCallbacks}
        />
      )}
      {newWebsiteDialog && (
        <NewWebsiteDialog
          initialTemplateId={newWebsiteDialog.templateId}
          onClose={() => setNewWebsiteDialog(null)}
          onCreate={createWebsite}
        />
      )}
      {browserProjectsResolver && (
        <BrowserProjectsDialog
          onChoose={fileMetadata => {
            browserProjectsResolver(fileMetadata);
            setBrowserProjectsResolver(null);
          }}
        />
      )}
      {preferencesOpen && <PreferencesDialog onClose={() => setPreferencesOpen(false)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {project && previewPageId && <PreviewDialog initialPageId={previewPageId} onClose={() => setPreviewPageId(null)} />}
      {project && exportOpen && <ExportDialog onClose={() => setExportOpen(false)} onOpenProblem={openIssueLocation} />}
      {problems && (
        <Dialog
          open
          title="Problems of the website"
          maxWidth="md"
          onRequestClose={() => setProblems(null)}
          actions={[<FlatButton key="close" label="Close" onClick={() => setProblems(null)} />]}
        >
          {problems.length === 0 ? (
            <div className="wve-status-ok">✔ No problem found.</div>
          ) : (
            <div className="wve-problems" style={{ maxHeight: 'none' }}>
              {problems.map((issue, index) => (
                <div
                  key={index}
                  className={`wve-problem ${issue.severity === 'error' ? 'wve-error' : 'wve-warning'}`}
                  onClick={() => openIssueLocation(issue)}
                >
                  <span>{issue.source}</span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );

  return editorContext ? (
    <WebsiteEditorContext.Provider value={(editorContext: any)}>{content}</WebsiteEditorContext.Provider>
  ) : (
    content
  );
};

const MainFrame = (props: Props): React.Node => (
  <PromptProvider>
    <MainFrameContent {...props} />
  </PromptProvider>
);

export default MainFrame;
