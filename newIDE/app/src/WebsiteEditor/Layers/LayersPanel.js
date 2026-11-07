// @flow
// The "Layers" panel: the hierarchy of the elements of the page.
import * as React from 'react';
import { type WebsiteElement, type BreakpointId, type InteractionEvent } from '../../Website/Model/Schema';
import { getElementType } from '../../Website/Elements/ElementTypes';
import { isDescendantOf, getElementPath, findElement } from '../../Website/Model/Tree';
import { ElementIcon } from '../ElementIcons';
import Visibility from '../../UI/CustomSvgIcons/Visibility';
import VisibilityOff from '../../UI/CustomSvgIcons/VisibilityOff';
import ThreeDotsMenu from '../../UI/CustomSvgIcons/ThreeDotsMenu';
import ChevronArrowRight from '../../UI/CustomSvgIcons/ChevronArrowRight';
import ChevronArrowBottom from '../../UI/CustomSvgIcons/ChevronArrowBottom';
import Lock from '../../UI/CustomSvgIcons/Lock';

type DropPosition = 'before' | 'after' | 'inside';

type Props = {|
  root: WebsiteElement,
  events: Array<InteractionEvent>,
  selectedId: ?string,
  breakpoint: BreakpointId,
  onSelect: (id: string) => void,
  onRename: (id: string, name: string) => void,
  onMove: (id: string, parentId: string, index: number) => void,
  onToggleHidden: (id: string) => void,
  onContextMenu: (id: string, x: number, y: number) => void,
|};

const isHiddenAt = (element: WebsiteElement, breakpoint: BreakpointId): boolean => {
  const order = breakpoint === 'mobile' ? ['mobile', 'tablet', 'desktop'] : breakpoint === 'tablet' ? ['tablet', 'desktop'] : ['desktop'];
  for (const key of order) {
    const map = element.styles[key];
    if (map && map.display) return map.display === 'none';
  }
  return false;
};

const LayersPanel = ({
  root,
  events,
  selectedId,
  breakpoint,
  onSelect,
  onRename,
  onMove,
  onToggleHidden,
  onContextMenu,
}: Props) => {
  const [collapsed, setCollapsed] = React.useState<{ [string]: boolean }>({});
  const [renamingId, setRenamingId] = React.useState<?string>(null);
  const [dragged, setDragged] = React.useState<?string>(null);
  const [dropInfo, setDropInfo] = React.useState<?{| id: string, position: DropPosition |}>(null);
  const selectedRef = React.useRef<?HTMLElement>(null);

  // Expand the ancestors of the selected element.
  React.useEffect(
    () => {
      if (!selectedId) return;
      const path = getElementPath(root, selectedId);
      if (path.some(element => collapsed[element.id] && element.id !== selectedId)) {
        const newCollapsed = { ...collapsed };
        path.forEach(element => {
          if (element.id !== selectedId) delete newCollapsed[element.id];
        });
        setCollapsed(newCollapsed);
      }
      setTimeout(() => {
        if (selectedRef.current && selectedRef.current.scrollIntoView)
          selectedRef.current.scrollIntoView({ block: 'nearest' });
      }, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId]
  );

  const eventsCountByTarget = React.useMemo(
    () => {
      const counts = {};
      events.forEach(event => {
        counts[event.trigger.target] = (counts[event.trigger.target] || 0) + 1;
      });
      return counts;
    },
    [events]
  );

  const computeDropPosition = (e: SyntheticDragEvent<HTMLElement>, element: WebsiteElement): DropPosition => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const isContainer = getElementType(element.type).isContainer && element.type !== 'component';
    if (element.id === root.id) return 'inside';
    if (isContainer) {
      if (ratio < 0.25) return 'before';
      if (ratio > 0.75) return 'after';
      return 'inside';
    }
    return ratio < 0.5 ? 'before' : 'after';
  };

  const findParent = (id: string, current: WebsiteElement = root): ?{| parent: WebsiteElement, index: number |} => {
    for (let i = 0; i < current.children.length; i++) {
      if (current.children[i].id === id) return { parent: current, index: i };
      const found = findParent(id, current.children[i]);
      if (found) return found;
    }
    return null;
  };

  const drop = (targetId: string, position: DropPosition) => {
    if (!dragged || dragged === targetId) return;
    if (isDescendantOf(root, dragged, targetId)) return;
    if (position === 'inside') {
      const target = findElement(root, targetId);
      onMove(dragged, targetId, target ? target.children.length : 0);
      return;
    }
    const location = findParent(targetId);
    if (!location) return;
    onMove(dragged, location.parent.id, location.index + (position === 'after' ? 1 : 0));
  };

  const renderElement = (element: WebsiteElement, depth: number): React.Node => {
    const definition = getElementType(element.type);
    const isRoot = element.id === root.id;
    const hasChildren = element.children.length > 0;
    const isCollapsed = !!collapsed[element.id];
    const isSelected = element.id === selectedId;
    const hidden = !isRoot && isHiddenAt(element, breakpoint);
    const interactions = eventsCountByTarget[element.id] || 0;
    const dropClass =
      dropInfo && dropInfo.id === element.id ? `wve-drop-${dropInfo.position}` : '';
    return (
      <React.Fragment key={element.id}>
        <div
          ref={isSelected ? (node => { selectedRef.current = node; }) : undefined}
          className={`wve-tree-row ${isSelected ? 'wve-selected' : ''} ${hidden ? 'wve-hidden-element' : ''} ${dropClass}`}
          style={{ paddingLeft: 4 + depth * 14 }}
          onClick={() => onSelect(element.id)}
          onDoubleClick={() => !isRoot && setRenamingId(element.id)}
          onContextMenu={e => {
            e.preventDefault();
            onSelect(element.id);
            onContextMenu(element.id, e.clientX, e.clientY);
          }}
          draggable={!isRoot && renamingId !== element.id}
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', element.id);
            setDragged(element.id);
          }}
          onDragEnd={() => {
            setDragged(null);
            setDropInfo(null);
          }}
          onDragOver={e => {
            if (!dragged || dragged === element.id || isDescendantOf(root, dragged, element.id)) return;
            e.preventDefault();
            const position = computeDropPosition(e, element);
            if (!dropInfo || dropInfo.id !== element.id || dropInfo.position !== position)
              setDropInfo({ id: element.id, position });
          }}
          onDragLeave={() => setDropInfo(info => (info && info.id === element.id ? null : info))}
          onDrop={e => {
            e.preventDefault();
            const position = computeDropPosition(e, element);
            drop(element.id, position);
            setDragged(null);
            setDropInfo(null);
          }}
          title={`${definition.label}${element.behaviors.length ? ' • behaviors: ' + element.behaviors.map(b => b.type).join(', ') : ''}`}
        >
          <span
            className="wve-tree-toggle"
            onClick={e => {
              e.stopPropagation();
              if (hasChildren) setCollapsed({ ...collapsed, [element.id]: !isCollapsed });
            }}
          >
            {hasChildren ? isCollapsed ? <ChevronArrowRight /> : <ChevronArrowBottom /> : null}
          </span>
          <span className="wve-tree-icon">
            <ElementIcon name={definition.icon} />
          </span>
          {renamingId === element.id ? (
            <input
              className="wve-input"
              autoFocus
              defaultValue={element.name}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onBlur={e => {
                const name = e.currentTarget.value.trim();
                if (name && name !== element.name) onRename(element.id, name);
                setRenamingId(null);
              }}
            />
          ) : (
            <span className="wve-tree-name">{isRoot ? 'Page body' : element.name}</span>
          )}
          {element.locked && <Lock style={{ width: 12, height: 12, opacity: 0.6 }} />}
          {interactions > 0 && (
            <span className="wve-tree-badge" title={`${interactions} interaction(s)`}>
              ⚡{interactions}
            </span>
          )}
          {element.behaviors.length > 0 && (
            <span className="wve-tree-badge" title="Behaviors">
              {element.behaviors.map(b => b.type).join(', ')}
            </span>
          )}
          {!isRoot && (
            <span className="wve-row-actions">
              <button
                className="wve-icon-button"
                title={hidden ? 'Show on this screen size' : 'Hide on this screen size'}
                onClick={e => {
                  e.stopPropagation();
                  onToggleHidden(element.id);
                }}
              >
                {hidden ? <VisibilityOff /> : <Visibility />}
              </button>
              <button
                className="wve-icon-button"
                title="More actions"
                onClick={e => {
                  e.stopPropagation();
                  onSelect(element.id);
                  onContextMenu(element.id, e.clientX, e.clientY);
                }}
              >
                <ThreeDotsMenu />
              </button>
            </span>
          )}
        </div>
        {!isCollapsed && element.children.map(child => renderElement(child, depth + 1))}
      </React.Fragment>
    );
  };

  return <div className="wve-scroll">{renderElement(root, 0)}</div>;
};

export default LayersPanel;
