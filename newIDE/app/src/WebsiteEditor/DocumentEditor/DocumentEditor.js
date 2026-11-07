// @flow
// The visual editor of a page or of a reusable component:
// Layers/Insert panel, canvas and inspector.
import * as React from 'react';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Divider from '@material-ui/core/Divider';
import {
  BREAKPOINTS,
  getBreakpoint,
  type BreakpointId,
  type WebsiteElement,
  type InteractionEvent,
} from '../../Website/Model/Schema';
import {
  type DocumentRef,
  getDocument,
  updateDocument,
  updateElementInDocument,
  insertElementsInDocument,
  removeElementFromDocument,
  duplicateElementInDocument,
  convertElementToComponent,
} from '../../Website/Model/ProjectOps';
import {
  findElement,
  findParent,
  moveElement,
  cloneWithNewIds,
  insertElement,
  removeElement,
  collectElementIds,
} from '../../Website/Model/Tree';
import { createElement, getElementType } from '../../Website/Elements/ElementTypes';
import { PRESETS } from '../../Website/Elements/Presets';
import { cloneEventsWithIdMap } from '../../Website/Interactions/EventFactory';
import { buildCanvasContent } from '../../Website/Rendering/SiteBuilder';
import { setStyleValue } from '../../Website/Styles/StyleProperties';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { usePrompt } from '../Fields/PromptDialog';
import WebsiteCanvas, { type CanvasToolbarAction } from '../Canvas/WebsiteCanvas';
import LayersPanel from '../Layers/LayersPanel';
import InsertPanel, { type InsertPayload } from '../Insert/InsertPanel';
import Inspector, { type InspectorTab } from '../Inspector/Inspector';
import ComponentPropsEditor from './ComponentPropsEditor';
import EventsList from '../Interactions/EventsList';
import Dialog from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import Desktop from '../../UI/CustomSvgIcons/Desktop';
import Mobile from '../../UI/CustomSvgIcons/Mobile';
import Undo from '../../UI/CustomSvgIcons/Undo';
import Redo from '../../UI/CustomSvgIcons/Redo';
import Grid from '../../UI/CustomSvgIcons/Grid';
import Visibility from '../../UI/CustomSvgIcons/Visibility';
import Play from '../../UI/CustomSvgIcons/Play';
import Events from '../../UI/CustomSvgIcons/Events';
import Code from '../../UI/CustomSvgIcons/EditFile';

// Elements copied with Ctrl+C, shared between all the editors.
let clipboard: ?{| element: WebsiteElement, events: Array<InteractionEvent> |} = null;

const TabletIcon = (props: any) => (
  <svg viewBox="0 0 16 16" fill="none" {...props}>
    <rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" />
    <circle cx="8" cy="12.3" r="0.6" fill="currentColor" />
  </svg>
);

const breakpointIcons = { desktop: Desktop, tablet: TabletIcon, mobile: Mobile };

type Props = {|
  docRef: DocumentRef,
  isActive: boolean,
  initialSelectedElementId?: ?string,
|};

const DocumentEditor = ({ docRef, isActive, initialSelectedElementId }: Props) => {
  const {
    project,
    updateProject,
    resolveAssetUrl,
    openTab,
    openPreview,
    canvasSettings,
    setCanvasSettings,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWebsiteEditor();
  const prompt = usePrompt();
  const document = getDocument(project, docRef);
  const [selectedId, setSelectedId] = React.useState<?string>(initialSelectedElementId || null);
  const [breakpoint, setBreakpoint] = React.useState<BreakpointId>('desktop');
  const [zoom, setZoom] = React.useState<number | 'fit' | 'custom'>('fit');
  const [customScale, setCustomScale] = React.useState<number>(1);
  const [leftTab, setLeftTab] = React.useState<'layers' | 'insert' | 'props'>('insert');
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>('style');
  const [insertPayload, setInsertPayload] = React.useState<?InsertPayload>(null);
  const [contextMenu, setContextMenu] = React.useState<?{| id: string, x: number, y: number |}>(null);
  const [componentEventsOpen, setComponentEventsOpen] = React.useState(false);

  React.useEffect(
    () => {
      if (initialSelectedElementId) setSelectedId(initialSelectedElementId);
    },
    [initialSelectedElementId]
  );

  const canvasContent = React.useMemo(
    () => (isActive && document ? buildCanvasContent(project, docRef, resolveAssetUrl) : null),
    // Rebuild only when the project changes (and the tab is visible).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, docRef.id, docRef.kind, isActive, resolveAssetUrl]
  );
  const lastCanvasContent = React.useRef(canvasContent);
  if (canvasContent) lastCanvasContent.current = canvasContent;

  if (!document) {
    return <div className="wve-empty">This {docRef.kind} does not exist anymore.</div>;
  }
  const root = document.root;
  const selectedElement = selectedId ? findElement(root, selectedId) : null;
  const effectiveSelectedId = selectedElement ? selectedElement.id : null;
  const editedComponentId = docRef.kind === 'component' ? docRef.id : null;

  // Changes

  const changeElement = (id: string, updater: WebsiteElement => WebsiteElement, mergeKey?: string) =>
    updateProject(current => updateElementInDocument(current, docRef, id, updater), {
      mergeKey: mergeKey ? `${docRef.id}-${id}-${mergeKey}` : undefined,
      changeContext: { selectedId: id },
    });

  const changeEvents = (events: Array<InteractionEvent>, mergeKey?: string) =>
    updateProject(current => updateDocument(current, docRef, doc => ({ ...doc, events })), {
      mergeKey: mergeKey ? `${docRef.id}-events-${mergeKey}` : undefined,
    });

  const getInsertionLocation = (): {| parentId: string, index: number |} => {
    if (selectedElement && selectedElement.id !== root.id) {
      const definition = getElementType(selectedElement.type);
      if (definition.isContainer && selectedElement.type !== 'component' && selectedElement.type !== 'link') {
        return { parentId: selectedElement.id, index: selectedElement.children.length };
      }
      const location = findParent(root, selectedElement.id);
      if (location) return { parentId: location.parent.id, index: location.index + 1 };
    }
    if (selectedElement && selectedElement.id === root.id) return { parentId: root.id, index: root.children.length };
    return { parentId: root.id, index: root.children.length };
  };

  const buildPayload = (payload: InsertPayload): {| elements: Array<WebsiteElement>, events: Array<InteractionEvent> |} => {
    if (payload.kind === 'element') return { elements: [createElement(payload.type)], events: [] };
    if (payload.kind === 'preset') {
      const preset = PRESETS.find(p => p.id === payload.id);
      return preset ? preset.build() : { elements: [], events: [] };
    }
    if (payload.kind === 'component') {
      const component = project.components.find(c => c.id === payload.componentId);
      return {
        elements: [
          createElement('component', {
            name: component ? component.name : 'Component',
            props: { componentId: payload.componentId, values: {} },
          }),
        ],
        events: [],
      };
    }
    const reactComponent = project.reactComponents.find(c => c.id === payload.reactComponentId);
    return {
      elements: [
        createElement('react', {
          name: reactComponent ? reactComponent.name : 'React component',
          props: { reactComponentId: payload.reactComponentId, values: {} },
        }),
      ],
      events: [],
    };
  };

  const insert = (payload: InsertPayload, location: {| parentId: string, index: number |}) => {
    const { elements, events } = buildPayload(payload);
    if (!elements.length) return;
    updateProject(
      current => insertElementsInDocument(current, docRef, location.parentId, location.index, elements, events),
      { type: 'ADD', changeContext: { selectedId: elements[0].id } }
    );
    setSelectedId(elements[0].id);
  };

  const deleteSelection = () => {
    if (!selectedElement || selectedElement.id === root.id) return;
    const location = findParent(root, selectedElement.id);
    updateProject(current => removeElementFromDocument(current, docRef, selectedElement.id), { type: 'DELETE' });
    if (location) {
      const siblings = location.parent.children.filter(c => c.id !== selectedElement.id);
      setSelectedId(siblings[Math.min(location.index, siblings.length - 1)] ? siblings[Math.min(location.index, siblings.length - 1)].id : location.parent.id);
    } else setSelectedId(null);
  };

  const duplicateSelection = () => {
    if (!selectedElement || selectedElement.id === root.id) return;
    let newId = null;
    updateProject(current => {
      const result = duplicateElementInDocument(current, docRef, selectedElement.id);
      newId = result.newElementId;
      return result.project;
    }, { type: 'ADD' });
    if (newId) setSelectedId(newId);
  };

  const copySelection = () => {
    if (!selectedElement || selectedElement.id === root.id) return;
    const ids = new Set(collectElementIds(selectedElement));
    clipboard = {
      element: JSON.parse(JSON.stringify(selectedElement)),
      events: JSON.parse(JSON.stringify(document.events.filter(event => ids.has(event.trigger.target)))),
    };
  };

  const paste = () => {
    if (!clipboard) return;
    const { element, idMap } = cloneWithNewIds(clipboard.element);
    const events = cloneEventsWithIdMap(clipboard.events, idMap);
    const location = getInsertionLocation();
    updateProject(
      current => insertElementsInDocument(current, docRef, location.parentId, location.index, [element], events),
      { type: 'ADD' }
    );
    setSelectedId(element.id);
  };

  const moveSelection = (delta: number) => {
    if (!selectedElement) return;
    const location = findParent(root, selectedElement.id);
    if (!location) return;
    const newIndex = location.index + (delta > 0 ? 2 : -1);
    if (newIndex < 0 || newIndex > location.parent.children.length) return;
    updateProject(current =>
      updateDocument(current, docRef, doc => ({ ...doc, root: moveElement(doc.root, selectedElement.id, location.parent.id, newIndex) }))
    );
  };

  const selectParent = () => {
    if (!selectedElement) return;
    const location = findParent(root, selectedElement.id);
    if (location) setSelectedId(location.parent.id);
  };

  const wrapSelection = () => {
    if (!selectedElement || selectedElement.id === root.id) return;
    const location = findParent(root, selectedElement.id);
    if (!location) return;
    const wrapper = createElement('container', { name: 'Container', children: [selectedElement] });
    updateProject(current =>
      updateDocument(current, docRef, doc => ({
        ...doc,
        root: insertElement(removeElement(doc.root, selectedElement.id), location.parent.id, location.index, wrapper),
      }))
    );
    setSelectedId(wrapper.id);
  };

  const convertToComponent = async () => {
    if (!selectedElement || selectedElement.id === root.id) return;
    const name = await prompt({
      title: 'Convert to a reusable component',
      label: 'Name of the component',
      defaultValue: selectedElement.name,
      description:
        'The element becomes a component that can be reused on every page. Editing the component updates all its instances.',
    });
    if (!name) return;
    let instanceId = null;
    updateProject(current => {
      const result = convertElementToComponent(current, docRef, selectedElement.id, name);
      instanceId = result.instanceId;
      return result.project;
    });
    if (instanceId) setSelectedId(instanceId);
  };

  const detachInstance = () => {
    if (!selectedElement || selectedElement.type !== 'component') return;
    const component = project.components.find(c => c.id === selectedElement.props.componentId);
    if (!component) return;
    const location = findParent(root, selectedElement.id);
    if (!location) return;
    const { element, idMap } = cloneWithNewIds(component.root);
    // Bake the prop values into the copy.
    const values = {};
    component.props.forEach(prop => {
      const value = selectedElement.props.values && selectedElement.props.values[prop.name];
      values[prop.name] = value !== undefined && value !== '' ? value : prop.defaultValue;
    });
    const bake = (el: WebsiteElement): WebsiteElement => ({
      ...el,
      name: el === element ? selectedElement.name : el.name,
      props: Object.keys(el.props).reduce((props, key) => {
        const value = el.props[key];
        props[key] = typeof value === 'string' ? value.replace(/\{\{\s*props\.([\w$]+)\s*\}\}/g, (m, n) => (values[n] !== undefined ? String(values[n]) : '')) : value;
        return props;
      }, {}),
      children: el.children.map(bake),
    });
    const baked = bake(element);
    const events = cloneEventsWithIdMap(component.events, idMap);
    updateProject(current =>
      updateDocument(current, docRef, doc => ({
        ...doc,
        root: insertElement(removeElement(doc.root, selectedElement.id), location.parent.id, location.index, baked),
        events: [...doc.events.filter(e => e.trigger.target !== selectedElement.id), ...events],
      }))
    );
    setSelectedId(baked.id);
  };

  const toggleHidden = (id: string) => {
    const element = findElement(root, id);
    if (!element) return;
    const own = element.styles[breakpoint] || {};
    const hidden = own.display === 'none';
    changeElement(id, current => ({
      ...current,
      styles: setStyleValue(current.styles, breakpoint, 'display', hidden ? null : 'none'),
    }));
  };

  const onToolbarAction = (action: CanvasToolbarAction) => {
    if (action === 'parent') selectParent();
    else if (action === 'up') moveSelection(-1);
    else if (action === 'down') moveSelection(1);
    else if (action === 'duplicate') duplicateSelection();
    else if (action === 'delete') deleteSelection();
  };

  const handleKeyDown = (event: KeyboardEvent | SyntheticKeyboardEvent<>) => {
    const target: any = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    let handled = true;
    if (key === 'delete' || key === 'backspace') deleteSelection();
    else if (ctrl && key === 'd') duplicateSelection();
    else if (ctrl && key === 'c') copySelection();
    else if (ctrl && key === 'x') {
      copySelection();
      deleteSelection();
    } else if (ctrl && key === 'v') paste();
    else if (ctrl && key === 'z' && !event.shiftKey) undo();
    else if (ctrl && (key === 'y' || (key === 'z' && event.shiftKey))) redo();
    else if (key === 'escape') selectParent();
    else if (event.altKey && key === 'arrowup') moveSelection(-1);
    else if (event.altKey && key === 'arrowdown') moveSelection(1);
    else handled = false;
    if (handled) event.preventDefault();
  };

  const menuItem = (label: string, onClick: () => void, disabled?: boolean, shortcut?: string) => (
    <MenuItem
      dense
      disabled={!!disabled}
      onClick={() => {
        setContextMenu(null);
        onClick();
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && <span className="wve-muted wve-small" style={{ marginLeft: 24 }}>{shortcut}</span>}
    </MenuItem>
  );
  const contextElement = contextMenu ? findElement(root, contextMenu.id) : null;
  const contextIsRoot = !!contextElement && contextElement.id === root.id;

  const BreakpointButtons = (
    <div className="wve-breakpoints">
      {BREAKPOINTS.map(bp => {
        const Icon = breakpointIcons[bp.id];
        return (
          <button
            key={bp.id}
            className={breakpoint === bp.id ? 'wve-active' : ''}
            title={`${bp.label} (${bp.canvasWidth}px). ${bp.id === 'desktop' ? 'Base styles.' : `Styles for screens up to ${bp.maxWidth || 0}px.`}`}
            onClick={() => setBreakpoint(bp.id)}
          >
            <Icon />
            {bp.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="wve-editor"
      style={{ flexDirection: 'column' }}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="wve-toolbar">
        <button className="wve-icon-button" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo />
        </button>
        <button className="wve-icon-button" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <Redo />
        </button>
        <div className="wve-toolbar-separator" />
        {BreakpointButtons}
        <select
          className="wve-select"
          style={{ width: 90 }}
          value={String(zoom)}
          title="Zoom (or use the mouse wheel on the canvas)"
          onChange={e => setZoom(e.target.value === 'fit' ? 'fit' : parseFloat(e.target.value))}
        >
          {zoom === 'custom' && <option value="custom">{Math.round(customScale * 100)}%</option>}
          <option value="fit">Fit</option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
        </select>
        <button
          className={`wve-icon-button ${canvasSettings.showOutlines ? 'wve-active' : ''}`}
          title="Show the outlines of all elements"
          onClick={() => setCanvasSettings({ ...canvasSettings, showOutlines: !canvasSettings.showOutlines })}
        >
          <Grid />
        </button>
        <button
          className={`wve-icon-button ${canvasSettings.showHiddenElements ? 'wve-active' : ''}`}
          title="Show the elements hidden when the page loads (popups, messages...)"
          onClick={() => setCanvasSettings({ ...canvasSettings, showHiddenElements: !canvasSettings.showHiddenElements })}
        >
          <Visibility />
        </button>
        <span style={{ flex: 1 }} />
        {docRef.kind === 'page' ? (
          <>
            <button className="wve-icon-button" title="Interactions of the page" onClick={() => openTab({ kind: 'page-events', id: docRef.id })}>
              <Events />
              <span style={{ marginLeft: 4 }}>Interactions ({document.events.length})</span>
            </button>
            <button className="wve-icon-button" title="JavaScript and CSS of the page" onClick={() => openTab({ kind: 'page-code', id: docRef.id })}>
              <Code />
              <span style={{ marginLeft: 4 }}>Page code</span>
            </button>
            <button className="wve-icon-button" title="Preview the page" onClick={() => openPreview(docRef.id)}>
              <Play />
              <span style={{ marginLeft: 4 }}>Preview</span>
            </button>
          </>
        ) : (
          <button className="wve-icon-button" title="Interactions of the component" onClick={() => setComponentEventsOpen(true)}>
            <Events />
            <span style={{ marginLeft: 4 }}>Interactions ({document.events.length})</span>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div className="wve-panel" style={{ width: 260, flexShrink: 0 }}>
          <div className="wve-panel-tabs">
            <button className={`wve-panel-tab ${leftTab === 'insert' ? 'wve-active' : ''}`} onClick={() => setLeftTab('insert')}>
              Insert
            </button>
            <button className={`wve-panel-tab ${leftTab === 'layers' ? 'wve-active' : ''}`} onClick={() => setLeftTab('layers')}>
              Layers
            </button>
            {docRef.kind === 'component' && (
              <button className={`wve-panel-tab ${leftTab === 'props' ? 'wve-active' : ''}`} onClick={() => setLeftTab('props')}>
                Props
              </button>
            )}
          </div>
          {leftTab === 'insert' && (
            <InsertPanel
              project={project}
              editedComponentId={editedComponentId}
              onInsert={payload => insert(payload, getInsertionLocation())}
              onDragStart={setInsertPayload}
              onDragEnd={() => setInsertPayload(null)}
            />
          )}
          {leftTab === 'layers' && (
            <LayersPanel
              root={root}
              events={document.events}
              selectedId={effectiveSelectedId}
              breakpoint={breakpoint}
              onSelect={setSelectedId}
              onRename={(id, name) => changeElement(id, element => ({ ...element, name }))}
              onMove={(id, parentId, index) =>
                updateProject(current =>
                  updateDocument(current, docRef, doc => ({ ...doc, root: moveElement(doc.root, id, parentId, index) }))
                )
              }
              onToggleHidden={toggleHidden}
              onContextMenu={(id, x, y) => setContextMenu({ id, x, y })}
            />
          )}
          {leftTab === 'props' && docRef.kind === 'component' && <ComponentPropsEditor componentId={docRef.id} />}
        </div>
        <WebsiteCanvas
          content={canvasContent || lastCanvasContent.current}
          root={root}
          breakpoint={getBreakpoint(breakpoint)}
          zoom={zoom}
          onCustomZoom={scale => {
            if (scale === null || scale === undefined) setZoom('fit');
            else {
              setCustomScale(scale);
              setZoom('custom');
            }
          }}
          selectedId={effectiveSelectedId}
          showOutlines={canvasSettings.showOutlines}
          showHiddenElements={canvasSettings.showHiddenElements}
          variables={project.variables}
          onSelect={id => setSelectedId(id || root.id)}
          onMoveElement={(id, parentId, index) =>
            updateProject(current =>
              updateDocument(current, docRef, doc => ({ ...doc, root: moveElement(doc.root, id, parentId, index) }))
            )
          }
          isInserting={!!insertPayload}
          onInsert={(parentId, index) => {
            if (insertPayload) insert(insertPayload, { parentId, index });
            setInsertPayload(null);
          }}
          onResize={(id, changes, mergeKey) =>
            changeElement(
              id,
              element => {
                let styles = element.styles;
                Object.keys(changes).forEach(prop => {
                  styles = setStyleValue(styles, breakpoint, prop, changes[prop]);
                });
                return { ...element, styles };
              },
              mergeKey
            )
          }
          onCommitText={(id, text) => {
            const element = findElement(root, id);
            if (!element) return;
            const prop = getElementType(element.type).inlineEditableTextProp;
            if (!prop || element.props[prop] === text) return;
            changeElement(id, current => ({ ...current, props: { ...current.props, [prop]: text } }));
          }}
          onContextMenu={(id, x, y) => setContextMenu({ id, x, y })}
          onKeyDown={handleKeyDown}
          onToolbarAction={onToolbarAction}
        />
        <div className="wve-panel wve-right" style={{ width: 320, flexShrink: 0 }}>
          <Inspector
            root={root}
            element={selectedElement || root}
            events={document.events}
            breakpoint={breakpoint}
            editedComponentId={editedComponentId}
            tab={inspectorTab}
            onTabChange={setInspectorTab}
            onChangeElement={(updater, mergeKey) => changeElement((selectedElement || root).id, updater, mergeKey)}
            onChangeEvents={changeEvents}
          />
        </div>
      </div>
      <Menu
        open={!!contextMenu}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        {contextElement && [
          contextElement.type === 'component' && contextElement.props.componentId
            ? menuItem('Edit the component', () => openTab({ kind: 'component', id: contextElement.props.componentId }))
            : null,
          contextElement.type === 'component' ? menuItem('Detach (turn into editable elements)', detachInstance) : null,
          contextElement.type === 'react' && contextElement.props.reactComponentId
            ? menuItem('Edit the React code', () => openTab({ kind: 'react-component', id: contextElement.props.reactComponentId }))
            : null,
          menuItem('Duplicate', duplicateSelection, contextIsRoot, 'Ctrl+D'),
          menuItem('Copy', copySelection, contextIsRoot, 'Ctrl+C'),
          menuItem('Paste', paste, !clipboard, 'Ctrl+V'),
          menuItem('Delete', deleteSelection, contextIsRoot, 'Delete'),
          <Divider key="d1" />,
          menuItem('Wrap in a container', wrapSelection, contextIsRoot),
          menuItem('Convert to a reusable component', convertToComponent, contextIsRoot),
          menuItem('Select the parent', selectParent, contextIsRoot, 'Escape'),
          menuItem('Move before', () => moveSelection(-1), contextIsRoot, 'Alt+↑'),
          menuItem('Move after', () => moveSelection(1), contextIsRoot, 'Alt+↓'),
          <Divider key="d2" />,
          menuItem(contextElement.locked ? 'Unlock' : 'Lock', () =>
            changeElement(contextElement.id, el => ({ ...el, locked: !el.locked }))
          , contextIsRoot),
          menuItem('Add an interaction...', () => setInspectorTab('interactions'), contextIsRoot),
        ]}
      </Menu>
      {componentEventsOpen && docRef.kind === 'component' && (
        <Dialog
          open
          title={`Interactions of the component "${document.name}"`}
          maxWidth="lg"
          onRequestClose={() => setComponentEventsOpen(false)}
          actions={[<FlatButton key="close" label="Close" onClick={() => setComponentEventsOpen(false)} />]}
        >
          <div className="wve-muted" style={{ marginBottom: 8 }}>
            These interactions run in every instance of the component, on every page. They can only use the elements of the
            component.
          </div>
          <EventsList events={document.events} onChange={changeEvents} root={root} />
        </Dialog>
      )}
    </div>
  );
};

export default DocumentEditor;
