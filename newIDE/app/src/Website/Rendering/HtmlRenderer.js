// @flow
// Rendering of element trees to HTML.
// The same renderer is used for the editor canvas, the preview and the export,
// so that what is seen in the editor is what is published.
import {
  type WebsiteProject,
  type WebsiteElement,
  type WebsitePage,
  type WebsiteComponent,
} from '../Model/Schema';
import { ROOT_TYPE } from '../Elements/ElementTypes';
import { renderIconSvg } from '../Elements/IconSet';
import { placeholderImage } from '../Elements/Presets';
import { slugify } from '../Model/Ids';
import { isAssetReference, getAssetIdFromReference } from '../Model/ProjectOps';

export type RenderMode = 'editor' | 'preview' | 'export';

export type RenderOptions = {|
  mode: RenderMode,
  resolveAssetUrl: (assetId: string) => string,
  getPageHref: (page: WebsitePage) => string,
|};

export type RenderContext = {|
  project: WebsiteProject,
  options: RenderOptions,
  usedComponentIds: Set<string>,
  usedReactComponentIds: Set<string>,
  visibilityConditions: Array<{| key: string, code: string |}>,
  elementNames: { [name: string]: string },
  warnings: Array<string>,
|};

type Scope = {|
  propsValues: ?{ [string]: string },
  componentStack: Array<string>,
  /** Set when rendering the root element of a component instance. */
  instance: ?{| instanceElement: WebsiteElement, componentId: string, selectable: boolean |},
  insideComponent: boolean,
|};

export const escapeHtml = (text: any): string =>
  String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const escapeAttribute = (text: any): string =>
  escapeHtml(text).replace(/"/g, '&quot;');

const textToHtml = (text: string): string => escapeHtml(text).replace(/\n/g, '<br>');

const CONTAINER_TAGS = ['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav', 'span'];
const TEXT_TAGS = ['p', 'span', 'div', 'blockquote', 'small', 'strong', 'em', 'label'];

/** Replace {{props.name}} by the values given to a component instance. */
const substituteProps = (value: any, scope: Scope): any => {
  if (typeof value !== 'string' || !scope.propsValues || value.indexOf('{{') === -1)
    return value;
  const propsValues = scope.propsValues;
  return value.replace(/\{\{\s*props\.([\w$]+)\s*\}\}/g, (match, name) =>
    propsValues[name] !== undefined ? String(propsValues[name]) : ''
  );
};

/** Replace {{state.name}} by the initial value of the variables (for the first render). */
export const interpolateInitialState = (project: WebsiteProject, text: string): string => {
  if (typeof text !== 'string' || text.indexOf('{{') === -1) return text;
  return text.replace(/\{\{\s*(state|site|page)\.([\w$]+)\s*\}\}/g, (match, kind, name) => {
    if (kind === 'site') return name === 'name' ? project.name : '';
    if (kind === 'page') return '';
    const variable = project.variables.find(v => v.name === name);
    return variable ? String(variable.initialValue) : '';
  });
};

const hasStateTemplate = (text: any): boolean =>
  typeof text === 'string' && /\{\{\s*(state|site|page)\./.test(text);

export const resolveMediaUrl = (context: RenderContext, value: any, fallbackLabel: string): string => {
  if (isAssetReference(value)) {
    return context.options.resolveAssetUrl(getAssetIdFromReference(value));
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return placeholderImage(fallbackLabel, '#cbd5e1', '#94a3b8', 640, 400);
};

export const findPageByReference = (project: WebsiteProject, reference: string): ?WebsitePage =>
  project.pages.find(page => page.id === reference) ||
  project.pages.find(page => page.slug === reference) ||
  project.pages.find(page => slugify(page.name) === reference) ||
  null;

/** Resolve an href, which can reference a page of the website ("page:<id>#anchor"). */
export const resolveHref = (
  context: RenderContext,
  href: any
): {| href: string, pageId: ?string |} => {
  const value = typeof href === 'string' ? href.trim() : '';
  if (!value) return { href: '#', pageId: null };
  if (value.startsWith('page:')) {
    const withoutPrefix = value.substring(5);
    const hashIndex = withoutPrefix.indexOf('#');
    const reference = hashIndex === -1 ? withoutPrefix : withoutPrefix.substring(0, hashIndex);
    const hash = hashIndex === -1 ? '' : withoutPrefix.substring(hashIndex);
    const page = findPageByReference(context.project, reference);
    if (!page) {
      context.warnings.push(`A link points to a page that does not exist ("${reference}").`);
      return { href: '#', pageId: null };
    }
    return { href: context.options.getPageHref(page) + hash, pageId: page.id };
  }
  if (isAssetReference(value)) {
    return { href: context.options.resolveAssetUrl(getAssetIdFromReference(value)), pageId: null };
  }
  return { href: value, pageId: null };
};

const getYouTubeId = (url: string): ?string => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return match ? match[1] : null;
};
const getVimeoId = (url: string): ?string => {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
};

const buildAttributes = (attributes: Array<[string, any]>): string =>
  attributes
    .filter(([name, value]) => value !== null && value !== undefined && value !== false)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
    .join('');

const renderChildren = (element: WebsiteElement, context: RenderContext, scope: Scope): string =>
  (element.children || [])
    .map(child => renderElement(child, context, { ...scope, instance: null }))
    .join('');

const getComponentPropsValues = (
  component: WebsiteComponent,
  values: { [string]: any },
  scope: Scope
): { [string]: string } => {
  const result = {};
  component.props.forEach(prop => {
    const value = values && values[prop.name] !== undefined && values[prop.name] !== ''
      ? values[prop.name]
      : prop.defaultValue;
    // Values can themselves use the props of the parent component.
    result[prop.name] = substituteProps(value, scope);
  });
  return result;
};

/**
 * Render one element (and its children) to HTML.
 */
export const renderElement = (
  element: WebsiteElement,
  context: RenderContext,
  scope: Scope
): string => {
  const { project, options } = context;
  const isEditor = options.mode === 'editor';
  const props = {};
  Object.keys(element.props || {}).forEach(key => {
    props[key] = substituteProps(element.props[key], scope);
  });

  // Component instances render the root of the component.
  if (element.type === 'component') {
    const component = project.components.find(c => c.id === props.componentId);
    if (!component) {
      return isEditor
        ? `<div class="wv-${element.id} wv-missing"${buildAttributes([['data-wv-id', scope.insideComponent ? null : element.id]])}>Choose a component in the Settings panel</div>`
        : '';
    }
    if (scope.componentStack.includes(component.id)) {
      context.warnings.push(`The component "${component.name}" contains itself.`);
      return '';
    }
    context.usedComponentIds.add(component.id);
    return renderElement(component.root, context, {
      propsValues: getComponentPropsValues(component, props.values || {}, scope),
      componentStack: [...scope.componentStack, component.id],
      instance: {
        instanceElement: element,
        componentId: component.id,
        // Only instances placed directly in the edited document can be selected.
        selectable: !scope.insideComponent,
      },
      insideComponent: true,
    });
  }

  const instance = scope.instance;
  // When rendering an instance root, the settings of the instance element
  // (anchor id, visibility...) override the ones of the component root.
  const effectiveProps = instance ? { ...props, ...pickInstanceProps(instance.instanceElement.props) } : props;

  const classes = ['wv-' + element.id];
  if (instance) classes.push('wv-' + instance.instanceElement.id);
  (element.classIds || []).forEach(classId => {
    const styleClass = project.styleClasses.find(c => c.id === classId);
    if (styleClass) classes.push('wvc-' + styleClass.name);
  });
  if (instance) {
    (instance.instanceElement.classIds || []).forEach(classId => {
      const styleClass = project.styleClasses.find(c => c.id === classId);
      if (styleClass) classes.push('wvc-' + styleClass.name);
    });
  }
  if (typeof effectiveProps.extraClasses === 'string' && effectiveProps.extraClasses.trim())
    classes.push(...effectiveProps.extraClasses.trim().split(/\s+/).map(c => c.replace(/[^\w-]/g, '')));

  const initiallyHidden = !!effectiveProps.initiallyHidden;
  if (initiallyHidden && !isEditor) classes.push('wv-hidden');

  const behaviors = [...(element.behaviors || []), ...(instance ? instance.instanceElement.behaviors || [] : [])];
  const editorId = isEditor
    ? instance
      ? instance.selectable
        ? instance.instanceElement.id
        : null
      : scope.insideComponent
      ? null
      : element.id
    : null;

  if (!scope.insideComponent || (instance && instance.selectable)) {
    const name = instance ? instance.instanceElement.name : element.name;
    const id = instance ? instance.instanceElement.id : element.id;
    if (name && !context.elementNames[name]) context.elementNames[name] = id;
  }

  let visibleIfKey = null;
  if (!isEditor && typeof effectiveProps.visibleIf === 'string' && effectiveProps.visibleIf.trim()) {
    visibleIfKey = 'vis:' + (instance ? instance.instanceElement.id : element.id);
    if (!context.visibilityConditions.some(condition => condition.key === visibleIfKey))
      context.visibilityConditions.push({ key: visibleIfKey, code: effectiveProps.visibleIf });
  }

  const commonAttributes: Array<[string, any]> = [
    ['id', effectiveProps.htmlId ? String(effectiveProps.htmlId).replace(/\s+/g, '-') : null],
    ['class', classes.join(' ')],
    ['title', effectiveProps.title || null],
    ['aria-label', effectiveProps.ariaLabel || null],
    ['data-wv-id', editorId],
    ['data-wv-initially-hidden', isEditor && initiallyHidden ? true : null],
    ['data-wv-component', instance ? instance.componentId : null],
    ['data-wv-behaviors', !isEditor && behaviors.length ? JSON.stringify(behaviors) : null],
    ['data-wv-anim', !isEditor && effectiveProps.entranceAnimation ? effectiveProps.entranceAnimation : null],
    ['data-wv-visible-if', visibleIfKey],
  ];

  const textContent = (text: any): {| html: string, attribute: ?string |} => {
    const raw = text == null ? '' : String(text);
    if (hasStateTemplate(raw)) {
      return { html: textToHtml(interpolateInitialState(project, raw)), attribute: raw };
    }
    return { html: textToHtml(raw), attribute: null };
  };

  const open = (tag: string, extra: Array<[string, any]> = []) =>
    `<${tag}${buildAttributes([...commonAttributes, ...extra])}>`;

  switch (element.type) {
    case ROOT_TYPE:
      return `<div${buildAttributes([
        ['class', 'wv-page wv-' + element.id],
        ['data-wv-id', isEditor ? element.id : null],
      ])}>${renderChildren(element, context, scope)}</div>`;
    case 'section':
    case 'container':
    case 'row':
    case 'grid':
    case 'header':
    case 'navigation':
    case 'footer': {
      const defaultTags = { header: 'header', navigation: 'nav', footer: 'footer', section: 'section' };
      const tag = CONTAINER_TAGS.includes(props.tag) ? props.tag : defaultTags[element.type] || 'div';
      return `${open(tag)}${renderChildren(element, context, scope)}</${tag}>`;
    }
    case 'form':
      return `${open('form', [
        ['action', props.actionUrl || null],
        ['method', props.actionUrl ? props.method || 'post' : null],
        ['novalidate', props.noValidate !== false ? true : null],
      ])}${renderChildren(element, context, scope)}</form>`;
    case 'heading': {
      const tag = /^h[1-6]$/.test(props.level) ? props.level : 'h2';
      const text = textContent(props.text);
      return `${open(tag, [['data-wv-text', text.attribute]])}${text.html}</${tag}>`;
    }
    case 'text': {
      const tag = TEXT_TAGS.includes(props.tag) ? props.tag : 'p';
      const text = textContent(props.text);
      return `${open(tag, [['data-wv-text', text.attribute]])}${text.html}</${tag}>`;
    }
    case 'label': {
      const text = textContent(props.text);
      return `${open('label', [
        ['for', props.forName ? 'wv-field-' + props.forName : null],
        ['data-wv-text', text.attribute],
      ])}${text.html}</label>`;
    }
    case 'button': {
      const text = textContent(props.text);
      const icon = props.icon ? `<span class="wv-button-icon">${renderIconSvg(props.icon)}</span>` : '';
      const label = text.html
        ? `<span class="wv-label"${buildAttributes([['data-wv-text', text.attribute]])}>${text.html}</span>`
        : '';
      if (props.href) {
        const { href, pageId } = resolveHref(context, props.href);
        return `${open('a', [
          ['href', href],
          ['role', 'button'],
          ['data-wv-page', pageId],
          ['target', props.newTab ? '_blank' : null],
          ['rel', props.newTab ? 'noopener noreferrer' : null],
        ])}${icon}${label}</a>`;
      }
      const type = ['button', 'submit', 'reset'].includes(props.buttonType) ? props.buttonType : 'button';
      return `${open('button', [['type', type], ['disabled', !!props.disabled]])}${icon}${label}</button>`;
    }
    case 'link': {
      const { href, pageId } = resolveHref(context, props.href);
      const children = element.children && element.children.length
        ? renderChildren(element, context, scope)
        : null;
      const text = textContent(props.text);
      return `${open('a', [
        ['href', href],
        ['data-wv-page', pageId],
        ['target', props.newTab ? '_blank' : null],
        ['rel', props.newTab ? 'noopener noreferrer' : null],
        ['data-wv-text', children ? null : text.attribute],
      ])}${children !== null ? children : text.html}</a>`;
    }
    case 'list': {
      const tag = props.ordered ? 'ol' : 'ul';
      const items = String(props.items || '')
        .split('\n')
        .filter(item => item.trim())
        .map(item => `<li>${escapeHtml(interpolateInitialState(project, item))}</li>`)
        .join('');
      return `${open(tag)}${items}</${tag}>`;
    }
    case 'divider':
      return open('hr');
    case 'spacer':
      return `${open('div', [['aria-hidden', 'true']])}</div>`;
    case 'icon':
      return `${open('span', [['role', effectiveProps.ariaLabel ? 'img' : null]]).replace(
        'class="',
        'class="wv-icon '
      )}${renderIconSvg(props.icon)}</span>`;
    case 'image': {
      const src = resolveMediaUrl(context, props.src, 'Image');
      return open('img', [
        ['src', src],
        ['alt', props.alt || ''],
        ['loading', props.lazy !== false && !isEditor ? 'lazy' : null],
        ['draggable', isEditor ? 'false' : null],
      ]);
    }
    case 'video': {
      if (props.source === 'file') {
        const src = isAssetReference(props.src)
          ? context.options.resolveAssetUrl(getAssetIdFromReference(props.src))
          : props.src || '';
        return `${open('video', [
          ['src', src || null],
          ['controls', props.controls !== false],
          ['autoplay', !!props.autoplay && !isEditor],
          ['muted', !!props.muted || !!props.autoplay],
          ['loop', !!props.loop],
          ['playsinline', true],
          ['preload', 'metadata'],
        ])}</video>`;
      }
      const url = String(props.url || '');
      let embedUrl = null;
      if (props.source === 'vimeo') {
        const id = getVimeoId(url);
        if (id)
          embedUrl = `https://player.vimeo.com/video/${id}?autoplay=${props.autoplay ? 1 : 0}&muted=${props.muted || props.autoplay ? 1 : 0}&loop=${props.loop ? 1 : 0}`;
      } else {
        const id = getYouTubeId(url);
        if (id)
          embedUrl = `https://www.youtube.com/embed/${id}?autoplay=${props.autoplay ? 1 : 0}&mute=${props.muted || props.autoplay ? 1 : 0}&loop=${props.loop ? 1 : 0}&controls=${props.controls === false ? 0 : 1}${props.loop ? '&playlist=' + id : ''}`;
      }
      if (!embedUrl) {
        return `${open('div')}<div style="padding:24px;color:#64748b">Set a valid video URL</div></div>`;
      }
      return `${open('iframe', [
        ['src', embedUrl],
        ['title', effectiveProps.title || element.name],
        ['allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'],
        ['allowfullscreen', true],
        ['loading', isEditor ? null : 'lazy'],
      ])}</iframe>`;
    }
    case 'input': {
      const name = props.fieldName || element.id;
      return open('input', [
        ['type', props.inputType || 'text'],
        ['name', name],
        ['id', effectiveProps.htmlId ? null : 'wv-field-' + name],
        ['placeholder', props.placeholder || null],
        ['value', props.defaultValue ? interpolateInitialState(project, props.defaultValue) : null],
        ['required', !!props.required],
        ['minlength', props.minLength ? String(props.minLength) : null],
        ['maxlength', props.maxLength ? String(props.maxLength) : null],
        ['pattern', props.pattern || null],
      ]);
    }
    case 'textarea': {
      const name = props.fieldName || element.id;
      return `${open('textarea', [
        ['name', name],
        ['id', effectiveProps.htmlId ? null : 'wv-field-' + name],
        ['rows', String(props.rows || 4)],
        ['placeholder', props.placeholder || null],
        ['required', !!props.required],
      ])}</textarea>`;
    }
    case 'select': {
      const name = props.fieldName || element.id;
      const optionsHtml = String(props.options || '')
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [value, label] = line.includes('|') ? line.split('|') : [line, line];
          return `<option value="${escapeAttribute(value.trim())}">${escapeHtml((label || value).trim())}</option>`;
        })
        .join('');
      return `${open('select', [
        ['name', name],
        ['id', effectiveProps.htmlId ? null : 'wv-field-' + name],
        ['required', !!props.required],
      ])}${optionsHtml}</select>`;
    }
    case 'checkbox': {
      const name = props.fieldName || element.id;
      const text = textContent(props.text);
      return `${open('label')}<input${buildAttributes([
        ['type', 'checkbox'],
        ['name', name],
        ['value', 'yes'],
        ['checked', !!props.checked],
        ['required', !!props.required],
      ])}><span class="wv-label"${buildAttributes([['data-wv-text', text.attribute]])}>${text.html}</span></label>`;
    }
    case 'embed':
      return `${open('div').replace('class="', 'class="wv-embed ')}${String(props.html || '')}</div>`;
    case 'react': {
      const reactComponent = project.reactComponents.find(c => c.id === props.reactComponentId);
      if (!reactComponent) {
        return isEditor ? `${open('div')}<div class="wv-missing">Choose a React component in the Settings panel</div></div>` : '';
      }
      context.usedReactComponentIds.add(reactComponent.id);
      const values = {};
      reactComponent.props.forEach(prop => {
        const raw = props.values && props.values[prop.name] !== undefined && props.values[prop.name] !== ''
          ? props.values[prop.name]
          : prop.defaultValue;
        let value = substituteProps(raw, scope);
        if (prop.type === 'number') value = parseFloat(value) || 0;
        else if (prop.type === 'boolean') value = value === true || value === 'true';
        else if (prop.type === 'image' && isAssetReference(value))
          value = context.options.resolveAssetUrl(getAssetIdFromReference(value));
        values[prop.name] = value;
      });
      return `${open('div', [
        ['data-wv-react', reactComponent.name],
        ['data-wv-props', JSON.stringify(values)],
      ])}</div>`;
    }
    default:
      context.warnings.push(`Unknown element type "${element.type}".`);
      return `${open('div')}${renderChildren(element, context, scope)}</div>`;
  }
};

/** Props of an instance element that apply to the rendered component root. */
const pickInstanceProps = (props: { [string]: any }) => {
  const picked = {};
  ['htmlId', 'extraClasses', 'title', 'ariaLabel', 'initiallyHidden', 'entranceAnimation', 'visibleIf'].forEach(key => {
    if (props[key] !== undefined && props[key] !== '' && props[key] !== false) picked[key] = props[key];
  });
  return picked;
};

export const createRenderContext = (
  project: WebsiteProject,
  options: RenderOptions
): RenderContext => ({
  project,
  options,
  usedComponentIds: new Set(),
  usedReactComponentIds: new Set(),
  visibilityConditions: [],
  elementNames: {},
  warnings: [],
});

/** Render the tree of a page or a component. */
export const renderTree = (
  root: WebsiteElement,
  context: RenderContext,
  {
    propsValues,
    componentId,
  }: {| propsValues?: ?{ [string]: string }, componentId?: ?string |} = {}
): string =>
  renderElement(root, context, {
    propsValues: propsValues || null,
    componentStack: componentId ? [componentId] : [],
    instance: null,
    insideComponent: false,
  });

/** The default values of the props of a component (used when editing it). */
export const getComponentDefaultPropsValues = (component: WebsiteComponent) => {
  const values = {};
  component.props.forEach(prop => {
    values[prop.name] = prop.defaultValue;
  });
  return values;
};
