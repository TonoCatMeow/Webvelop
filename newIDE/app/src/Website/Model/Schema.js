// @flow
/**
 * Webvelop website model.
 *
 * A website project is a plain, JSON-serializable object. It replaces the
 * game project (gdProject) of the original editor:
 *
 * WebsiteProject
 * ├── settings (title, language, favicon, custom head code, global CSS)
 * ├── theme (design tokens: colors and fonts, exported as CSS variables)
 * ├── pages[]            -> each page has a tree of elements and events
 * ├── components[]       -> reusable visual components (element trees with props)
 * ├── reactComponents[]  -> reusable React components written in JSX
 * ├── scripts[]          -> JavaScript files run on every page
 * ├── styleClasses[]     -> shared styles that can be applied to elements
 * ├── variables[]        -> website state, usable by interactions and React
 * ├── customActions[]    -> user defined actions, written in JavaScript
 * ├── globalEvents[]     -> interactions running on every page
 * └── assets[]           -> images, videos, fonts and other files
 *
 * Element
 * ├── id, type, name
 * ├── props      -> type specific properties (text, src, href, ...)
 * ├── styles     -> { desktop, tablet, mobile, hover, focus, pressed, current }
 * ├── classIds   -> shared style classes
 * ├── behaviors  -> [{ type, config }] (tabs, carousel, modal...)
 * └── children
 */

export const WEBVELOP_FORMAT_VERSION = 1;
export const PROJECT_FILE_EXTENSION = 'webvelop';

export type BreakpointId = 'desktop' | 'tablet' | 'mobile';
export type StyleStateId = 'hover' | 'focus' | 'pressed' | 'current';
export type StyleKey = BreakpointId | StyleStateId;

export type Breakpoint = {|
  id: BreakpointId,
  label: string,
  /** Width of the canvas when editing this breakpoint. */
  canvasWidth: number,
  /** Max width of the media query applied for this breakpoint (null for the base one). */
  maxWidth: ?number,
|};

export const BREAKPOINTS: Array<Breakpoint> = [
  { id: 'desktop', label: 'Desktop', canvasWidth: 1280, maxWidth: null },
  { id: 'tablet', label: 'Tablet', canvasWidth: 820, maxWidth: 991 },
  { id: 'mobile', label: 'Mobile', canvasWidth: 390, maxWidth: 767 },
];

export const getBreakpoint = (id: BreakpointId): Breakpoint =>
  BREAKPOINTS.find(breakpoint => breakpoint.id === id) || BREAKPOINTS[0];

export const STYLE_STATES: Array<{|
  id: StyleStateId,
  label: string,
  selector: string,
|}> = [
  { id: 'hover', label: 'Hover', selector: ':hover' },
  { id: 'focus', label: 'Focus', selector: ':focus-visible' },
  { id: 'pressed', label: 'Pressed', selector: ':active' },
  { id: 'current', label: 'Active (current tab, open item...)', selector: '.is-active' },
];

export type StyleMap = { [cssProperty: string]: string };
export type ElementStyles = { [key: StyleKey]: StyleMap };

export type ElementBehavior = {|
  type: string,
  config: { [string]: any },
|};

export type WebsiteElement = {|
  id: string,
  type: string,
  name: string,
  props: { [string]: any },
  styles: ElementStyles,
  classIds: Array<string>,
  behaviors: Array<ElementBehavior>,
  children: Array<WebsiteElement>,
  locked?: boolean,
|};

export type InteractionTrigger = {|
  type: string,
  target: string,
  params: { [string]: any },
|};

export type InteractionCondition = {|
  id: string,
  type: string,
  params: { [string]: any },
  negate?: boolean,
|};

export type InteractionAction = {|
  id: string,
  type: string,
  params: { [string]: any },
  disabled?: boolean,
|};

export type InteractionEvent = {|
  id: string,
  name?: string,
  trigger: InteractionTrigger,
  conditions: Array<InteractionCondition>,
  actions: Array<InteractionAction>,
  elseActions: Array<InteractionAction>,
  disabled?: boolean,
|};

export type WebsitePage = {|
  id: string,
  name: string,
  slug: string,
  title: string,
  description: string,
  root: WebsiteElement,
  events: Array<InteractionEvent>,
  script: string,
  css: string,
|};

export type ComponentPropDefinition = {|
  name: string,
  label: string,
  type: 'text' | 'longText' | 'image' | 'url' | 'color' | 'number' | 'boolean',
  defaultValue: string,
|};

export type WebsiteComponent = {|
  id: string,
  name: string,
  description: string,
  props: Array<ComponentPropDefinition>,
  root: WebsiteElement,
  events: Array<InteractionEvent>,
|};

export type ReactComponentDefinition = {|
  id: string,
  name: string,
  description: string,
  props: Array<ComponentPropDefinition>,
  code: string,
  css: string,
|};

export type WebsiteScript = {|
  id: string,
  name: string,
  code: string,
  /** 'head' scripts run before the page is built, 'body' after. */
  placement: 'body' | 'head',
|};

export type StyleClass = {|
  id: string,
  name: string,
  styles: ElementStyles,
|};

export type WebsiteVariable = {|
  id: string,
  name: string,
  type: 'string' | 'number' | 'boolean' | 'json',
  initialValue: string,
  /** If true, the value is kept in the visitor browser (localStorage). */
  persist: boolean,
|};

export type CustomActionDefinition = {|
  id: string,
  name: string,
  label: string,
  description: string,
  params: Array<{| name: string, label: string, type: string |}>,
  code: string,
|};

export type WebsiteAsset = {|
  id: string,
  name: string,
  kind: 'image' | 'video' | 'audio' | 'font' | 'file',
  mimeType: string,
  /** Relative path of the file, from the project folder (desktop). */
  path?: string,
  /** File content as a data URL, when the project is not stored on disk (web). */
  dataUrl?: string,
  size?: number,
|};

export type ThemeColor = {| name: string, value: string |};
export type ThemeFont = {| name: string, family: string, googleFont: boolean |};

export type WebsiteTheme = {|
  colors: Array<ThemeColor>,
  fonts: Array<ThemeFont>,
  baseFontSize: string,
|};

export type WebsiteSettings = {|
  title: string,
  description: string,
  language: string,
  faviconAssetId: ?string,
  headHtml: string,
  globalCss: string,
  homePageId: string,
|};

export type WebsiteProject = {|
  webvelop: {| formatVersion: number, createdWith: string |},
  uuid: string,
  name: string,
  author: string,
  version: string,
  settings: WebsiteSettings,
  theme: WebsiteTheme,
  pages: Array<WebsitePage>,
  components: Array<WebsiteComponent>,
  reactComponents: Array<ReactComponentDefinition>,
  scripts: Array<WebsiteScript>,
  styleClasses: Array<StyleClass>,
  variables: Array<WebsiteVariable>,
  customActions: Array<CustomActionDefinition>,
  globalEvents: Array<InteractionEvent>,
  assets: Array<WebsiteAsset>,
|};

/** Something that owns an element tree and events: a page or a component. */
export type EditableDocumentKind = 'page' | 'component';
export type EditableDocument = WebsitePage | WebsiteComponent;

export const isWebsiteProjectContent = (content: any): boolean =>
  !!content &&
  typeof content === 'object' &&
  !!content.webvelop &&
  Array.isArray(content.pages);
