// @flow
// The visual editing canvas: renders the whole page in an iframe (at the
// width of the current breakpoint) placed in a workspace that can be zoomed
// (mouse wheel) and moved (middle mouse button), and draws the selection,
// handles, snapping guides and drop indicators above it.
import * as React from 'react';
import { type WebsiteElement, type Breakpoint } from '../../Website/Model/Schema';
import { walkElements } from '../../Website/Model/Tree';
import { getElementType } from '../../Website/Elements/ElementTypes';
import { type CanvasContent } from '../../Website/Rendering/SiteBuilder';
import { getRuntimeJs, getRuntimeCss, getRuntimeSources } from '../../Website/Services/RuntimeSources';
import ArrowTop from '../../UI/CustomSvgIcons/ArrowTop';
import ArrowBottom from '../../UI/CustomSvgIcons/ArrowBottom';
import Copy from '../../UI/CustomSvgIcons/Copy';
import Trash from '../../UI/CustomSvgIcons/Trash';
import ArrowTopThenLeft from '../../UI/CustomSvgIcons/ArrowTopThenLeft';

type Rect = {| left: number, top: number, width: number, height: number |};

export type DropTarget = {|
  parentId: string,
  index: number,
  /** Rectangle of the indicator, in iframe coordinates. */
  line: ?Rect,
  container: ?Rect,
|};

export type CanvasToolbarAction = 'parent' | 'up' | 'down' | 'duplicate' | 'delete';

type ElementInfo = {|
  element: WebsiteElement,
  parentId: ?string,
  isContainer: boolean,
  inlineTextProp: ?string,
|};

type Guide = {| x1: number, y1: number, x2: number, y2: number, center: boolean |};

type Camera = {| x: number, y: number, scale: number |};

type Props = {|
  content: ?CanvasContent,
  root: WebsiteElement,
  breakpoint: Breakpoint,
  /** "fit", a fixed scale, or "custom" when the user zoomed with the wheel. */
  zoom: number | 'fit' | 'custom',
  selectedId: ?string,
  showOutlines: boolean,
  showHiddenElements: boolean,
  variables: Array<any>,
  onSelect: (id: ?string) => void,
  onMoveElement: (id: string, parentId: string, index: number) => void,
  onInsert: (parentId: string, index: number) => void,
  isInserting: boolean,
  onResize: (id: string, changes: { [string]: string }, mergeKey: string) => void,
  onCommitText: (id: string, text: string) => void,
  onContextMenu: (id: string, x: number, y: number) => void,
  onKeyDown: (event: KeyboardEvent) => void,
  onToolbarAction: (action: CanvasToolbarAction) => void,
  /** Called with the scale when the user zooms with the wheel, or null when the view is reset. */
  onCustomZoom: (scale: ?number) => void,
|};

/** Height of the screen of each breakpoint: used for the "vh" units of the page. */
const DEVICE_HEIGHTS = { desktop: 800, tablet: 1180, mobile: 844 };

const EDITOR_CSS = `
html{scroll-behavior:auto!important}
.wv-editor *{cursor:default}
.wv-editor [data-wv-initially-hidden]:not(.wv-reveal){display:none!important}
.wv-editor [data-wv-initially-hidden].wv-reveal{outline:2px dashed #f59e0b;outline-offset:-2px}
.wv-editor iframe,.wv-editor video,.wv-editor .wv-embed *{pointer-events:none!important}
.wv-editor .wv-editor-empty{min-height:56px;outline:1px dashed rgba(99,102,241,.6);outline-offset:-4px}
.wv-editor .wv-editor-empty:empty::after{content:'Drop elements here';display:block;padding:18px;text-align:center;font:12px system-ui,sans-serif;color:rgba(99,102,241,.85)}
.wv-editor.wv-show-outlines [data-wv-id]{outline:1px dashed rgba(100,116,139,.45);outline-offset:-1px}
.wv-editor .wv-missing{padding:16px;border:1px dashed #94a3b8;color:#64748b;font:13px system-ui,sans-serif}
.wv-editor [contenteditable="true"]{outline:2px solid #f59e0b!important;outline-offset:2px;cursor:text}
.wv-editor [contenteditable="true"] *{cursor:text}
.wv-editor .wv-anim-pending{opacity:1!important}
.wv-editor.wv-moving *{cursor:move!important}
`;

const inlineScriptSafe = (code: string) => code.replace(/<\/script/gi, '<\\/script');

const buildSrcDoc = () =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<style>${getRuntimeCss()}</style><style>${EDITOR_CSS}</style><style id="wv-device-css"></style><style id="wv-site-css"></style></head>` +
  `<body class="wv-editor"><div id="wv-root"></div><script>${inlineScriptSafe(getRuntimeJs())}</script></body></html>`;

/** The page is shown entirely (no scrolling): "vh" units use the height of the device. */
const pinViewportUnits = (css: string, deviceHeight: number) =>
  css.replace(/(-?\d*\.?\d+)(d|s|l)?vh\b/g, (match, value) => `${(parseFloat(value) * deviceHeight) / 100}px`);

const EDGE_SIZE = 6;
const DRAG_THRESHOLD = 4;
const SNAP_DISTANCE = 6; // In screen pixels.
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

const WebsiteCanvas = (props: Props) => {
  const {
    content,
    root,
    breakpoint,
    zoom,
    selectedId,
    showOutlines,
    showHiddenElements,
    isInserting,
    onToolbarAction,
  } = props;
  const areaRef = React.useRef<?HTMLDivElement>(null);
  const iframeRef = React.useRef<?HTMLIFrameElement>(null);
  const propsRef = React.useRef(props);
  propsRef.current = props;
  const [loaded, setLoaded] = React.useState(false);
  const [areaSize, setAreaSize] = React.useState({ width: 800, height: 600 });
  const [, setOverlayVersion] = React.useState(0);
  const [hoveredId, setHoveredId] = React.useState<?string>(null);
  const [dropTarget, setDropTarget] = React.useState<?DropTarget>(null);
  const [editingId, setEditingId] = React.useState<?string>(null);
  const [resizeInfo, setResizeInfo] = React.useState<?{| width: number, height: number |}>(null);
  const [guides, setGuides] = React.useState<Array<Guide>>([]);
  const [dragHint, setDragHint] = React.useState<?string>(null);
  const editingIdRef = React.useRef<?string>(null);
  editingIdRef.current = editingId;
  const reactStateRef = React.useRef<{| vendorLoaded: boolean, code: string, started: boolean |}>({
    vendorLoaded: false,
    code: '',
    started: false,
  });
  const srcDoc = React.useMemo(buildSrcDoc, []);
  const frameWidth = breakpoint.canvasWidth;
  const deviceHeight = DEVICE_HEIGHTS[breakpoint.id] || 800;
  // Height of the canvas: the height of the page. It does not change while an
  // element is resized or moved (the canvas stays still), and fits the page
  // again when the mouse is released.
  const [contentHeight, setContentHeight] = React.useState(deviceHeight);
  const isInteractingRef = React.useRef(false);
  React.useEffect(
    () => {
      setContentHeight(deviceHeight);
    },
    [deviceHeight, breakpoint.id]
  );

  // Information about the elements of the document.
  const infos = React.useMemo(
    () => {
      const map: { [string]: ElementInfo } = {};
      walkElements(root, (element, parent) => {
        const definition = getElementType(element.type);
        map[element.id] = {
          element,
          parentId: parent ? parent.id : null,
          isContainer: definition.isContainer && element.type !== 'component',
          inlineTextProp:
            definition.inlineEditableTextProp &&
            !(element.type === 'link' && element.children.length) &&
            !String(element.props[definition.inlineEditableTextProp] || '').includes('{{')
              ? definition.inlineEditableTextProp
              : null,
        };
      });
      return map;
    },
    [root]
  );
  const infosRef = React.useRef(infos);
  infosRef.current = infos;

  // Size of the workspace.
  React.useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const update = () => setAreaSize({ width: area.clientWidth, height: area.clientHeight });
    update();
    // $FlowFixMe[cannot-resolve-name]
    const observer = new ResizeObserver(update);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // Camera: position and scale of the page in the workspace.
  const getFitCamera = React.useCallback(
    (): Camera => {
      const fitScale = Math.min(1, Math.max(MIN_SCALE, (areaSize.width - 64) / frameWidth));
      const scale = typeof zoom === 'number' ? zoom : fitScale;
      return { scale, x: Math.max(32, (areaSize.width - frameWidth * scale) / 2), y: 32 };
    },
    [areaSize.width, frameWidth, zoom]
  );
  const [camera, setCamera] = React.useState<Camera>(() => getFitCamera());
  const cameraRef = React.useRef(camera);
  cameraRef.current = camera;
  const [isCameraMoved, setIsCameraMoved] = React.useState(false);
  const isCameraMovedRef = React.useRef(false);
  isCameraMovedRef.current = isCameraMoved;
  const resetCamera = React.useCallback(
    () => {
      setIsCameraMoved(false);
      setCamera(getFitCamera());
    },
    [getFitCamera]
  );
  // Reset the view when the breakpoint or the zoom (chosen in the toolbar) change.
  React.useEffect(
    () => {
      if (zoom === 'custom') return;
      resetCamera();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [breakpoint.id, zoom]
  );
  // Follow the size of the workspace, unless the user moved the view.
  React.useEffect(
    () => {
      if (!isCameraMovedRef.current) setCamera(getFitCamera());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areaSize.width]
  );

  const zoomAt = React.useCallback((areaX: number, areaY: number, deltaY: number) => {
    const current = cameraRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * Math.exp(-deltaY * 0.0015)));
    if (scale === current.scale) return;
    const pageX = (areaX - current.x) / current.scale;
    const pageY = (areaY - current.y) / current.scale;
    setCamera({ scale, x: areaX - pageX * scale, y: areaY - pageY * scale });
    setIsCameraMoved(true);
    propsRef.current.onCustomZoom(scale);
  }, []);

  // Moving the view with the middle mouse button.
  const [isPanning, setIsPanning] = React.useState(false);
  const startPan = React.useCallback((startScreenX: number, startScreenY: number) => {
    const startCamera = cameraRef.current;
    const iframe = iframeRef.current;
    const doc = iframe ? iframe.contentDocument : null;
    setIsPanning(true);
    setIsCameraMoved(true);
    if (doc && doc.body) doc.body.style.cursor = 'grabbing';
    const onMove = (event: MouseEvent) => {
      if (!(event.buttons & 4)) {
        onUp();
        return;
      }
      setCamera({
        ...startCamera,
        x: startCamera.x + event.screenX - startScreenX,
        y: startCamera.y + event.screenY - startScreenY,
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
      if (doc) {
        doc.removeEventListener('mousemove', onMove);
        doc.removeEventListener('mouseup', onUp);
        if (doc.body) doc.body.style.cursor = '';
      }
      setIsPanning(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onUp);
    if (doc) {
      doc.addEventListener('mousemove', onMove);
      doc.addEventListener('mouseup', onUp);
    }
  }, []);
  const startPanRef = React.useRef(startPan);
  startPanRef.current = startPan;

  // Zooming with the mouse wheel (on the workspace).
  React.useEffect(
    () => {
      const area = areaRef.current;
      if (!area) return;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const rect = area.getBoundingClientRect();
        const deltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        zoomAt(event.clientX - rect.left, event.clientY - rect.top, deltaY);
      };
      area.addEventListener('wheel', onWheel, { passive: false });
      return () => area.removeEventListener('wheel', onWheel);
    },
    [zoomAt]
  );

  const { scale } = camera;
  const scaleRef = React.useRef(scale);
  scaleRef.current = scale;

  const getDocument = (): ?Document => {
    const iframe = iframeRef.current;
    return iframe ? iframe.contentDocument : null;
  };
  const getWindow = (): any => {
    const iframe = iframeRef.current;
    return iframe ? iframe.contentWindow : null;
  };
  const getDomElement = (id: ?string): ?HTMLElement => {
    const doc = getDocument();
    if (!doc || !id) return null;
    return (doc.querySelector(`[data-wv-id="${id}"]`): any);
  };
  const refreshOverlay = React.useCallback(() => setOverlayVersion(version => version + 1), []);

  // The iframe is as tall as the page: measure it.
  const measureContent = React.useCallback(
    () => {
      const doc = getDocument();
      const rootContainer = doc ? doc.getElementById('wv-root') : null;
      if (!rootContainer || isInteractingRef.current) return;
      const height = Math.max(deviceHeight, Math.ceil(rootContainer.getBoundingClientRect().bottom));
      setContentHeight(previous => (Math.abs(height - previous) > 1 ? height : previous));
      refreshOverlay();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deviceHeight, refreshOverlay]
  );

  // Apply the rendered content to the iframe.
  React.useEffect(
    () => {
      if (!loaded || !content || editingId) return;
      const doc = getDocument();
      const win = getWindow();
      if (!doc || !win) return;
      const style = doc.getElementById('wv-site-css');
      const deviceStyle = doc.getElementById('wv-device-css');
      const rootContainer = doc.getElementById('wv-root');
      if (!style || !rootContainer || !deviceStyle) return;
      deviceStyle.textContent =
        `html,body{overflow:hidden!important}body{min-height:0!important}` +
        `.wv-page{min-height:${deviceHeight}px!important}`;
      style.textContent = pinViewportUnits(content.css, deviceHeight);
      rootContainer.innerHTML = content.html;
      // Mark empty containers so that elements can be dropped in them.
      Object.keys(infos).forEach(id => {
        const info = infos[id];
        if (info.isContainer && !info.element.children.length) {
          const node = doc.querySelector(`[data-wv-id="${id}"]`);
          if (node) node.classList.add('wv-editor-empty');
        }
      });
      // React components and bindings.
      const reactState = reactStateRef.current;
      const finish = () => {
        if (!win.Webvelop) return;
        if (!reactState.started) {
          win.Webvelop.configureSite({ name: '', pages: [], variables: propsRef.current.variables, globalEvents: [], components: {} });
          reactState.started = true;
          win.Webvelop.start({ mode: 'editor' });
        } else {
          win.Webvelop.mountReactComponents();
        }
        measureContent();
      };
      if (content.usesReact) {
        const injectCode = () => {
          if (reactState.code !== content.reactCode) {
            const script = doc.createElement('script');
            script.textContent = content.reactCode + '\n;Webvelop.resetReactComponents();';
            doc.body && doc.body.appendChild(script);
            reactState.code = content.reactCode;
          }
          finish();
        };
        if (!reactState.vendorLoaded) {
          getRuntimeSources().then(sources => {
            const currentDoc = getDocument();
            if (!currentDoc || !currentDoc.body) return;
            const script = currentDoc.createElement('script');
            script.textContent = sources.reactJs + '\n' + sources.reactDomJs;
            currentDoc.body.appendChild(script);
            reactState.vendorLoaded = true;
            injectCode();
          });
        } else injectCode();
      } else finish();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, content, editingId, infos, deviceHeight]
  );

  // Follow the size changes of the page (images loading, React components...).
  React.useEffect(
    () => {
      const doc = getDocument();
      const win = getWindow();
      const rootContainer = doc ? doc.getElementById('wv-root') : null;
      if (!loaded || !win || !rootContainer || !win.ResizeObserver) return;
      const observer = new win.ResizeObserver(() => measureContent());
      observer.observe(rootContainer);
      return () => observer.disconnect();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, measureContent]
  );

  // Body classes (outlines) and revealed hidden elements.
  React.useEffect(
    () => {
      const doc = getDocument();
      if (!loaded || !doc || !doc.body) return;
      doc.body.classList.toggle('wv-show-outlines', showOutlines);
      const revealed = new Set();
      if (selectedId) {
        let current = selectedId;
        while (current) {
          revealed.add(current);
          current = infos[current] ? infos[current].parentId : null;
        }
      }
      Array.from(doc.querySelectorAll('[data-wv-initially-hidden]')).forEach(node => {
        const id = node.getAttribute('data-wv-id');
        node.classList.toggle('wv-reveal', showHiddenElements || revealed.has(id) || !!node.querySelector(`[data-wv-id="${selectedId || '-'}"]`));
      });
      measureContent();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, content, showOutlines, showHiddenElements, selectedId, infos]
  );

  // Move the view to show the selected element, if it is outside of the workspace.
  React.useEffect(
    () => {
      const node = getDomElement(selectedId);
      if (!node) return;
      const r = node.getBoundingClientRect();
      const current = cameraRef.current;
      const top = current.y + r.top * current.scale;
      const bottom = current.y + r.bottom * current.scale;
      if (bottom < 0 || top > areaSize.height) {
        setCamera({ ...current, y: 80 - r.top * current.scale });
        setIsCameraMoved(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId]
  );

  React.useEffect(refreshOverlay, [camera, frameWidth, contentHeight, refreshOverlay]);

  // Drop target computation (in iframe coordinates).
  const computeDropTarget = React.useCallback((x: number, y: number, draggedId: ?string): ?DropTarget => {
    const doc = getDocument();
    const win = getWindow();
    if (!doc || !win) return null;
    const currentInfos = infosRef.current;
    const rootId = propsRef.current.root.id;
    let node: any = doc.elementFromPoint(Math.max(0, x), Math.max(0, y));
    node = node && node.closest ? node.closest('[data-wv-id]') : null;
    if (draggedId && node) {
      const dragged = node.closest(`[data-wv-id="${draggedId}"]`);
      if (dragged) node = dragged.parentElement ? dragged.parentElement.closest('[data-wv-id]') : null;
    }
    if (!node) node = doc.querySelector(`[data-wv-id="${rootId}"]`);
    if (!node) return null;
    const id = node.getAttribute('data-wv-id');
    const info = currentInfos[id];
    if (!info) return null;

    const getAxis = (container: HTMLElement) => {
      const style = win.getComputedStyle(container);
      if (/grid/.test(style.display)) return 'grid';
      if (/flex/.test(style.display) && /row/.test(style.flexDirection)) return 'x';
      return 'y';
    };
    const childrenOf = (container: HTMLElement) =>
      Array.from(container.children).filter((child: any) => child.hasAttribute && child.hasAttribute('data-wv-id'));
    const rectOf = (element: HTMLElement) => element.getBoundingClientRect();

    const lineFor = (container: HTMLElement, children: Array<any>, index: number, axis: string) => {
      const containerRect = rectOf(container);
      const visible = children.filter(child => rectOf(child).width || rectOf(child).height);
      if (!visible.length) return null;
      const before = index > 0 ? children[index - 1] : null;
      const after = index < children.length ? children[index] : null;
      if (axis === 'x') {
        const reference = after || before;
        const r = rectOf(reference);
        const left = after ? r.left - 2 : r.right;
        return { left, top: r.top, width: 3, height: r.height };
      }
      const reference = after || before;
      const r = rectOf(reference);
      const top = after ? (before ? (rectOf(before).bottom + r.top) / 2 : r.top) - 1 : r.bottom + 1;
      return {
        left: axis === 'grid' ? r.left : containerRect.left + 4,
        top,
        width: axis === 'grid' ? r.width : containerRect.width - 8,
        height: 3,
      };
    };

    const siblingTarget = (element: HTMLElement): ?DropTarget => {
      const parent: any = element.parentElement ? element.parentElement.closest('[data-wv-id]') : null;
      if (!parent) return null;
      const parentId = parent.getAttribute('data-wv-id');
      if (!currentInfos[parentId] || !currentInfos[parentId].isContainer) return null;
      const siblings = childrenOf(parent);
      const index = siblings.indexOf(element);
      const axis = getAxis(parent);
      const r = rectOf(element);
      const after = axis === 'x' || (axis === 'grid' && y >= r.top && y <= r.bottom) ? x > r.left + r.width / 2 : y > r.top + r.height / 2;
      const insertIndex = index + (after ? 1 : 0);
      return { parentId, index: insertIndex, line: lineFor(parent, siblings, insertIndex, axis), container: null };
    };

    if (info.isContainer) {
      const r = rectOf(node);
      const nearEdge =
        id !== rootId &&
        (y - r.top < EDGE_SIZE || r.bottom - y < EDGE_SIZE || x - r.left < EDGE_SIZE || r.right - x < EDGE_SIZE);
      if (nearEdge) {
        const target = siblingTarget(node);
        if (target) return target;
      }
      const children = childrenOf(node);
      const axis = getAxis(node);
      let index = children.length;
      for (let i = 0; i < children.length; i++) {
        const childRect = rectOf(children[i]);
        if (!childRect.width && !childRect.height) continue;
        let isBefore;
        if (axis === 'x') isBefore = x < childRect.left + childRect.width / 2;
        else if (axis === 'grid')
          isBefore = y < childRect.top || (y <= childRect.bottom && x < childRect.left + childRect.width / 2);
        else isBefore = y < childRect.top + childRect.height / 2;
        if (isBefore) {
          index = i;
          break;
        }
      }
      return {
        parentId: id,
        index,
        line: children.length ? lineFor(node, children, index, axis) : null,
        container: { left: r.left, top: r.top, width: r.width, height: r.height },
      };
    }
    return siblingTarget(node);
  }, []);

  // Dragging elements: free move with snapping (default), or move in the layout (Alt).
  const dragRef = React.useRef<?{|
    id: string,
    node: HTMLElement,
    startX: number,
    startY: number,
    started: boolean,
    mode: 'move' | 'layout',
    position: string,
    startLeft: number,
    startTop: number,
    startRect: Rect,
    snapXs: Array<{| value: number, center: boolean, rect: Rect |}>,
    snapYs: Array<{| value: number, center: boolean, rect: Rect |}>,
    lastLeft: number,
    lastTop: number,
  |}>(null);

  const toFrameCoordinates = (clientX: number, clientY: number) => {
    const iframe = iframeRef.current;
    if (!iframe) return { x: 0, y: 0 };
    const rect = iframe.getBoundingClientRect();
    return { x: (clientX - rect.left) / scaleRef.current, y: (clientY - rect.top) / scaleRef.current };
  };

  /** Lines on which a moved element can snap: centers and edges of its parent, siblings and the page. */
  const computeSnapLines = (node: HTMLElement) => {
    const doc = getDocument();
    const xs = [];
    const ys = [];
    const add = (r: Rect) => {
      if (!r.width && !r.height) return;
      xs.push({ value: r.left, center: false, rect: r }, { value: r.left + r.width / 2, center: true, rect: r }, { value: r.left + r.width, center: false, rect: r });
      ys.push({ value: r.top, center: false, rect: r }, { value: r.top + r.height / 2, center: true, rect: r }, { value: r.top + r.height, center: false, rect: r });
    };
    const toRect = (element: HTMLElement): Rect => {
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const parent: any = node.parentElement ? node.parentElement.closest('[data-wv-id]') : null;
    if (parent) {
      add(toRect(parent));
      Array.from(parent.children).forEach((child: any) => {
        if (child !== node && child.hasAttribute && child.hasAttribute('data-wv-id')) add(toRect(child));
      });
    }
    // Center of the page.
    if (doc && doc.documentElement) {
      const pageWidth = doc.documentElement.clientWidth;
      xs.push({ value: pageWidth / 2, center: true, rect: { left: 0, top: 0, width: pageWidth, height: contentHeight } });
    }
    return { xs, ys };
  };

  const updateFreeMove = (x: number, y: number, disableSnapping: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    let dx = x - drag.startX;
    let dy = y - drag.startY;
    const newGuides = [];
    if (!disableSnapping) {
      const threshold = SNAP_DISTANCE / scaleRef.current;
      const r = drag.startRect;
      const anchorsX = [r.left + dx, r.left + dx + r.width / 2, r.left + dx + r.width];
      const anchorsY = [r.top + dy, r.top + dy + r.height / 2, r.top + dy + r.height];
      let bestX = null;
      drag.snapXs.forEach(line => {
        anchorsX.forEach((anchor, index) => {
          const distance = Math.abs(line.value - anchor);
          if (distance <= threshold && (!bestX || distance < bestX.distance))
            bestX = { distance, correction: line.value - anchor, line, isCenter: index === 1 };
        });
      });
      let bestY = null;
      drag.snapYs.forEach(line => {
        anchorsY.forEach((anchor, index) => {
          const distance = Math.abs(line.value - anchor);
          if (distance <= threshold && (!bestY || distance < bestY.distance))
            bestY = { distance, correction: line.value - anchor, line, isCenter: index === 1 };
        });
      });
      if (bestX) dx += bestX.correction;
      if (bestY) dy += bestY.correction;
      const moved = { left: r.left + dx, top: r.top + dy, width: r.width, height: r.height };
      if (bestX) {
        const target = bestX.line.rect;
        newGuides.push({
          x1: bestX.line.value,
          x2: bestX.line.value,
          y1: Math.min(target.top, moved.top) - 8,
          y2: Math.max(target.top + target.height, moved.top + moved.height) + 8,
          center: bestX.line.center && bestX.isCenter,
        });
      }
      if (bestY) {
        const target = bestY.line.rect;
        newGuides.push({
          y1: bestY.line.value,
          y2: bestY.line.value,
          x1: Math.min(target.left, moved.left) - 8,
          x2: Math.max(target.left + target.width, moved.left + moved.width) + 8,
          center: bestY.line.center && bestY.isCenter,
        });
      }
    }
    drag.lastLeft = Math.round(drag.startLeft + dx);
    drag.lastTop = Math.round(drag.startTop + dy);
    drag.node.style.position = drag.position;
    drag.node.style.left = drag.lastLeft + 'px';
    drag.node.style.top = drag.lastTop + 'px';
    setGuides(newGuides);
    refreshOverlay();
  };

  const startInlineEditing = (id: string) => {
    const info = infosRef.current[id];
    const node = getDomElement(id);
    if (!info || !info.inlineTextProp || !node) return;
    const textNode: any = node.querySelector(':scope > .wv-label') || node;
    setEditingId(id);
    textNode.setAttribute('contenteditable', 'true');
    textNode.focus();
    const doc = getDocument();
    const win = getWindow();
    if (doc && win) {
      const range = doc.createRange();
      range.selectNodeContents(textNode);
      const selection = win.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    let cancelled = false;
    const finish = () => {
      textNode.removeEventListener('blur', finish);
      textNode.removeEventListener('keydown', onKey);
      textNode.removeAttribute('contenteditable');
      const text = (textNode.innerText || '').replace(/\n$/, '');
      setEditingId(null);
      if (!cancelled) propsRef.current.onCommitText(id, text);
    };
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        cancelled = true;
        textNode.blur();
      } else if (e.key === 'Enter' && !(info.element.type === 'text' && e.shiftKey)) {
        e.preventDefault();
        textNode.blur();
      }
    };
    textNode.addEventListener('blur', finish);
    textNode.addEventListener('keydown', onKey);
  };

  React.useEffect(
    () => {
      if (!loaded) return;
      const doc = getDocument();
      const win = getWindow();
      if (!doc || !win) return;

      const onMove = (x: number, y: number, event: MouseEvent) => {
        const drag = dragRef.current;
        if (drag && !(event.buttons & 1)) {
          onUp(x, y);
          return;
        }
        if (drag) {
          if (!drag.started && Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD / scaleRef.current) {
            drag.started = true;
            isInteractingRef.current = true;
            if (event.altKey) drag.mode = 'layout';
            if (doc.body) doc.body.classList.add('wv-moving');
            setDragHint(
              drag.mode === 'layout'
                ? 'Moving in the layout: release where the pink line shows'
                : 'Alt + drag: move in the layout · Hold Ctrl: no snapping'
            );
          }
          if (!drag.started) return;
          if (drag.mode === 'move') updateFreeMove(x, y, event.ctrlKey || event.metaKey);
          else setDropTarget(computeDropTarget(x, y, drag.id));
          return;
        }
        const target: any = doc.elementFromPoint(x, y);
        const node = target && target.closest ? target.closest('[data-wv-id]') : null;
        const id = node ? node.getAttribute('data-wv-id') : null;
        setHoveredId(previous => (previous === id ? previous : id));
      };
      const onUp = (x: number, y: number) => {
        const drag = dragRef.current;
        dragRef.current = null;
        isInteractingRef.current = false;
        window.removeEventListener('mousemove', onParentMove);
        window.removeEventListener('mouseup', onParentUp);
        if (doc.body) doc.body.classList.remove('wv-moving');
        setGuides([]);
        setDragHint(null);
        setDropTarget(null);
        if (!drag || !drag.started) return;
        if (drag.mode === 'move') {
          propsRef.current.onResize(
            drag.id,
            { position: drag.position, left: drag.lastLeft + 'px', top: drag.lastTop + 'px' },
            'move-' + drag.id + '-' + Date.now()
          );
          return;
        }
        const target = computeDropTarget(x, y, drag.id);
        if (target) propsRef.current.onMoveElement(drag.id, target.parentId, target.index);
      };
      const onParentMove = (e: MouseEvent) => {
        const { x, y } = toFrameCoordinates(e.clientX, e.clientY);
        onMove(x, y, e);
      };
      const onParentUp = (e: MouseEvent) => {
        const { x, y } = toFrameCoordinates(e.clientX, e.clientY);
        onUp(x, y);
      };

      const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY, e);
      const handleMouseUp = (e: MouseEvent) => onUp(e.clientX, e.clientY);
      const handleMouseDown = (e: MouseEvent) => {
        const target: any = e.target;
        if (editingIdRef.current && target.closest && target.closest('[contenteditable="true"]')) return;
        if (e.button === 1) {
          // Middle button: move the view (and prevent the browser auto-scroll).
          e.preventDefault();
          startPanRef.current(e.screenX, e.screenY);
          return;
        }
        if (e.button !== 0) return;
        e.preventDefault();
        if (doc.activeElement && doc.activeElement.blur) (doc.activeElement: any).blur();
        const node = target && target.closest ? target.closest('[data-wv-id]') : null;
        const id = node ? node.getAttribute('data-wv-id') : null;
        propsRef.current.onSelect(id);
        if (!id || id === propsRef.current.root.id || !node) return;
        const element = infosRef.current[id] ? infosRef.current[id].element : null;
        if (element && element.locked) return;
        const style = win.getComputedStyle(node);
        const isPositioned = style.position === 'absolute' || style.position === 'fixed';
        const rect = node.getBoundingClientRect();
        const { xs, ys } = computeSnapLines(node);
        const startLeft = isPositioned ? parseFloat(style.left) || node.offsetLeft : parseFloat(style.left) || 0;
        const startTop = isPositioned ? parseFloat(style.top) || node.offsetTop : parseFloat(style.top) || 0;
        dragRef.current = {
          id,
          node,
          startX: e.clientX,
          startY: e.clientY,
          started: false,
          mode: e.altKey ? 'layout' : 'move',
          // Elements in the flow are moved with relative offsets: the rest of
          // the layout (siblings, height of the parent) does not change.
          position: isPositioned ? style.position : 'relative',
          startLeft,
          startTop,
          startRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          snapXs: xs,
          snapYs: ys,
          lastLeft: startLeft,
          lastTop: startTop,
        };
        window.addEventListener('mousemove', onParentMove);
        window.addEventListener('mouseup', onParentUp);
      };
      const handleDoubleClick = (e: MouseEvent) => {
        const target: any = e.target;
        const node = target && target.closest ? target.closest('[data-wv-id]') : null;
        if (node) startInlineEditing(node.getAttribute('data-wv-id'));
      };
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        const target: any = e.target;
        const node = target && target.closest ? target.closest('[data-wv-id]') : null;
        const id = node ? node.getAttribute('data-wv-id') : null;
        if (!id) return;
        propsRef.current.onSelect(id);
        const iframe = iframeRef.current;
        if (!iframe) return;
        const rect = iframe.getBoundingClientRect();
        propsRef.current.onContextMenu(id, rect.left + e.clientX * scaleRef.current, rect.top + e.clientY * scaleRef.current);
      };
      const preventDefault = (e: Event) => {
        const target: any = e.target;
        if (target && target.closest && target.closest('[contenteditable="true"]')) return;
        e.preventDefault();
      };
      const handleWheel = (e: WheelEvent) => {
        // Zoom the view (the wheel never scrolls the page: it is shown entirely).
        e.preventDefault();
        const current = cameraRef.current;
        const deltaY = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(current.x + e.clientX * current.scale, current.y + e.clientY * current.scale, deltaY);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (editingIdRef.current) return;
        propsRef.current.onKeyDown(e);
      };
      const handleMouseLeave = () => setHoveredId(null);

      doc.addEventListener('mousemove', handleMouseMove);
      doc.addEventListener('mouseup', handleMouseUp);
      doc.addEventListener('mousedown', handleMouseDown);
      doc.addEventListener('auxclick', preventDefault, true);
      doc.addEventListener('dblclick', handleDoubleClick);
      doc.addEventListener('contextmenu', handleContextMenu);
      doc.addEventListener('click', preventDefault, true);
      doc.addEventListener('submit', preventDefault, true);
      doc.addEventListener('wheel', handleWheel, { passive: false });
      doc.addEventListener('keydown', handleKeyDown);
      doc.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        doc.removeEventListener('mousemove', handleMouseMove);
        doc.removeEventListener('mouseup', handleMouseUp);
        doc.removeEventListener('mousedown', handleMouseDown);
        doc.removeEventListener('auxclick', preventDefault, true);
        doc.removeEventListener('dblclick', handleDoubleClick);
        doc.removeEventListener('contextmenu', handleContextMenu);
        doc.removeEventListener('click', preventDefault, true);
        doc.removeEventListener('submit', preventDefault, true);
        doc.removeEventListener('wheel', handleWheel);
        doc.removeEventListener('keydown', handleKeyDown);
        doc.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('mousemove', onParentMove);
        window.removeEventListener('mouseup', onParentUp);
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, computeDropTarget, refreshOverlay, zoomAt, contentHeight]
  );

  // Inserting elements dragged from the Insert panel.
  const onCaptureMove = (e: SyntheticMouseEvent<>) => {
    const { x, y } = toFrameCoordinates(e.clientX, e.clientY);
    setDropTarget(computeDropTarget(x, y, null));
  };
  const onCaptureUp = (e: SyntheticMouseEvent<>) => {
    const { x, y } = toFrameCoordinates(e.clientX, e.clientY);
    const target = computeDropTarget(x, y, null);
    setDropTarget(null);
    if (target) props.onInsert(target.parentId, target.index);
  };
  React.useEffect(
    () => {
      if (!isInserting) setDropTarget(null);
    },
    [isInserting]
  );

  // Resizing with the handles. The size is applied to the element on screen
  // while dragging, and saved once (one undo step) when the mouse is released.
  const [resizeCursor, setResizeCursor] = React.useState<?string>(null);
  const startResize = (e: SyntheticMouseEvent<>, direction: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const id = selectedId;
    const node = getDomElement(id);
    const win = getWindow();
    const info = id ? infosRef.current[id] : null;
    if (!id || !node || !win || !info) return;
    const style = win.getComputedStyle(node);
    const parentStyle = node.parentElement ? win.getComputedStyle(node.parentElement) : null;
    const isPositioned = style.position === 'absolute' || style.position === 'fixed';
    const startLeft = isPositioned ? parseFloat(style.left) || node.offsetLeft : parseFloat(style.left) || 0;
    const startTop = isPositioned ? parseFloat(style.top) || node.offsetTop : parseFloat(style.top) || 0;
    const domRect = node.getBoundingClientRect();
    const rect = { left: domRect.left, top: domRect.top, right: domRect.right, bottom: domRect.bottom };
    const ratio = domRect.width / Math.max(1, domRect.height);
    const keepsRatio = ['image', 'video', 'icon'].includes(info.element.type);
    const isCorner = direction.length === 2;
    const { xs, ys } = computeSnapLines(node);
    const parentIsFlex = !!parentStyle && /flex/.test(parentStyle.display);
    const parentIsRow = parentIsFlex && !!parentStyle && /row/.test(parentStyle.flexDirection);
    const maxWidth = parseFloat(style.maxWidth);
    const maxHeight = parseFloat(style.maxHeight);
    const minWidth = parseFloat(style.minWidth) || 0;
    const minHeight = parseFloat(style.minHeight) || 0;
    const startX = e.clientX;
    const startY = e.clientY;
    const original = {
      position: node.style.position,
      left: node.style.left,
      top: node.style.top,
      width: node.style.width,
      height: node.style.height,
      maxWidth: node.style.maxWidth,
      maxHeight: node.style.maxHeight,
      minWidth: node.style.minWidth,
      minHeight: node.style.minHeight,
      flex: node.style.flex,
    };
    let changes: { [string]: string } = {};
    isInteractingRef.current = true;
    setResizeCursor(window.getComputedStyle(e.currentTarget).cursor || 'nwse-resize');

    const snap = (value: number, lines: Array<any>, threshold: number) => {
      let best = null;
      lines.forEach(line => {
        const distance = Math.abs(line.value - value);
        if (distance <= threshold && (!best || distance < best.distance)) best = { distance, line };
      });
      return best;
    };

    const apply = (event: MouseEvent) => {
      const scaleNow = scaleRef.current;
      const dx = (event.clientX - startX) / scaleNow;
      const dy = (event.clientY - startY) / scaleNow;
      let { left, top, right, bottom } = rect;
      if (direction.includes('e')) right += dx;
      if (direction.includes('w')) left += dx;
      if (direction.includes('s')) bottom += dy;
      if (direction.includes('n')) top += dy;
      const newGuides = [];
      if (!(event.ctrlKey || event.metaKey)) {
        const threshold = SNAP_DISTANCE / scaleNow;
        const snapEdge = (value: number, lines: Array<any>, vertical: boolean) => {
          const best = snap(value, lines, threshold);
          if (!best) return value;
          const target = best.line.rect;
          newGuides.push(
            vertical
              ? { x1: best.line.value, x2: best.line.value, y1: Math.min(target.top, top) - 8, y2: Math.max(target.top + target.height, bottom) + 8, center: false }
              : { y1: best.line.value, y2: best.line.value, x1: Math.min(target.left, left) - 8, x2: Math.max(target.left + target.width, right) + 8, center: false }
          );
          return best.line.value;
        };
        if (direction.includes('e')) right = snapEdge(right, xs, true);
        if (direction.includes('w')) left = snapEdge(left, xs, true);
        if (direction.includes('s')) bottom = snapEdge(bottom, ys, false);
        if (direction.includes('n')) top = snapEdge(top, ys, false);
      }
      let width = Math.max(8, right - left);
      let height = Math.max(8, bottom - top);
      if (direction.includes('w')) left = right - width;
      if (direction.includes('n')) top = bottom - height;
      // Corners keep the proportions of images, videos and icons (Shift: free).
      if (keepsRatio && isCorner && !event.shiftKey) {
        height = width / ratio;
        if (direction.includes('n')) top = bottom - height;
      }

      const newChanges = {};
      const changesWidth = direction.includes('e') || direction.includes('w');
      const changesHeight = direction.includes('s') || direction.includes('n') || (keepsRatio && isCorner);
      if (changesWidth) {
        newChanges.width = Math.round(width) + 'px';
        if (!isNaN(maxWidth) && width > maxWidth) newChanges.maxWidth = 'none';
        if (width < minWidth) newChanges.minWidth = '0';
      }
      if (changesHeight) {
        newChanges.height = Math.round(height) + 'px';
        if (!isNaN(maxHeight) && height > maxHeight) newChanges.maxHeight = 'none';
        if (height < minHeight) newChanges.minHeight = '0';
      }
      // In a flex layout, the size along the main axis is controlled by "flex".
      if (parentIsFlex && ((parentIsRow && changesWidth) || (!parentIsRow && changesHeight))) {
        newChanges.flex = '0 0 auto';
      }
      // Resizing from the left or the top moves the element.
      if (direction.includes('w') || direction.includes('n')) {
        newChanges.position = isPositioned ? style.position : 'relative';
        if (direction.includes('w')) newChanges.left = Math.round(startLeft + (left - rect.left)) + 'px';
        if (direction.includes('n')) newChanges.top = Math.round(startTop + (top - rect.top)) + 'px';
      }
      changes = newChanges;
      Object.keys(newChanges).forEach(property => {
        // $FlowFixMe[prop-missing]
        node.style[property] = newChanges[property];
      });
      setGuides(newGuides);
      setResizeInfo({ width: Math.round(width), height: Math.round(height) });
      refreshOverlay();
    };

    const finish = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', finish);
      window.removeEventListener('blur', finish);
      isInteractingRef.current = false;
      setResizeCursor(null);
      setResizeInfo(null);
      setGuides([]);
      // Restore the inline styles: the saved styles are rendered from the project.
      Object.keys(original).forEach(property => {
        // $FlowFixMe[prop-missing]
        node.style[property] = original[property];
      });
      if (Object.keys(changes).length) {
        propsRef.current.onResize(id, changes, 'resize-' + id + '-' + Date.now());
      }
      refreshOverlay();
    };
    const onMove = (event: MouseEvent) => {
      // The button was released outside of the window: stop resizing.
      if (!(event.buttons & 1)) {
        finish();
        return;
      }
      apply(event);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', finish);
    window.addEventListener('blur', finish);
  };

  // Overlay boxes.
  const toAreaRect = (r: { left: number, top: number, width: number, height: number }) => ({
    left: camera.x + r.left * scale,
    top: camera.y + r.top * scale,
    width: r.width * scale,
    height: r.height * scale,
  });
  const boxFor = (id: ?string) => {
    const node = getDomElement(id);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return toAreaRect(r);
  };
  const isDragging = !!(dragRef.current && dragRef.current.started);
  const selectionBox = loaded ? boxFor(selectedId) : null;
  const hoverBox = loaded && hoveredId && hoveredId !== selectedId && !dragRef.current ? boxFor(hoveredId) : null;
  const selectedInfo = selectedId ? infos[selectedId] : null;
  const isRootSelected = selectedId === root.id;
  const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  return (
    <div
      className="wve-canvas-area"
      ref={areaRef}
      style={{ cursor: isPanning ? 'grabbing' : undefined }}
      onMouseDown={e => {
        if (e.button === 1) {
          e.preventDefault();
          startPan(e.screenX, e.screenY);
        } else if (e.button === 0 && e.target === areaRef.current) {
          // Clicking the empty workspace selects the page body.
          props.onSelect(null);
        }
      }}
      onAuxClick={e => e.preventDefault()}
    >
      <div className="wve-canvas-size-label" style={{ left: camera.x, top: camera.y - 22 }}>
        {breakpoint.label} — {frameWidth}px · {Math.round(scale * 100)}%
      </div>
      <div
        className="wve-canvas-frame-container"
        style={{
          left: camera.x,
          top: camera.y,
          width: frameWidth,
          height: contentHeight,
          transform: `scale(${scale})`,
        }}
      >
        <iframe
          ref={iframeRef}
          title="Page canvas"
          srcDoc={srcDoc}
          width={frameWidth}
          height={contentHeight}
          scrolling="no"
          onLoad={() => {
            reactStateRef.current = { vendorLoaded: false, code: '', started: false };
            setLoaded(true);
          }}
        />
      </div>
      <div className="wve-overlay">
        {hoverBox && <div className="wve-overlay-box wve-overlay-hover" style={hoverBox} />}
        {selectionBox && selectedInfo && (
          <div
            className={`wve-overlay-box wve-overlay-selection ${selectedInfo.element.locked ? 'wve-locked' : ''}`}
            style={selectionBox}
          >
            {!isDragging && (
              <div className={`wve-overlay-tag ${selectionBox.top < 24 ? 'wve-below' : ''}`}>
                <span>{selectedInfo.element.name}</span>
                {!isRootSelected && (
                  <>
                    <button title="Select the parent (Escape)" onClick={() => onToolbarAction('parent')}>
                      <ArrowTopThenLeft />
                    </button>
                    <button title="Move before" onClick={() => onToolbarAction('up')}>
                      <ArrowTop />
                    </button>
                    <button title="Move after" onClick={() => onToolbarAction('down')}>
                      <ArrowBottom />
                    </button>
                    <button title="Duplicate (Ctrl+D)" onClick={() => onToolbarAction('duplicate')}>
                      <Copy />
                    </button>
                    <button title="Delete (Delete)" onClick={() => onToolbarAction('delete')}>
                      <Trash />
                    </button>
                  </>
                )}
              </div>
            )}
            {!isRootSelected &&
              !isDragging &&
              !selectedInfo.element.locked &&
              handles.map(direction => (
                <div
                  key={direction}
                  className={`wve-handle wve-handle-${direction}`}
                  onMouseDown={e => startResize(e, direction)}
                />
              ))}
            {resizeInfo && (
              <div className="wve-size-tooltip">
                {resizeInfo.width} × {resizeInfo.height}
              </div>
            )}
          </div>
        )}
        {guides.map((guide, index) => {
          const start = toAreaRect({ left: guide.x1, top: guide.y1, width: 0, height: 0 });
          const end = toAreaRect({ left: guide.x2, top: guide.y2, width: 0, height: 0 });
          const vertical = guide.x1 === guide.x2;
          return (
            <div
              key={index}
              className={`wve-snap-guide ${guide.center ? 'wve-snap-center' : ''}`}
              style={
                vertical
                  ? { left: start.left, top: start.top, width: 1, height: end.top - start.top }
                  : { left: start.left, top: start.top, width: end.left - start.left, height: 1 }
              }
            />
          );
        })}
        {dropTarget && dropTarget.container && (
          <div className="wve-drop-container" style={toAreaRect(dropTarget.container)} />
        )}
        {dropTarget && dropTarget.line && <div className="wve-drop-indicator" style={toAreaRect(dropTarget.line)} />}
        {isInserting && (
          <div className="wve-capture-layer" onMouseMove={onCaptureMove} onMouseUp={onCaptureUp} />
        )}
      </div>
      {dragHint && <div className="wve-canvas-hint">{dragHint}</div>}
      {resizeCursor && (
        // While resizing, catch all the mouse events (even above the page).
        <div className="wve-resize-capture" style={{ cursor: resizeCursor }} />
      )}
      {resizeInfo && (
        <div className="wve-canvas-hint">
          {resizeInfo.width} × {resizeInfo.height} px · Shift: free proportions · Ctrl: no snapping
        </div>
      )}
      {isCameraMoved && !isPanning && (
        <button
          className="wve-canvas-recenter"
          title="Show the page entirely again"
          onClick={() => {
            resetCamera();
            props.onCustomZoom(null);
          }}
        >
          Reset the view
        </button>
      )}
    </div>
  );
};

export default WebsiteCanvas;
