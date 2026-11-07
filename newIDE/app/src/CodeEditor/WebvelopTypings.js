// @flow
// Type declarations of the Webvelop runtime, given to the code editor for
// autocompletion and documentation.
export const webvelopTypings = `
/** Names of the elements, variables and pages of the website (completed by the editor). */
interface WebvelopElementNames {}
interface WebvelopVariableNames {}
interface WebvelopPageNames {}
type WebvelopElementName = keyof WebvelopElementNames | (string & {});
type WebvelopVariableName = keyof WebvelopVariableNames | (string & {});
type WebvelopPageName = keyof WebvelopPageNames | (string & {});
type WebvelopAnimation = 'fade-in' | 'fade-out' | 'fade-up' | 'fade-down' | 'zoom-in' | 'bounce' | 'shake' | 'pulse' | 'spin' | 'wobble';

/**
 * Controls an element of the page (all its copies, when it is in a repeated component).
 * Methods changing something return the handle, so that calls can be chained:
 * Webvelop.$('Title').text('Hello').addClass('big').show();
 */
interface WebvelopElementHandle {
  /** The first DOM element (null if the element was not found). */
  readonly dom: HTMLElement | null;
  /** All the DOM elements. */
  readonly nodes: HTMLElement[];
  /** True if the element exists on the page. */
  readonly exists: boolean;
  /** Number of DOM elements. */
  readonly count: number;
  /** Get the text of the element. */
  text(): string;
  /** Change the text of the element ({{state.name}} is replaced by the variable and kept up to date). */
  text(value: string | number): WebvelopElementHandle;
  /** Get the HTML content. */
  html(): string;
  /** Change the HTML content. */
  html(value: string): WebvelopElementHandle;
  /** Get the value of an input, text area, dropdown list or checkbox. */
  value(): string | boolean;
  /** Change the value of an input, text area, dropdown list or checkbox. */
  value(value: string | number | boolean): WebvelopElementHandle;
  /** Get an attribute (src, href, placeholder...). */
  attr(name: string): string | null;
  /** Change an attribute (null removes it). */
  attr(name: string, value: string | number | null): WebvelopElementHandle;
  show(): WebvelopElementHandle;
  hide(): WebvelopElementHandle;
  /** Show the element if hidden and hide it otherwise (or force it with true/false). */
  toggle(visible?: boolean): WebvelopElementHandle;
  isVisible(): boolean;
  addClass(className: string): WebvelopElementHandle;
  removeClass(className: string): WebvelopElementHandle;
  /** "is-active" applies the "Active" style state of the element. */
  toggleClass(className: string, force?: boolean): WebvelopElementHandle;
  hasClass(className: string): boolean;
  /** Get a computed CSS property, like css('color'). */
  css(property: string): string;
  /** Change a CSS property, like css('backgroundColor', 'red') or css('--my-var', '4px'). */
  css(property: string, value: string): WebvelopElementHandle;
  /** Change several CSS properties: css({ color: 'white', fontSize: '20px' }). */
  css(styles: { [property: string]: string }): WebvelopElementHandle;
  /** Position and size of the element, in the page. */
  rect(): { x: number; y: number; width: number; height: number };
  /** Get the size of the element. */
  size(): { width: number; height: number };
  /** Change the size (numbers are pixels, or use CSS values like '50%'). */
  size(width: number | string | null, height?: number | string | null): WebvelopElementHandle;
  /** Move the element by an offset (in pixels) from its place in the layout. */
  moveTo(x: number, y: number): WebvelopElementHandle;
  scrollIntoView(smooth?: boolean): WebvelopElementHandle;
  /** Listen to an event of the element: on('click', (event, element) => ...). */
  on(eventName: string, handler: (event: Event, element: WebvelopElementHandle) => void): WebvelopElementHandle;
  /** Stop listening to an event. */
  off(eventName: string, handler?: Function): WebvelopElementHandle;
  onClick(handler: (event: MouseEvent, element: WebvelopElementHandle) => void): WebvelopElementHandle;
  click(): WebvelopElementHandle;
  focus(): WebvelopElementHandle;
  /** Enable (or disable with false) the buttons and fields of the element. */
  enable(enabled?: boolean): WebvelopElementHandle;
  disable(): WebvelopElementHandle;
  /** Play an animation. The promise is resolved at the end of the animation. */
  animate(animation: WebvelopAnimation, durationInMs?: number): Promise<void>;
  /** The API of a behavior of the element: behavior('carousel').next(), behavior('tabs').activate(1)... */
  behavior(name: string): any;
  /** Open the element, if it has the "Popup (modal)" behavior. */
  openPopup(): WebvelopElementHandle;
  /** Close the element, if it has the "Popup (modal)" behavior. */
  closePopup(): WebvelopElementHandle;
  /** Find an element inside this one, by name or id. */
  find(nameOrId: WebvelopElementName): WebvelopElementHandle;
  /** The parent element. */
  parent(): WebvelopElementHandle;
  /** Call a function for each copy of the element. */
  each(callback: (element: WebvelopElementHandle, index: number) => void): WebvelopElementHandle;
  /** Remove the element from the page. */
  remove(): WebvelopElementHandle;
}

interface WebvelopVariableState {
  /** Get the value of a variable of the website. */
  get(name: WebvelopVariableName): any;
  /** Change the value of a variable. Texts showing {{state.name}} and React components using it are updated. */
  set(name: WebvelopVariableName, value: any): void;
  /** Call a function each time a variable changes. Returns a function to stop listening. */
  subscribe(name: WebvelopVariableName, listener: (value: any, oldValue: any) => void): () => void;
  /** Get all the variables. */
  all(): { [name: string]: any };
}

interface WebvelopPage { id: string; name: string; slug: string; title: string; }
interface WebvelopSite { name: string; title: string; pages: Array<WebvelopPage & { file: string }>; }

interface WebvelopActionContext {
  /** The element that triggered the interaction. */
  element: HTMLElement | null;
  /** The DOM event (click, submit...) that triggered the interaction, if any. */
  event: Event | null;
  state: WebvelopVariableState;
  Webvelop: WebvelopRuntime;
  /** Find the DOM elements of an element of the page, from its id. */
  targets(elementId: string): HTMLElement[];
}

interface WebvelopRuntime {
  /** The variables (state) of the website. */
  state: WebvelopVariableState;
  /** The website. */
  readonly site: WebvelopSite;
  /** The current page. */
  readonly page: WebvelopPage;
  /** "site" (published website), "preview" or "editor". */
  readonly mode: 'site' | 'preview' | 'editor';
  /**
   * Control an element of the page, by its name (as shown in the Layers panel) or its id:
   * Webvelop.$('Title').text('Hello').show();
   */
  $(target: WebvelopElementName | HTMLElement | HTMLElement[] | WebvelopElementHandle): WebvelopElementHandle;
  /** Find the first DOM element of an element of the page, by its name (as shown in the Layers panel) or id. */
  element(nameOrId: WebvelopElementName): HTMLElement | null;
  /** Find all the DOM elements of an element (several if it is inside a repeated component). */
  elements(nameOrId: string): HTMLElement[];
  /** Show an element (name, id or DOM element). */
  show(target: string | HTMLElement): void;
  /** Hide an element (name, id or DOM element). */
  hide(target: string | HTMLElement): void;
  /** Show the element if hidden, hide it otherwise. */
  toggle(target: string | HTMLElement): void;
  /** Navigate to another page of the website (name, slug or id). */
  goToPage(page: WebvelopPageName): void;
  /** Run an action of the interactions system, like Webvelop.runAction('openModal', { target: 'e123' }). */
  runAction(type: string, params?: object, element?: HTMLElement): Promise<void>;
  /** Replace {{state.name}} in a text by the value of the variables. */
  interpolate(text: string): string;
  /** Run a function when the page is ready. */
  onReady(callback: () => void): void;
  /** React hook giving the value of a variable and a function to change it: const [count, setCount] = Webvelop.useVariable('count'); */
  useVariable<T = any>(name: WebvelopVariableName): [T, (value: T | ((previous: T) => T)) => void];
  /** The current responsive breakpoint. */
  getBreakpoint(): 'desktop' | 'tablet' | 'mobile';
  /** Register a new action usable by the interactions. */
  registerAction(type: string, implementation: (params: any, context: WebvelopActionContext) => void | Promise<void>): void;
  /** Register a new condition usable by the interactions. */
  registerCondition(type: string, implementation: (params: any, context: WebvelopActionContext) => boolean | Promise<boolean>): void;
  /** Register a new behavior, initialized on the elements having it. */
  registerBehavior(type: string, implementation: (element: HTMLElement, config: any) => void): void;
  /** Report an error (shown in the preview console). */
  reportError(error: any, where?: string): void;
}

/** The Webvelop runtime, giving access to the elements, the state and the pages of the website. */
declare const Webvelop: WebvelopRuntime;
/** The variables (state) of the website. */
declare const state: WebvelopVariableState;
/** In interactions: the element that triggered the interaction. */
declare const element: HTMLElement;
/** In interactions: the context of the interaction. */
declare const context: WebvelopActionContext;
/** In JavaScript actions and conditions: the elements passed to the code (elements.self is the element that triggered the interaction). */
declare const elements: { self: WebvelopElementHandle; [name: string]: WebvelopElementHandle };
/** In custom actions: the parameters of the action (element parameters are lists of DOM elements). */
declare const params: any;

/** React (available in React components). */
declare const React: any;
declare function useState<T>(initialValue: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
declare function useEffect(effect: () => void | (() => void), dependencies?: any[]): void;
declare function useLayoutEffect(effect: () => void | (() => void), dependencies?: any[]): void;
declare function useRef<T = any>(initialValue?: T): { current: T };
declare function useMemo<T>(factory: () => T, dependencies: any[]): T;
declare function useCallback<T extends Function>(callback: T, dependencies: any[]): T;
declare function useReducer(reducer: (state: any, action: any) => any, initialState: any): [any, (action: any) => void];
declare function useContext(context: any): any;
declare function useId(): string;
declare function createContext(defaultValue?: any): any;
declare const Fragment: any;
declare namespace JSX {
  interface IntrinsicElements { [elementName: string]: any; }
}
`;

/** Diagnostics not applicable to code snippets run inside functions by Webvelop. */
export const snippetSuppressedDiagnostics = [
  "A 'return' statement can only be used within a function body",
  "'await' expressions are only allowed",
  "'await' expressions are only allowed at the top level of a file when that file is a module",
  'Cannot redeclare block-scoped variable',
];

const escapeTypeKey = (name: string) => JSON.stringify(name);

/** Declarations of the names of the website, for autocompletion. */
export const generateProjectTypings = (project: any): string => {
  const elementNames = new Set();
  const collect = (element: any) => {
    if (element.name && element.type !== 'body') elementNames.add(element.name);
    (element.children || []).forEach(collect);
  };
  project.pages.forEach(page => collect(page.root));
  return [
    'interface WebvelopElementNames {',
    ...Array.from(elementNames).map(name => `  ${escapeTypeKey(String(name))}: true;`),
    '}',
    'interface WebvelopVariableNames {',
    ...project.variables.map(variable => `  ${escapeTypeKey(variable.name)}: true;`),
    '}',
    'interface WebvelopPageNames {',
    ...project.pages.map(page => `  ${escapeTypeKey(page.name)}: true;`),
    '}',
    '',
  ].join('\n');
};
