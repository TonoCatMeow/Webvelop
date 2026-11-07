// @flow
// The main menu, for the web version (shown from a button of the title bar).
import * as React from 'react';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ListSubheader from '@material-ui/core/ListSubheader';
import Divider from '@material-ui/core/Divider';
import { buildMainMenuTemplate, type MainMenuCallbacks, type MenuDeclarativeItem } from './MainMenu';
import { type FileMetadataAndStorageProviderName } from '../ProjectsStorage';

type Props = {|
  anchorEl: ?HTMLElement,
  onClose: () => void,
  hasProject: boolean,
  recentProjectFiles: Array<FileMetadataAndStorageProviderName>,
  callbacks: MainMenuCallbacks,
|};

const WebMainMenu = ({ anchorEl, onClose, hasProject, recentProjectFiles, callbacks }: Props): React.Node => {
  const template = buildMainMenuTemplate({ hasProject, recentProjectFiles: [], isDesktop: false });
  const renderItems = (items: Array<MenuDeclarativeItem>, prefix: string) =>
    items.map((menuItem, index) => {
      if (menuItem.type === 'separator') return <Divider key={prefix + index} />;
      if (menuItem.submenu) return null;
      const payload = menuItem.eventArgs;
      return (
        <MenuItem
          key={prefix + index}
          dense
          disabled={menuItem.enabled === false}
          onClick={() => {
            onClose();
            if (payload && callbacks[payload.action]) callbacks[payload.action](payload.args);
          }}
        >
          <span style={{ flex: 1 }}>{menuItem.label}</span>
          {menuItem.accelerator && (
            <span style={{ marginLeft: 24, opacity: 0.6, fontSize: 12 }}>
              {menuItem.accelerator.replace('CmdOrCtrl', 'Ctrl')}
            </span>
          )}
        </MenuItem>
      );
    });
  return (
    <Menu open={!!anchorEl} anchorEl={anchorEl} onClose={onClose}>
      {template.map((group, groupIndex) => [
        <ListSubheader key={'header' + groupIndex} style={{ lineHeight: '32px' }}>
          {group.label}
        </ListSubheader>,
        ...renderItems(group.submenu || [], groupIndex + '-'),
      ])}
      {recentProjectFiles.length > 0 && <ListSubheader style={{ lineHeight: '32px' }}>Recent websites</ListSubheader>}
      {recentProjectFiles.slice(0, 5).map(recent => (
        <MenuItem
          key={recent.fileMetadata.fileIdentifier}
          dense
          onClick={() => {
            onClose();
            callbacks['open-recent'](recent);
          }}
        >
          {recent.fileMetadata.name || recent.fileMetadata.fileIdentifier}
        </MenuItem>
      ))}
    </Menu>
  );
};

export default WebMainMenu;
