// @flow
import * as React from 'react';
import { type FileMetadataAndStorageProviderName } from '../../ProjectsStorage';

export type AlertMessageIdentifier = string;

export type PreferencesValues = {|
  language: string,
  themeName: string,
  codeEditorThemeName: string,
  codeEditorFontSize: number,
  showJsTypeError: boolean,
  /** Autosave the opened website every N minutes (0 to disable). */
  autosaveEveryMinutes: number,
  openLastProjectAtStartup: boolean,
  recentProjectFiles: Array<FileMetadataAndStorageProviderName>,
  hiddenAlertMessages: { [AlertMessageIdentifier]: boolean },
  backdropClickBehavior: 'nothing' | 'apply' | 'cancel',
  canvasShowOutlines: boolean,
  canvasShowHiddenElements: boolean,
  /** Whether the sidebar (navigation and website panel) is shown. */
  sidebarOpen: boolean,
  userShortcutMap: { [string]: string },
|};

export type Preferences = {|
  values: PreferencesValues,
  setValues: ($Shape<PreferencesValues>) => void,
  getRecentProjectFiles: () => Array<FileMetadataAndStorageProviderName>,
  insertRecentProjectFile: (item: FileMetadataAndStorageProviderName) => void,
  removeRecentProjectFile: (item: FileMetadataAndStorageProviderName) => void,
  showAlertMessage: (identifier: AlertMessageIdentifier, show: boolean) => void,
  resetHiddenAlertMessages: () => void,
|};

export const initialPreferences: Preferences = {
  values: {
    language: 'en',
    themeName: 'Webvelop Dark',
    codeEditorThemeName: 'vs-dark',
    codeEditorFontSize: 14,
    showJsTypeError: false,
    autosaveEveryMinutes: 2,
    openLastProjectAtStartup: false,
    recentProjectFiles: [],
    hiddenAlertMessages: {},
    backdropClickBehavior: 'nothing',
    canvasShowOutlines: false,
    canvasShowHiddenElements: false,
    sidebarOpen: true,
    userShortcutMap: {},
  },
  setValues: () => {},
  getRecentProjectFiles: () => [],
  insertRecentProjectFile: () => {},
  removeRecentProjectFile: () => {},
  showAlertMessage: () => {},
  resetHiddenAlertMessages: () => {},
};

const PreferencesContext: React.Context<Preferences> = React.createContext(
  initialPreferences
);

export default PreferencesContext;
