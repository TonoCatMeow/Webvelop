// @flow
// Pick an element by clicking on it in a preview of the page (like the object
// selector of the original editor, but for the elements of websites).
import * as React from 'react';
import Dialog from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { type WebsiteElement, type WebsiteProject } from '../../Website/Model/Schema';
import { type DocumentRef, getDocument } from '../../Website/Model/ProjectOps';
import { buildCanvasContent } from '../../Website/Rendering/SiteBuilder';
import { getRuntimeCss } from '../../Website/Services/RuntimeSources';
import { walkElements, findElement } from '../../Website/Model/Tree';
import { getElementType } from '../../Website/Elements/ElementTypes';
import { ElementIcon } from '../ElementIcons';
import { SelectInput, TextInput } from './Fields';

export type PickedElement = {| id: string, name: string, docRef: DocumentRef |};

/** Find the page or component whose tree contains this root element. */
export const findDocumentRefByRootId = (project: WebsiteProject, rootId: ?string): ?DocumentRef => {
  if (!rootId) return null;
  const page = project.pages.find(p => p.root.id === rootId);
  if (page) return { kind: 'page', id: page.id };
  const component = project.components.find(c => c.root.id === rootId);
  if (component) return { kind: 'component', id: component.id };
  return null;
};

const PICKER_CSS = `
html,body{overflow:hidden!important}
*{cursor:pointer!important}
[data-wv-initially-hidden]{display:none!important}
iframe,video,.wv-embed *{pointer-events:none!important}
.wv-pick-hover{outline:3px solid #6366f1!important;outline-offset:-2px;box-shadow:0 0 0 9999px rgba(15,15,30,.18)!important}
.wv-pick-selected{outline:3px solid #ec4899!important;outline-offset:-2px}
`;

type Props = {|
  title?: string,
  /** The page or component shown first (the user can choose another one, unless locked). */
  initialDocRef?: ?DocumentRef,
  lockDocument?: boolean,
  selectedId?: ?string,
  onPick: (element: PickedElement) => void,
  onClose: () => void,
|};

const ElementPickerDialog = ({ title, initialDocRef, lockDocument, selectedId, onPick, onClose }: Props) => {
  const { project, resolveAssetUrl } = useWebsiteEditor();
  const [docRef, setDocRef] = React.useState<DocumentRef>(
    initialDocRef || { kind: 'page', id: project.settings.homePageId || (project.pages[0] ? project.pages[0].id : '') }
  );
  const [hovered, setHovered] = React.useState<?WebsiteElement>(null);
  const [search, setSearch] = React.useState('');
  const [frameHeight, setFrameHeight] = React.useState(800);
  const [stageWidth, setStageWidth] = React.useState(700);
  const stageRef = React.useRef<?HTMLDivElement>(null);
  const iframeRef = React.useRef<?HTMLIFrameElement>(null);
  const document = getDocument(project, docRef);
  const root = document ? document.root : null;

  const srcDoc = React.useMemo(
    () => {
      const content = buildCanvasContent(project, docRef, resolveAssetUrl);
      if (!content) return '<!DOCTYPE html><p>Nothing to show.</p>';
      return (
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getRuntimeCss()}</style>` +
        `<style>${content.css.replace(/(-?\d*\.?\d+)(d|s|l)?vh\b/g, (m, v) => `${(parseFloat(v) * 800) / 100}px`)}</style>` +
        `<style>${PICKER_CSS}</style></head><body>${content.html}</body></html>`
      );
    },
    [project, docRef, resolveAssetUrl]
  );

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setStageWidth(stage.clientWidth - 24);
    update();
    // $FlowFixMe[cannot-resolve-name]
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const highlight = React.useCallback((id: ?string, className: string) => {
    const iframe = iframeRef.current;
    const doc = iframe ? iframe.contentDocument : null;
    if (!doc) return;
    Array.from(doc.querySelectorAll('.' + className)).forEach(node => node.classList.remove(className));
    if (id) {
      const node = doc.querySelector(`[data-wv-id="${id}"]`);
      if (node) node.classList.add(className);
    }
  }, []);

  const pick = (id: string) => {
    if (!root) return;
    const element = findElement(root, id);
    if (!element || id === root.id) return;
    onPick({ id, name: element.name, docRef });
  };
  const pickRef = React.useRef(pick);
  pickRef.current = pick;

  const onFrameLoad = () => {
    const iframe = iframeRef.current;
    const doc = iframe ? iframe.contentDocument : null;
    if (!doc || !doc.body) return;
    setFrameHeight(Math.max(400, doc.body.scrollHeight));
    highlight(selectedId, 'wv-pick-selected');
    doc.addEventListener('mousemove', (e: MouseEvent) => {
      const target: any = e.target;
      const node = target && target.closest ? target.closest('[data-wv-id]') : null;
      const id = node ? node.getAttribute('data-wv-id') : null;
      highlight(id && root && id !== root.id ? id : null, 'wv-pick-hover');
      setHovered(id && root ? findElement(root, id) : null);
    });
    doc.addEventListener('mouseleave', () => {
      highlight(null, 'wv-pick-hover');
      setHovered(null);
    });
    doc.addEventListener(
      'click',
      (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const target: any = e.target;
        const node = target && target.closest ? target.closest('[data-wv-id]') : null;
        if (node) pickRef.current(node.getAttribute('data-wv-id'));
      },
      true
    );
  };

  const scale = Math.min(1, stageWidth / 1280);
  const listItems = [];
  if (root) {
    walkElements(root, (element, parent, depth) => {
      if (depth === 0) return;
      if (search && !element.name.toLowerCase().includes(search.toLowerCase())) return;
      listItems.push({ element, depth });
    });
  }

  return (
    <Dialog
      open
      title={title || 'Pick an element'}
      maxWidth="lg"
      fullHeight
      flexColumnBody
      onRequestClose={onClose}
      disableEnforceFocus
      actions={[<FlatButton key="cancel" label="Cancel" onClick={onClose} />]}
    >
      <div className="wve-picker">
        <div className="wve-picker-side">
          {!lockDocument && (
            <SelectInput
              value={`${docRef.kind}:${docRef.id}`}
              onChange={value => {
                const [kind, id] = value.split(':');
                setDocRef({ kind: (kind: any), id });
              }}
              options={[
                ...project.pages.map(p => ({ value: `page:${p.id}`, label: `Page: ${p.name}` })),
                ...project.components.map(c => ({ value: `component:${c.id}`, label: `Component: ${c.name}` })),
              ]}
            />
          )}
          <TextInput value={search} onChange={setSearch} onLiveChange={setSearch} placeholder="Search by name..." />
          <div className="wve-picker-list">
            {listItems.map(({ element, depth }) => (
              <div
                key={element.id}
                className={`wve-tree-row ${element.id === selectedId ? 'wve-selected' : ''}`}
                style={{ paddingLeft: 6 + (depth - 1) * 12 }}
                onMouseEnter={() => highlight(element.id, 'wv-pick-hover')}
                onMouseLeave={() => highlight(null, 'wv-pick-hover')}
                onClick={() => pick(element.id)}
              >
                <span className="wve-tree-icon">
                  <ElementIcon name={getElementType(element.type).icon} />
                </span>
                <span className="wve-tree-name">{element.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="wve-picker-stage" ref={stageRef}>
          <div className="wve-picker-hint">
            {hovered && root && hovered.id !== root.id
              ? `Click to pick "${hovered.name}" (${getElementType(hovered.type).label})`
              : 'Hover the page and click on an element to pick it'}
          </div>
          <div style={{ width: 1280 * scale, height: frameHeight * scale, position: 'relative', flexShrink: 0 }}>
            <iframe
              ref={iframeRef}
              title="Pick an element"
              srcDoc={srcDoc}
              onLoad={onFrameLoad}
              style={{
                width: 1280,
                height: frameHeight,
                border: 'none',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0,
                background: '#ffffff',
              }}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ElementPickerDialog;

/** The text to insert in code to reference an element. */
export const getElementCodeReference = (
  project: WebsiteProject,
  picked: PickedElement,
  language: 'javascript' | 'css'
): string => {
  if (language === 'css') return `.wv-${picked.id} /* ${picked.name} */ {\n  \n}`;
  // Use the name when it is unique, otherwise the id.
  const document = getDocument(project, picked.docRef);
  let sameName = 0;
  if (document) {
    walkElements(document.root, element => {
      if (element.name === picked.name) sameName++;
    });
  }
  // Names are resolved on pages: elements of components are referenced by id
  // (which works for all the instances of the component).
  return sameName > 1 || picked.docRef.kind === 'component'
    ? `Webvelop.$('${picked.id}') /* ${picked.name} */`
    : `Webvelop.$(${JSON.stringify(picked.name)})`;
};
