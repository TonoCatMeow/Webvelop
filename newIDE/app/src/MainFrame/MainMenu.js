// @flow
// The main menu of Webvelop, described with a declarative template so that it
// can be used both as the native menu of the desktop app (Electron) and as a
// menu in the web version.
import { type FileMetadataAndStorageProviderName } from '../ProjectsStorage';
import { isMacLike } from '../Utils/Platform';

export const MAIN_MENU_IPC_CHANNEL = 'webvelop-main-menu';

export type MainMenuAction =
  | 'new-website'
  | 'open'
  | 'open-recent'
  | 'save'
  | 'save-as'
  | 'export'
  | 'preview'
  | 'close-website'
  | 'preferences'
  | 'quit'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'delete'
  | 'open-site-panel'
  | 'add-page'
  | 'site-settings'
  | 'assets'
  | 'site-events'
  | 'check-problems'
  | 'home'
  | 'about'
  | 'open-data-folder';

export type MainMenuCallbacks = { [MainMenuAction]: (args?: any) => void };

export type MenuDeclarativeItem = {|
  label?: string,
  type?: 'separator' | 'normal',
  role?: string,
  accelerator?: string,
  registerAccelerator?: boolean,
  enabled?: boolean,
  onClickSendEvent?: string,
  eventArgs?: any,
  submenu?: Array<MenuDeclarativeItem>,
|};

const item = (
  label: string,
  action: MainMenuAction,
  {
    accelerator,
    enabled = true,
    registerAccelerator = true,
    args,
  }: {| accelerator?: string, enabled?: boolean, registerAccelerator?: boolean, args?: any |} = {}
): MenuDeclarativeItem => ({
  label,
  accelerator,
  enabled,
  registerAccelerator,
  onClickSendEvent: MAIN_MENU_IPC_CHANNEL,
  eventArgs: args !== undefined ? { action, args } : { action },
});

const separator: MenuDeclarativeItem = { type: 'separator' };

export const buildMainMenuTemplate = ({
  hasProject,
  recentProjectFiles,
  isDesktop,
}: {|
  hasProject: boolean,
  recentProjectFiles: Array<FileMetadataAndStorageProviderName>,
  isDesktop: boolean,
|}): Array<MenuDeclarativeItem> => {
  const isMac = isMacLike();
  const fileMenu: MenuDeclarativeItem = {
    label: 'File',
    submenu: [
      item('New website...', 'new-website', { accelerator: 'CmdOrCtrl+N' }),
      item('Open...', 'open', { accelerator: 'CmdOrCtrl+O' }),
      {
        label: 'Open recent',
        enabled: recentProjectFiles.length > 0,
        submenu: recentProjectFiles.length
          ? recentProjectFiles.map(recent =>
              item(recent.fileMetadata.name || recent.fileMetadata.fileIdentifier, 'open-recent', { args: recent })
            )
          : [{ label: 'No recent website', enabled: false }],
      },
      separator,
      item('Save', 'save', { accelerator: 'CmdOrCtrl+S', enabled: hasProject }),
      item('Save as...', 'save-as', { accelerator: 'CmdOrCtrl+Shift+S', enabled: hasProject }),
      separator,
      item('Preview', 'preview', { accelerator: 'F5', enabled: hasProject }),
      item('Export...', 'export', { accelerator: 'CmdOrCtrl+E', enabled: hasProject }),
      separator,
      item('Close the website', 'close-website', { accelerator: 'CmdOrCtrl+Shift+W', enabled: hasProject }),
      ...(isMac ? [] : [separator, item('Preferences', 'preferences', { accelerator: 'CmdOrCtrl+,' })]),
      ...(isDesktop && !isMac ? [separator, { label: 'Exit', role: 'quit' }] : []),
    ],
  };
  const editMenu: MenuDeclarativeItem = {
    label: 'Edit',
    submenu: [
      // These shortcuts are handled by the editors (text fields keep their own
      // undo/copy/paste), so they are not registered as global accelerators.
      item('Undo', 'undo', { accelerator: 'CmdOrCtrl+Z', registerAccelerator: false, enabled: hasProject }),
      item('Redo', 'redo', { accelerator: 'CmdOrCtrl+Y', registerAccelerator: false, enabled: hasProject }),
      separator,
      item('Cut', 'cut', { accelerator: 'CmdOrCtrl+X', registerAccelerator: false }),
      item('Copy', 'copy', { accelerator: 'CmdOrCtrl+C', registerAccelerator: false }),
      item('Paste', 'paste', { accelerator: 'CmdOrCtrl+V', registerAccelerator: false }),
      item('Duplicate', 'duplicate', { accelerator: 'CmdOrCtrl+D', registerAccelerator: false, enabled: hasProject }),
      item('Delete', 'delete', { accelerator: 'Delete', registerAccelerator: false, enabled: hasProject }),
      ...(isDesktop ? [separator, { label: 'Select all', role: 'selectAll' }] : []),
    ],
  };
  const websiteMenu: MenuDeclarativeItem = {
    label: 'Website',
    submenu: [
      item('Website panel', 'open-site-panel', { accelerator: 'CmdOrCtrl+Shift+P', enabled: hasProject }),
      item('Add a page...', 'add-page', { enabled: hasProject }),
      separator,
      item('Website settings', 'site-settings', { enabled: hasProject }),
      item('Assets', 'assets', { enabled: hasProject }),
      item('Interactions of all pages', 'site-events', { enabled: hasProject }),
      separator,
      item('Check for problems', 'check-problems', { enabled: hasProject }),
    ],
  };
  const viewMenu: MenuDeclarativeItem = {
    label: 'View',
    submenu: [
      item('Start page', 'home'),
      ...(isDesktop
        ? [
            separator,
            { label: 'Zoom in', role: 'zoomIn' },
            { label: 'Zoom out', role: 'zoomOut' },
            { label: 'Reset zoom', role: 'resetZoom' },
            separator,
            { label: 'Full screen', role: 'togglefullscreen' },
            { label: 'Developer tools', role: 'toggleDevTools' },
          ]
        : []),
    ],
  };
  const helpMenu: MenuDeclarativeItem = {
    label: 'Help',
    submenu: [
      ...(isDesktop ? [item('Open the data folder of Webvelop', 'open-data-folder')] : []),
      item('About Webvelop', 'about'),
    ],
  };
  const menus = [fileMenu, editMenu, websiteMenu, viewMenu, helpMenu];
  if (isMac && isDesktop) {
    menus.unshift({
      label: 'Webvelop',
      submenu: [
        item('About Webvelop', 'about'),
        separator,
        item('Preferences', 'preferences', { accelerator: 'CmdOrCtrl+,' }),
        separator,
        { label: 'Hide Webvelop', role: 'hide' },
        { label: 'Hide others', role: 'hideOthers' },
        separator,
        { label: 'Quit Webvelop', role: 'quit' },
      ],
    });
  }
  return menus;
};
