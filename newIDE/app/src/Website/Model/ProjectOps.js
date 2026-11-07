// @flow
// Immutable operations on a whole website project.
import {
  type WebsiteProject,
  type WebsitePage,
  type WebsiteComponent,
  type WebsiteElement,
  type EditableDocumentKind,
  type EditableDocument,
  type InteractionEvent,
} from './Schema';
import { newId, slugify, makeUniqueName, toComponentName, toVariableName } from './Ids';
import {
  findElement,
  findParent,
  insertElement,
  removeElement,
  updateElement,
  cloneWithNewIds,
  collectElementIds,
  walkElements,
} from './Tree';
import { createRootElement, createElement } from '../Elements/ElementTypes';
import {
  cloneEventsWithIdMap,
  getEventReferencedElementIds,
} from '../Interactions/EventFactory';

export type DocumentRef = {| kind: EditableDocumentKind, id: string |};

export const getDocument = (
  project: WebsiteProject,
  ref: DocumentRef
): ?EditableDocument => {
  if (ref.kind === 'page')
    return project.pages.find(page => page.id === ref.id) || null;
  return project.components.find(component => component.id === ref.id) || null;
};

export const updateDocument = (
  project: WebsiteProject,
  ref: DocumentRef,
  updater: (document: any) => any
): WebsiteProject => {
  if (ref.kind === 'page') {
    return {
      ...project,
      pages: project.pages.map(page => (page.id === ref.id ? updater(page) : page)),
    };
  }
  return {
    ...project,
    components: project.components.map(component =>
      component.id === ref.id ? updater(component) : component
    ),
  };
};

export const updateDocumentRoot = (
  project: WebsiteProject,
  ref: DocumentRef,
  updater: WebsiteElement => WebsiteElement
): WebsiteProject =>
  updateDocument(project, ref, document => {
    const root = updater(document.root);
    return root === document.root ? document : { ...document, root };
  });

export const updateElementInDocument = (
  project: WebsiteProject,
  ref: DocumentRef,
  elementId: string,
  updater: WebsiteElement => WebsiteElement
): WebsiteProject =>
  updateDocumentRoot(project, ref, root => updateElement(root, elementId, updater));

// Pages

export const makeUniqueSlug = (project: WebsiteProject, base: string, exceptPageId?: string) => {
  const existing = project.pages
    .filter(page => page.id !== exceptPageId)
    .map(page => page.slug);
  return makeUniqueName(slugify(base), existing, '-');
};

export const createPage = (
  project: WebsiteProject,
  name: string,
  children: Array<WebsiteElement> = []
): WebsitePage => {
  const uniqueName = makeUniqueName(name, project.pages.map(page => page.name));
  const isFirst = project.pages.length === 0;
  return {
    id: newId('p'),
    name: uniqueName,
    slug: isFirst ? 'index' : makeUniqueSlug(project, uniqueName),
    title: uniqueName,
    description: '',
    root: createRootElement(children),
    events: [],
    script: '',
    css: '',
  };
};

export const addPage = (
  project: WebsiteProject,
  name: string,
  children?: Array<WebsiteElement>
): {| project: WebsiteProject, page: WebsitePage |} => {
  const page = createPage(project, name, children);
  const newProject = { ...project, pages: [...project.pages, page] };
  if (!newProject.settings.homePageId) {
    newProject.settings = { ...newProject.settings, homePageId: page.id };
  }
  return { project: newProject, page };
};

export const duplicatePage = (
  project: WebsiteProject,
  pageId: string
): {| project: WebsiteProject, page: ?WebsitePage |} => {
  const source = project.pages.find(page => page.id === pageId);
  if (!source) return { project, page: null };
  const { element: root, idMap } = cloneWithNewIds(source.root);
  const name = makeUniqueName(source.name + ' copy', project.pages.map(page => page.name));
  const page = {
    ...source,
    id: newId('p'),
    name,
    title: name,
    slug: makeUniqueSlug(project, name),
    root,
    events: cloneEventsWithIdMap(source.events, idMap),
  };
  const index = project.pages.indexOf(source);
  const pages = [...project.pages];
  pages.splice(index + 1, 0, page);
  return { project: { ...project, pages }, page };
};

export const removePage = (project: WebsiteProject, pageId: string): WebsiteProject => {
  if (project.pages.length <= 1) return project;
  const pages = project.pages.filter(page => page.id !== pageId);
  return {
    ...project,
    pages,
    settings: {
      ...project.settings,
      homePageId:
        project.settings.homePageId === pageId ? pages[0].id : project.settings.homePageId,
    },
  };
};

export const setHomePage = (project: WebsiteProject, pageId: string): WebsiteProject => {
  // The home page is exported as index.html.
  const previousHome = project.pages.find(page => page.slug === 'index');
  const newHome = project.pages.find(page => page.id === pageId);
  if (!newHome) return project;
  return {
    ...project,
    settings: { ...project.settings, homePageId: pageId },
    pages: project.pages.map(page => {
      if (page.id === pageId) return { ...page, slug: 'index' };
      if (previousHome && page.id === previousHome.id && page.id !== pageId)
        return { ...page, slug: makeUniqueSlug(project, page.name, page.id) };
      return page;
    }),
  };
};

export const movePage = (project: WebsiteProject, pageId: string, newIndex: number) => {
  const pages = [...project.pages];
  const index = pages.findIndex(page => page.id === pageId);
  if (index === -1) return project;
  const [page] = pages.splice(index, 1);
  pages.splice(Math.max(0, Math.min(newIndex, pages.length)), 0, page);
  return { ...project, pages };
};

export const getPageFileName = (page: WebsitePage): string =>
  (page.slug === 'index' ? 'index' : page.slug) + '.html';

// Components

export const createComponent = (
  project: WebsiteProject,
  name: string,
  root?: WebsiteElement
): WebsiteComponent => ({
  id: newId('k'),
  name: makeUniqueName(name, project.components.map(component => component.name)),
  description: '',
  props: [],
  root:
    root ||
    createElement('container', {
      name: name,
      styles: { desktop: { padding: '16px' } },
    }),
  events: [],
});

export const addComponent = (
  project: WebsiteProject,
  name: string,
  root?: WebsiteElement
): {| project: WebsiteProject, component: WebsiteComponent |} => {
  const component = createComponent(project, name, root);
  return { project: { ...project, components: [...project.components, component] }, component };
};

export const getComponentUsages = (
  project: WebsiteProject,
  componentId: string
): Array<{| ref: DocumentRef, elementId: string, documentName: string |}> => {
  const usages = [];
  const scan = (ref: DocumentRef, document: EditableDocument) =>
    walkElements(document.root, element => {
      if (element.type === 'component' && element.props.componentId === componentId)
        usages.push({ ref, elementId: element.id, documentName: document.name });
    });
  project.pages.forEach(page => scan({ kind: 'page', id: page.id }, page));
  project.components.forEach(component =>
    scan({ kind: 'component', id: component.id }, component)
  );
  return usages;
};

export const removeComponent = (project: WebsiteProject, componentId: string) => {
  let newProject = {
    ...project,
    components: project.components.filter(component => component.id !== componentId),
  };
  // Remove the instances of the component.
  getComponentUsages(project, componentId).forEach(usage => {
    if (usage.ref.kind === 'component' && usage.ref.id === componentId) return;
    newProject = updateDocumentRoot(newProject, usage.ref, root =>
      removeElement(root, usage.elementId)
    );
  });
  return newProject;
};

/** Check that adding an instance of `componentId` into `targetComponentId` won't create a loop. */
export const wouldCreateComponentCycle = (
  project: WebsiteProject,
  componentId: string,
  targetComponentId: string
): boolean => {
  const visit = (currentId: string, seen: Set<string>): boolean => {
    if (currentId === targetComponentId) return true;
    if (seen.has(currentId)) return false;
    seen.add(currentId);
    const component = project.components.find(c => c.id === currentId);
    if (!component) return false;
    let found = false;
    walkElements(component.root, element => {
      if (found) return false;
      if (element.type === 'component' && element.props.componentId) {
        if (visit(element.props.componentId, seen)) found = true;
      }
    });
    return found;
  };
  return visit(componentId, new Set());
};

/**
 * Turn an element of a page into a reusable component: the element is moved
 * into a new component, and replaced by an instance of it. The interactions
 * only referencing elements of the moved subtree are moved too.
 */
export const convertElementToComponent = (
  project: WebsiteProject,
  ref: DocumentRef,
  elementId: string,
  name: string
): {| project: WebsiteProject, component: ?WebsiteComponent, instanceId: ?string |} => {
  const document = getDocument(project, ref);
  if (!document) return { project, component: null, instanceId: null };
  const element = findElement(document.root, elementId);
  const location = findParent(document.root, elementId);
  if (!element || !location) return { project, component: null, instanceId: null };

  const subtreeIds = new Set(collectElementIds(element));
  const movedEvents = [];
  const keptEvents = [];
  document.events.forEach(event => {
    const referenced = getEventReferencedElementIds(event).filter(
      id => id && !id.startsWith('$')
    );
    if (referenced.length && referenced.every(id => subtreeIds.has(id)))
      movedEvents.push(event);
    else keptEvents.push(event);
  });

  const component = {
    ...createComponent(project, name, element),
    events: movedEvents,
  };
  const instance = createElement('component', {
    name: component.name,
    props: { componentId: component.id, values: {} },
  });
  let newProject = { ...project, components: [...project.components, component] };
  newProject = updateDocument(newProject, ref, doc => ({
    ...doc,
    events: keptEvents,
    root: insertElement(
      removeElement(doc.root, elementId),
      location.parent.id,
      location.index,
      instance
    ),
  }));
  return { project: newProject, component, instanceId: instance.id };
};

// React components, scripts, variables, custom actions

export const addReactComponent = (project: WebsiteProject, name: string) => {
  const componentName = makeUniqueName(
    toComponentName(name),
    project.reactComponents.map(component => component.name),
    ''
  );
  const reactComponent = {
    id: newId('x'),
    name: componentName,
    description: '',
    props: [
      { name: 'label', label: 'Label', type: 'text', defaultValue: 'Clicks' },
    ],
    code: `// A React component. React hooks (useState, useEffect...) are available,
// as well as the website state with Webvelop.useVariable("name").
function ${componentName}({ label }) {
  const [count, setCount] = useState(0);

  return (
    <button className="${componentName.toLowerCase()}" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </button>
  );
}
`,
    css: `.${componentName.toLowerCase()} {
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  font-size: 16px;
  cursor: pointer;
}
`,
  };
  return {
    project: { ...project, reactComponents: [...project.reactComponents, reactComponent] },
    reactComponent,
  };
};

export const addScript = (project: WebsiteProject, name: string) => {
  const fileName = makeUniqueName(
    slugify(name.replace(/\.js$/, '')) + '.js',
    project.scripts.map(script => script.name),
    '-'
  );
  const script = {
    id: newId('s'),
    name: fileName,
    placement: 'body',
    code: `// This script runs on every page of the website, once the page is ready.
// Use Webvelop.element("Element name") to find elements, and
// Webvelop.state to read and change the website variables.
`,
  };
  return { project: { ...project, scripts: [...project.scripts, script] }, script };
};

export const addVariable = (project: WebsiteProject, name: string, type: string = 'string') => {
  const variable = {
    id: newId('w'),
    name: makeUniqueName(toVariableName(name), project.variables.map(v => v.name), ''),
    type,
    initialValue: type === 'number' ? '0' : type === 'boolean' ? 'false' : '',
    persist: false,
  };
  return { project: { ...project, variables: [...project.variables, variable] }, variable };
};

export const addCustomAction = (project: WebsiteProject, name: string) => {
  const actionName = makeUniqueName(
    toVariableName(name),
    project.customActions.map(action => action.name),
    ''
  );
  const customAction = {
    id: newId('u'),
    name: actionName,
    label: name,
    description: '',
    params: [{ name: 'target', label: 'Element', type: 'element' }],
    code: `// "params" contains the parameters of the action. Element parameters
// are given as a list of DOM elements. "context" gives access to the
// triggering element, the event, the state and Webvelop.
for (const element of params.target) {
  element.style.outline = '3px solid hotpink';
}
`,
  };
  return {
    project: { ...project, customActions: [...project.customActions, customAction] },
    customAction,
  };
};

export const addStyleClass = (project: WebsiteProject, name: string) => {
  const styleClass = {
    id: newId('y'),
    name: makeUniqueName(slugify(name), project.styleClasses.map(c => c.name), '-'),
    styles: { desktop: {} },
  };
  return {
    project: { ...project, styleClasses: [...project.styleClasses, styleClass] },
    styleClass,
  };
};

// Inserting elements and their events in a document.

export const insertElementsInDocument = (
  project: WebsiteProject,
  ref: DocumentRef,
  parentId: string,
  index: number,
  elements: Array<WebsiteElement>,
  events: Array<InteractionEvent> = []
): WebsiteProject =>
  updateDocument(project, ref, document => {
    let root = document.root;
    elements.forEach((element, offset) => {
      root = insertElement(root, parentId, index + offset, element);
    });
    return { ...document, root, events: [...document.events, ...events] };
  });

/** Remove an element and the interactions that were attached to it. */
export const removeElementFromDocument = (
  project: WebsiteProject,
  ref: DocumentRef,
  elementId: string
): WebsiteProject =>
  updateDocument(project, ref, document => {
    const element = findElement(document.root, elementId);
    if (!element || element.id === document.root.id) return document;
    const removedIds = new Set(collectElementIds(element));
    return {
      ...document,
      root: removeElement(document.root, elementId),
      events: document.events.filter(event => !removedIds.has(event.trigger.target)),
    };
  });

/** Duplicate an element (and the interactions attached to it), placing the copy after it. */
export const duplicateElementInDocument = (
  project: WebsiteProject,
  ref: DocumentRef,
  elementId: string
): {| project: WebsiteProject, newElementId: ?string |} => {
  const document = getDocument(project, ref);
  if (!document) return { project, newElementId: null };
  const element = findElement(document.root, elementId);
  const location = findParent(document.root, elementId);
  if (!element || !location) return { project, newElementId: null };
  const { element: copy, idMap } = cloneWithNewIds(element);
  const subtreeIds = new Set(Object.keys(idMap));
  const copiedEvents = cloneEventsWithIdMap(
    document.events.filter(event => subtreeIds.has(event.trigger.target)),
    idMap
  );
  return {
    project: insertElementsInDocument(
      project,
      ref,
      location.parent.id,
      location.index + 1,
      [copy],
      copiedEvents
    ),
    newElementId: copy.id,
  };
};

export const getAssetUrl = (project: WebsiteProject, assetId: string): ?string => {
  const asset = project.assets.find(a => a.id === assetId);
  if (!asset) return null;
  return asset.dataUrl || asset.path || null;
};

export const ASSET_REFERENCE_PREFIX = 'asset:';

/** Values of image/video fields can reference an asset: "asset:<id>". */
export const isAssetReference = (value: any): boolean =>
  typeof value === 'string' && value.startsWith(ASSET_REFERENCE_PREFIX);

export const getAssetIdFromReference = (value: string): string =>
  value.substring(ASSET_REFERENCE_PREFIX.length);
