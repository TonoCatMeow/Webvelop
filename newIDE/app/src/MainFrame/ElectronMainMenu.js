// @flow
import * as React from 'react';
import optionalRequire from '../Utils/OptionalRequire';
import {
  buildMainMenuTemplate,
  MAIN_MENU_IPC_CHANNEL,
  type MainMenuCallbacks,
} from './MainMenu';
import { type FileMetadataAndStorageProviderName } from '../ProjectsStorage';

const electron = optionalRequire('electron');
const ipcRenderer = electron ? electron.ipcRenderer : null;

type Props = {|
  hasProject: boolean,
  recentProjectFiles: Array<FileMetadataAndStorageProviderName>,
  callbacks: MainMenuCallbacks,
|};

/**
 * Create and update the native main menu of the desktop app, and route its
 * items to the editor.
 */
const ElectronMainMenu = ({ hasProject, recentProjectFiles, callbacks }: Props): null => {
  const callbacksRef = React.useRef(callbacks);
  callbacksRef.current = callbacks;

  React.useEffect(() => {
    if (!ipcRenderer) return;
    const handler = (event, payload) => {
      if (!payload || !payload.action) return;
      const callback = callbacksRef.current[payload.action];
      if (callback) callback(payload.args);
    };
    ipcRenderer.on(MAIN_MENU_IPC_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(MAIN_MENU_IPC_CHANNEL, handler);
    };
  }, []);

  React.useEffect(
    () => {
      if (!ipcRenderer) return;
      ipcRenderer.send(
        'set-main-menu',
        buildMainMenuTemplate({ hasProject, recentProjectFiles, isDesktop: true })
      );
    },
    [hasProject, recentProjectFiles]
  );

  return null;
};

export default ElectronMainMenu;
