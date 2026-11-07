// @flow
import * as React from 'react';
import MenuIcon from '../UI/CustomSvgIcons/Menu';
import IconButton from '../UI/IconButton';
import {
  TitleBarLeftSafeMargins,
  TitleBarRightSafeMargins,
} from '../UI/TitleBarSafeMargins';
import Window from '../Utils/Window';
import { isMacLike } from '../Utils/Platform';

export const WINDOW_DRAGGABLE_PART_CLASS_NAME = 'title-bar-draggable-part';
export const WINDOW_NON_DRAGGABLE_PART_CLASS_NAME = 'title-bar-non-draggable-part';

const styles = {
  container: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'flex-end',
    position: 'relative',
    minHeight: 38,
  },
  menuIcon: {
    marginLeft: 4,
    marginRight: 4,
    width: 34,
    height: 34,
  },
  rightContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingLeft: 8,
    paddingRight: 8,
  },
};

type Props = {|
  onMenuClick: (event: any) => void,
  renderTabs: () => React.Node,
  rightContent: React.Node,
|};

/**
 * The title bar: a menu button, the tabs of the opened editors, and buttons
 * to save, preview and export. It gives space for the window controls.
 */
export default function TabsTitlebar({ onMenuClick, renderTabs, rightContent }: Props): React.Node {
  return (
    <div
      style={styles.container}
      className={WINDOW_DRAGGABLE_PART_CLASS_NAME}
      onDoubleClick={() => {
        if (isMacLike()) Window.toggleMaximize();
      }}
    >
      <TitleBarLeftSafeMargins />
      {/* $FlowFixMe[incompatible-type] */}
      <IconButton
        size="small"
        id="main-menu-button"
        className={WINDOW_NON_DRAGGABLE_PART_CLASS_NAME}
        style={styles.menuIcon}
        color="default"
        tooltip="Website panel and menu"
        onClick={onMenuClick}
      >
        <MenuIcon />
      </IconButton>
      {renderTabs()}
      <div style={styles.rightContent} className={WINDOW_NON_DRAGGABLE_PART_CLASS_NAME}>
        {rightContent}
      </div>
      <TitleBarRightSafeMargins />
    </div>
  );
}
