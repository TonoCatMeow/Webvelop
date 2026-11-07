// @flow
// The sidebar of Webvelop, docked on the left and toggled with the menu
// button of the title bar: navigation, the content of the opened website
// (pages, components, code, assets...) and the recent websites.
import * as React from 'react';
import { type FileMetadataAndStorageProviderName } from '../../ProjectsStorage';
import SitePanel, { Item } from '../SitePanel/SitePanel';
import { WebvelopLogoIcon } from '../ElementIcons';
import { getRecentName } from '../Home/HomePage';
import Home from '../../UI/CustomSvgIcons/Home';
import Add from '../../UI/CustomSvgIcons/Add';
import Folder from '../../UI/CustomSvgIcons/Folder';
import Preferences from '../../UI/CustomSvgIcons/Preferences';
import CircledInfo from '../../UI/CustomSvgIcons/CircledInfo';
import Cross from '../../UI/CustomSvgIcons/Cross';
import Floppy from '../../UI/CustomSvgIcons/Floppy';

type Props = {|
  projectName: ?string,
  projectLocation: ?string,
  hasUnsavedChanges: boolean,
  currentTabKey: string,
  recentProjects: Array<FileMetadataAndStorageProviderName>,
  onHome: () => void,
  onNewWebsite: () => void,
  onOpen: () => void,
  onOpenRecent: (item: FileMetadataAndStorageProviderName) => void,
  onSave: () => void,
  onCloseProject: () => void,
  onPreferences: () => void,
  onAbout: () => void,
|};

const AppSidebar = ({
  projectName,
  projectLocation,
  hasUnsavedChanges,
  currentTabKey,
  recentProjects,
  onHome,
  onNewWebsite,
  onOpen,
  onOpenRecent,
  onSave,
  onCloseProject,
  onPreferences,
  onAbout,
}: Props): React.Node => (
  <aside className="wve-sidebar">
    <div className="wve-sidebar-nav">
      <Item icon={<Home />} label="Start page" selected={currentTabKey === 'home'} onClick={onHome} />
      <Item icon={<Add />} label="New website" onClick={onNewWebsite} />
      <Item icon={<Folder />} label="Open a website" onClick={onOpen} />
    </div>

    <div className="wve-sidebar-scroll">
      {projectName ? (
        <>
          <div className="wve-sidebar-project">
            <div className="wve-sidebar-project-icon">{projectName.charAt(0).toUpperCase()}</div>
            <div className="wve-sidebar-project-text">
              <strong title={projectName}>{projectName}</strong>
              <span title={projectLocation || ''}>{hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}</span>
            </div>
            <button className="wve-icon-button" title="Save (Ctrl+S)" onClick={onSave}>
              <Floppy />
            </button>
            <button className="wve-icon-button" title="Close the website" onClick={onCloseProject}>
              <Cross />
            </button>
          </div>
          <SitePanel currentTabKey={currentTabKey} onClose={() => {}} />
        </>
      ) : (
        <div className="wve-section">
          <div className="wve-section-header" style={{ cursor: 'default' }}>
            <span className="wve-grow">Recent websites</span>
          </div>
          {recentProjects.length === 0 ? (
            <div className="wve-muted wve-small" style={{ padding: '2px 16px 12px' }}>
              No recent website.
            </div>
          ) : (
            recentProjects.slice(0, 12).map(item => (
              <Item
                key={item.storageProviderName + item.fileMetadata.fileIdentifier}
                icon={<WebvelopLogoIcon />}
                label={getRecentName(item)}
                onClick={() => onOpenRecent(item)}
              />
            ))
          )}
        </div>
      )}
    </div>

    <div className="wve-sidebar-footer">
      <Item icon={<Preferences />} label="Preferences" onClick={onPreferences} />
      <Item icon={<CircledInfo />} label="About Webvelop" onClick={onAbout} />
    </div>
  </aside>
);

export default AppSidebar;
