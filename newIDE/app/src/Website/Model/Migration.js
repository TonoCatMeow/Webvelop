// @flow
// Upgrade of website projects saved with older versions of Webvelop, and
// repair of missing fields (projects edited by hand...).
import { WEBVELOP_FORMAT_VERSION, type WebsiteProject, type WebsiteElement } from './Schema';
import { createEmptyWebsiteProject, createDefaultTheme } from './Templates';
import { ensureUniqueIds } from './Tree';

const fixElement = (element: any): WebsiteElement => ({
  id: element.id,
  type: element.type || 'container',
  name: element.name || element.type || 'Element',
  props: element.props && typeof element.props === 'object' ? element.props : {},
  styles: element.styles && typeof element.styles === 'object' ? element.styles : {},
  classIds: Array.isArray(element.classIds) ? element.classIds : [],
  behaviors: Array.isArray(element.behaviors) ? element.behaviors : [],
  children: Array.isArray(element.children) ? element.children.map(fixElement) : [],
  ...(element.locked ? { locked: true } : {}),
});

const fixEvents = (events: any): Array<any> =>
  (Array.isArray(events) ? events : []).map(event => ({
    ...event,
    trigger: event.trigger || { type: 'click', target: '', params: {} },
    conditions: Array.isArray(event.conditions) ? event.conditions : [],
    actions: Array.isArray(event.actions) ? event.actions : [],
    elseActions: Array.isArray(event.elseActions) ? event.elseActions : [],
  }));

export const migrateWebsiteProject = (content: any): WebsiteProject => {
  const formatVersion = (content.webvelop && content.webvelop.formatVersion) || 1;
  if (formatVersion > WEBVELOP_FORMAT_VERSION) {
    throw new Error(
      'This website was created with a newer version of Webvelop. Update Webvelop to open it.'
    );
  }
  const defaults = createEmptyWebsiteProject(content.name || 'Website');
  const project: WebsiteProject = {
    ...defaults,
    ...content,
    webvelop: { ...defaults.webvelop, ...(content.webvelop || {}), formatVersion: WEBVELOP_FORMAT_VERSION },
    settings: { ...defaults.settings, ...(content.settings || {}) },
    theme: { ...createDefaultTheme(), ...(content.theme || {}) },
    pages: (content.pages || []).map(page => ({
      id: page.id,
      name: page.name || 'Page',
      slug: page.slug || 'page',
      title: page.title || page.name || '',
      description: page.description || '',
      root: ensureUniqueIds(fixElement(page.root || { id: 'r' + page.id, type: 'body', children: [] })),
      events: fixEvents(page.events),
      script: page.script || '',
      css: page.css || '',
    })),
    components: (content.components || []).map(component => ({
      id: component.id,
      name: component.name || 'Component',
      description: component.description || '',
      props: Array.isArray(component.props) ? component.props : [],
      root: fixElement(component.root || { id: 'r' + component.id, type: 'container', children: [] }),
      events: fixEvents(component.events),
    })),
    reactComponents: Array.isArray(content.reactComponents) ? content.reactComponents : [],
    scripts: Array.isArray(content.scripts) ? content.scripts : [],
    styleClasses: Array.isArray(content.styleClasses) ? content.styleClasses : [],
    variables: Array.isArray(content.variables) ? content.variables : [],
    customActions: Array.isArray(content.customActions) ? content.customActions : [],
    globalEvents: fixEvents(content.globalEvents),
    assets: Array.isArray(content.assets) ? content.assets : [],
  };
  if (!project.settings.homePageId && project.pages[0]) {
    project.settings = { ...project.settings, homePageId: project.pages[0].id };
  }
  return project;
};
