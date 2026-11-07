// @flow
// Catalog of the elements that can be placed on a webpage.
// This replaces the "object types" of the original game editor: each element
// type describes its HTML rendering, its editable properties and its defaults.
import { newId } from '../Model/Ids';
import { type WebsiteElement, type ElementStyles } from '../Model/Schema';

export type PropFieldType =
  | 'text'
  | 'longText'
  | 'select'
  | 'boolean'
  | 'number'
  | 'image'
  | 'video'
  | 'href'
  | 'icon'
  | 'html'
  | 'component'
  | 'reactComponent'
  | 'lines';

export type PropField = {|
  name: string,
  label: string,
  type: PropFieldType,
  options?: Array<{| value: string, label: string |}>,
  description?: string,
  /** Only show the field if this function returns true. */
  isVisible?: (props: { [string]: any }) => boolean,
|};

export type ElementCategory = 'layout' | 'basic' | 'media' | 'forms' | 'advanced';

export type ElementTypeDefinition = {|
  type: string,
  label: string,
  description: string,
  category: ElementCategory,
  icon: string,
  isContainer: boolean,
  /** Element types that can be dropped inside (null means any). */
  defaultName: string,
  defaultProps: { [string]: any },
  defaultStyles: ElementStyles,
  fields: Array<PropField>,
  /** True if the text of the element can be edited by double-clicking on it in the canvas. */
  inlineEditableTextProp?: string,
|};

const tagOptions = (tags: Array<string>) =>
  tags.map(tag => ({ value: tag, label: `<${tag}>` }));

export const COMMON_FIELDS: Array<PropField> = [
  {
    name: 'htmlId',
    label: 'Anchor id (for links like #contact)',
    type: 'text',
  },
  { name: 'extraClasses', label: 'Extra CSS classes', type: 'text' },
  { name: 'title', label: 'Tooltip (title)', type: 'text' },
  { name: 'ariaLabel', label: 'Accessible label (aria-label)', type: 'text' },
  {
    name: 'initiallyHidden',
    label: 'Hidden when the page loads (show it with an interaction)',
    type: 'boolean',
  },
  {
    name: 'entranceAnimation',
    label: 'Entrance animation',
    type: 'select',
    options: [
      { value: '', label: 'None' },
      { value: 'fade-in', label: 'Fade in' },
      { value: 'fade-up', label: 'Fade up' },
      { value: 'fade-down', label: 'Fade down' },
      { value: 'slide-left', label: 'Slide from right' },
      { value: 'slide-right', label: 'Slide from left' },
      { value: 'zoom-in', label: 'Zoom in' },
    ],
    description:
      'Played when the element scrolls into view for the first time.',
  },
];

const containerTags = ['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav'];

export const ELEMENT_TYPES: Array<ElementTypeDefinition> = [
  // Layout
  {
    type: 'section',
    label: 'Section',
    description: 'A full-width band of the page, holding content.',
    category: 'layout',
    icon: 'section',
    isContainer: true,
    defaultName: 'Section',
    defaultProps: { tag: 'section' },
    defaultStyles: {
      desktop: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '64px 32px',
      },
      mobile: { padding: '40px 20px' },
    },
    fields: [
      { name: 'tag', label: 'HTML tag', type: 'select', options: tagOptions(containerTags) },
    ],
  },
  {
    type: 'container',
    label: 'Container',
    description: 'A box to group and lay out other elements.',
    category: 'layout',
    icon: 'container',
    isContainer: true,
    defaultName: 'Container',
    defaultProps: { tag: 'div' },
    defaultStyles: {
      desktop: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
      },
    },
    fields: [
      { name: 'tag', label: 'HTML tag', type: 'select', options: tagOptions(containerTags) },
    ],
  },
  {
    type: 'row',
    label: 'Row (columns)',
    description: 'Places its children side by side, wrapping on small screens.',
    category: 'layout',
    icon: 'row',
    isContainer: true,
    defaultName: 'Row',
    defaultProps: { tag: 'div' },
    defaultStyles: {
      desktop: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '24px',
        alignItems: 'center',
      },
      mobile: { flexDirection: 'column', alignItems: 'stretch' },
    },
    fields: [
      { name: 'tag', label: 'HTML tag', type: 'select', options: tagOptions(containerTags) },
    ],
  },
  {
    type: 'grid',
    label: 'Grid',
    description: 'A CSS grid, with columns that adapt to the screen size.',
    category: 'layout',
    icon: 'grid',
    isContainer: true,
    defaultName: 'Grid',
    defaultProps: { tag: 'div' },
    defaultStyles: {
      desktop: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '24px',
      },
      tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
      mobile: { gridTemplateColumns: 'minmax(0, 1fr)' },
    },
    fields: [
      { name: 'tag', label: 'HTML tag', type: 'select', options: tagOptions(containerTags) },
    ],
  },
  {
    type: 'header',
    label: 'Header',
    description: 'The top area of a page, usually holding a logo and the navigation.',
    category: 'layout',
    icon: 'header',
    isContainer: true,
    defaultName: 'Header',
    defaultProps: { tag: 'header' },
    defaultStyles: {
      desktop: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        padding: '16px 32px',
      },
    },
    fields: [],
  },
  {
    type: 'navigation',
    label: 'Navigation',
    description: 'A list of links to the pages of the website.',
    category: 'layout',
    icon: 'navigation',
    isContainer: true,
    defaultName: 'Navigation',
    defaultProps: { tag: 'nav' },
    defaultStyles: {
      desktop: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '24px',
      },
    },
    fields: [],
  },
  {
    type: 'footer',
    label: 'Footer',
    description: 'The bottom area of a page.',
    category: 'layout',
    icon: 'footer',
    isContainer: true,
    defaultName: 'Footer',
    defaultProps: { tag: 'footer' },
    defaultStyles: {
      desktop: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '32px',
      },
    },
    fields: [],
  },
  // Basic
  {
    type: 'heading',
    label: 'Heading',
    description: 'A title (h1 to h6).',
    category: 'basic',
    icon: 'heading',
    isContainer: false,
    defaultName: 'Heading',
    defaultProps: { text: 'A great heading', level: 'h2' },
    defaultStyles: { desktop: { margin: '0' } },
    fields: [
      { name: 'text', label: 'Text', type: 'longText' },
      {
        name: 'level',
        label: 'Level',
        type: 'select',
        options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(level => ({
          value: level,
          label: level.toUpperCase(),
        })),
      },
    ],
    inlineEditableTextProp: 'text',
  },
  {
    type: 'text',
    label: 'Text',
    description: 'A paragraph of text. Use {{state.variable}} to display a variable.',
    category: 'basic',
    icon: 'text',
    isContainer: false,
    defaultName: 'Text',
    defaultProps: {
      text:
        'Write something meaningful here. Double-click on the text in the canvas to edit it.',
      tag: 'p',
    },
    defaultStyles: { desktop: { margin: '0' } },
    fields: [
      { name: 'text', label: 'Text', type: 'longText' },
      {
        name: 'tag',
        label: 'HTML tag',
        type: 'select',
        options: tagOptions(['p', 'span', 'div', 'blockquote', 'small', 'strong', 'em', 'label']),
      },
    ],
    inlineEditableTextProp: 'text',
  },
  {
    type: 'button',
    label: 'Button',
    description: 'A clickable button. Add interactions to make it do something.',
    category: 'basic',
    icon: 'button',
    isContainer: false,
    defaultName: 'Button',
    defaultProps: { text: 'Click me', buttonType: 'button', href: '', newTab: false, icon: '' },
    defaultStyles: {
      desktop: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 24px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: 'var(--color-primary)',
        color: '#ffffff',
        fontWeight: '600',
        fontSize: '16px',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        alignSelf: 'flex-start',
      },
      hover: { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
    },
    fields: [
      { name: 'text', label: 'Text', type: 'text' },
      {
        name: 'buttonType',
        label: 'Button type',
        type: 'select',
        options: [
          { value: 'button', label: 'Normal button' },
          { value: 'submit', label: 'Submit the form' },
          { value: 'reset', label: 'Reset the form' },
        ],
      },
      {
        name: 'href',
        label: 'Link (optional, turns the button into a link)',
        type: 'href',
      },
      { name: 'newTab', label: 'Open link in a new tab', type: 'boolean' },
      { name: 'icon', label: 'Icon (optional)', type: 'icon' },
      { name: 'disabled', label: 'Disabled', type: 'boolean' },
    ],
    inlineEditableTextProp: 'text',
  },
  {
    type: 'link',
    label: 'Link',
    description: 'A link to a page, a section or another website. Can contain other elements.',
    category: 'basic',
    icon: 'link',
    isContainer: true,
    defaultName: 'Link',
    defaultProps: { text: 'A link', href: '#', newTab: false },
    defaultStyles: {
      desktop: { color: 'var(--color-primary)', textDecoration: 'none' },
      hover: { textDecoration: 'underline' },
    },
    fields: [
      { name: 'text', label: 'Text (when the link has no children)', type: 'text' },
      { name: 'href', label: 'Destination', type: 'href' },
      { name: 'newTab', label: 'Open in a new tab', type: 'boolean' },
    ],
    inlineEditableTextProp: 'text',
  },
  {
    type: 'list',
    label: 'List',
    description: 'A bullet or numbered list. One item per line.',
    category: 'basic',
    icon: 'list',
    isContainer: false,
    defaultName: 'List',
    defaultProps: { items: 'First item\nSecond item\nThird item', ordered: false },
    defaultStyles: { desktop: { margin: '0', paddingLeft: '20px' } },
    fields: [
      { name: 'items', label: 'Items (one per line)', type: 'lines' },
      { name: 'ordered', label: 'Numbered list', type: 'boolean' },
    ],
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'A horizontal line.',
    category: 'basic',
    icon: 'divider',
    isContainer: false,
    defaultName: 'Divider',
    defaultProps: {},
    defaultStyles: {
      desktop: {
        border: 'none',
        borderTop: '1px solid rgba(0,0,0,0.12)',
        margin: '8px 0',
        width: '100%',
      },
    },
    fields: [],
  },
  {
    type: 'spacer',
    label: 'Spacer',
    description: 'Empty space between elements.',
    category: 'basic',
    icon: 'spacer',
    isContainer: false,
    defaultName: 'Spacer',
    defaultProps: {},
    defaultStyles: { desktop: { height: '32px', flexShrink: '0' } },
    fields: [],
  },
  {
    type: 'icon',
    label: 'Icon',
    description: 'A vector icon. Its color follows the text color.',
    category: 'basic',
    icon: 'icon',
    isContainer: false,
    defaultName: 'Icon',
    defaultProps: { icon: 'star' },
    defaultStyles: {
      desktop: {
        width: '32px',
        height: '32px',
        color: 'var(--color-primary)',
        flexShrink: '0',
      },
    },
    fields: [{ name: 'icon', label: 'Icon', type: 'icon' }],
  },
  // Media
  {
    type: 'image',
    label: 'Image',
    description: 'A picture, from the assets of the website or an URL.',
    category: 'media',
    icon: 'image',
    isContainer: false,
    defaultName: 'Image',
    defaultProps: { src: '', alt: '', lazy: true },
    defaultStyles: {
      desktop: {
        display: 'block',
        width: '100%',
        height: 'auto',
        objectFit: 'cover',
        borderRadius: '8px',
      },
    },
    fields: [
      { name: 'src', label: 'Image', type: 'image' },
      { name: 'alt', label: 'Alternative text (for accessibility)', type: 'text' },
      { name: 'lazy', label: 'Load only when visible (lazy loading)', type: 'boolean' },
    ],
  },
  {
    type: 'video',
    label: 'Video',
    description: 'A video file, or a YouTube/Vimeo video.',
    category: 'media',
    icon: 'video',
    isContainer: false,
    defaultName: 'Video',
    defaultProps: {
      source: 'youtube',
      src: '',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
    },
    defaultStyles: {
      desktop: { display: 'block', width: '100%', aspectRatio: '16 / 9', border: 'none', borderRadius: '8px' },
    },
    fields: [
      {
        name: 'source',
        label: 'Source',
        type: 'select',
        options: [
          { value: 'file', label: 'Video file (asset or URL)' },
          { value: 'youtube', label: 'YouTube' },
          { value: 'vimeo', label: 'Vimeo' },
        ],
      },
      {
        name: 'src',
        label: 'Video file',
        type: 'video',
        isVisible: props => props.source === 'file',
      },
      {
        name: 'url',
        label: 'Video page URL',
        type: 'text',
        isVisible: props => props.source !== 'file',
      },
      { name: 'controls', label: 'Show controls', type: 'boolean' },
      { name: 'autoplay', label: 'Autoplay', type: 'boolean' },
      { name: 'loop', label: 'Loop', type: 'boolean' },
      { name: 'muted', label: 'Muted', type: 'boolean' },
    ],
  },
  // Forms
  {
    type: 'form',
    label: 'Form',
    description: 'Groups inputs. Use the "Form submitted" interaction to react to it.',
    category: 'forms',
    icon: 'form',
    isContainer: true,
    defaultName: 'Form',
    defaultProps: { actionUrl: '', method: 'post', noValidate: true },
    defaultStyles: {
      desktop: { display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '520px' },
    },
    fields: [
      {
        name: 'actionUrl',
        label: 'Send the form to this URL (optional, otherwise handle it with interactions)',
        type: 'text',
      },
      {
        name: 'method',
        label: 'Method',
        type: 'select',
        options: [{ value: 'post', label: 'POST' }, { value: 'get', label: 'GET' }],
      },
      {
        name: 'noValidate',
        label: 'Let interactions validate the form (no browser popups)',
        type: 'boolean',
      },
    ],
  },
  {
    type: 'label',
    label: 'Label',
    description: 'A label describing an input.',
    category: 'forms',
    icon: 'label',
    isContainer: false,
    defaultName: 'Label',
    defaultProps: { text: 'Your name', forName: '' },
    defaultStyles: { desktop: { fontWeight: '600', fontSize: '14px' } },
    fields: [
      { name: 'text', label: 'Text', type: 'text' },
      { name: 'forName', label: 'Input name it describes', type: 'text' },
    ],
    inlineEditableTextProp: 'text',
  },
  {
    type: 'input',
    label: 'Input field',
    description: 'A single line field: text, email, number, date...',
    category: 'forms',
    icon: 'input',
    isContainer: false,
    defaultName: 'Input',
    defaultProps: {
      inputType: 'text',
      fieldName: 'name',
      placeholder: 'Type here...',
      required: false,
      defaultValue: '',
      minLength: '',
      maxLength: '',
      pattern: '',
    },
    defaultStyles: {
      desktop: {
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '16px',
        width: '100%',
        boxSizing: 'border-box',
      },
      focus: { outline: '2px solid var(--color-primary)', outlineOffset: '1px' },
    },
    fields: [
      {
        name: 'inputType',
        label: 'Type',
        type: 'select',
        options: ['text', 'email', 'password', 'number', 'tel', 'url', 'date', 'time', 'search', 'color', 'range'].map(
          value => ({ value, label: value })
        ),
      },
      { name: 'fieldName', label: 'Field name', type: 'text' },
      { name: 'placeholder', label: 'Placeholder', type: 'text' },
      { name: 'defaultValue', label: 'Default value', type: 'text' },
      { name: 'required', label: 'Required', type: 'boolean' },
      { name: 'minLength', label: 'Minimum length', type: 'number' },
      { name: 'maxLength', label: 'Maximum length', type: 'number' },
      { name: 'pattern', label: 'Pattern (regular expression)', type: 'text' },
    ],
  },
  {
    type: 'textarea',
    label: 'Text area',
    description: 'A multi-line text field.',
    category: 'forms',
    icon: 'textarea',
    isContainer: false,
    defaultName: 'Text area',
    defaultProps: { fieldName: 'message', placeholder: 'Your message...', rows: 5, required: false },
    defaultStyles: {
      desktop: {
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '16px',
        fontFamily: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
      },
      focus: { outline: '2px solid var(--color-primary)', outlineOffset: '1px' },
    },
    fields: [
      { name: 'fieldName', label: 'Field name', type: 'text' },
      { name: 'placeholder', label: 'Placeholder', type: 'text' },
      { name: 'rows', label: 'Rows', type: 'number' },
      { name: 'required', label: 'Required', type: 'boolean' },
    ],
  },
  {
    type: 'select',
    label: 'Dropdown list',
    description: 'A list of choices.',
    category: 'forms',
    icon: 'select',
    isContainer: false,
    defaultName: 'Select',
    defaultProps: {
      fieldName: 'choice',
      options: 'option-1|First option\noption-2|Second option\noption-3|Third option',
      required: false,
    },
    defaultStyles: {
      desktop: {
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '16px',
        width: '100%',
      },
    },
    fields: [
      { name: 'fieldName', label: 'Field name', type: 'text' },
      {
        name: 'options',
        label: 'Options (one per line, as value|Label)',
        type: 'lines',
      },
      { name: 'required', label: 'Required', type: 'boolean' },
    ],
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    description: 'A checkbox with its label.',
    category: 'forms',
    icon: 'checkbox',
    isContainer: false,
    defaultName: 'Checkbox',
    defaultProps: { text: 'I agree', fieldName: 'agree', checked: false, required: false },
    defaultStyles: {
      desktop: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
    },
    fields: [
      { name: 'text', label: 'Label', type: 'text' },
      { name: 'fieldName', label: 'Field name', type: 'text' },
      { name: 'checked', label: 'Checked by default', type: 'boolean' },
      { name: 'required', label: 'Required', type: 'boolean' },
    ],
    inlineEditableTextProp: 'text',
  },
  // Advanced
  {
    type: 'component',
    label: 'Component',
    description: 'An instance of a reusable component of the website.',
    category: 'advanced',
    icon: 'component',
    isContainer: false,
    defaultName: 'Component',
    defaultProps: { componentId: '', values: {} },
    defaultStyles: {},
    fields: [{ name: 'componentId', label: 'Component', type: 'component' }],
  },
  {
    type: 'react',
    label: 'React component',
    description: 'A React component written in JSX, rendered on the page.',
    category: 'advanced',
    icon: 'react',
    isContainer: false,
    defaultName: 'React component',
    defaultProps: { reactComponentId: '', values: {} },
    defaultStyles: {},
    fields: [
      { name: 'reactComponentId', label: 'React component', type: 'reactComponent' },
    ],
  },
  {
    type: 'embed',
    label: 'HTML embed',
    description: 'Custom HTML code (maps, widgets, iframes...).',
    category: 'advanced',
    icon: 'embed',
    isContainer: false,
    defaultName: 'HTML embed',
    defaultProps: {
      html: '<div style="padding:16px;border:1px dashed #94a3b8;border-radius:8px">Custom HTML</div>',
    },
    defaultStyles: {},
    fields: [{ name: 'html', label: 'HTML code', type: 'html' }],
  },
];

const elementTypesByType: { [string]: ElementTypeDefinition } = {};
ELEMENT_TYPES.forEach(definition => {
  elementTypesByType[definition.type] = definition;
});

/** The root element of every page/component. */
export const ROOT_TYPE = 'body';

const rootDefinition: ElementTypeDefinition = {
  type: ROOT_TYPE,
  label: 'Page body',
  description: 'The body of the page, containing all its elements.',
  category: 'layout',
  icon: 'page',
  isContainer: true,
  defaultName: 'Body',
  defaultProps: {},
  defaultStyles: {},
  fields: [],
};

export const getElementType = (type: string): ElementTypeDefinition =>
  type === ROOT_TYPE
    ? rootDefinition
    : elementTypesByType[type] || {
        ...rootDefinition,
        type,
        label: `Unknown (${type})`,
        isContainer: false,
      };

/** Register an additional element type (used by extensions). */
export const registerElementType = (definition: ElementTypeDefinition) => {
  if (elementTypesByType[definition.type]) return;
  ELEMENT_TYPES.push(definition);
  elementTypesByType[definition.type] = definition;
};

export const ELEMENT_CATEGORIES: Array<{| id: ElementCategory, label: string |}> = [
  { id: 'layout', label: 'Layout' },
  { id: 'basic', label: 'Basic' },
  { id: 'media', label: 'Media' },
  { id: 'forms', label: 'Forms' },
  { id: 'advanced', label: 'Advanced' },
];

const deepCopy = (value: any): any => JSON.parse(JSON.stringify(value));

export const createElement = (
  type: string,
  overrides: {
    name?: string,
    props?: { [string]: any },
    styles?: ElementStyles,
    children?: Array<WebsiteElement>,
    behaviors?: Array<any>,
    classIds?: Array<string>,
  } = {}
): WebsiteElement => {
  const definition = getElementType(type);
  const styles = deepCopy(definition.defaultStyles);
  if (overrides.styles) {
    Object.keys(overrides.styles).forEach(key => {
      // $FlowFixMe[invalid-computed-prop]
      styles[key] = { ...(styles[key] || {}), ...(overrides.styles || {})[key] };
    });
  }
  return {
    id: newId('e'),
    type,
    name: overrides.name || definition.defaultName,
    props: { ...deepCopy(definition.defaultProps), ...(overrides.props || {}) },
    styles,
    classIds: overrides.classIds || [],
    behaviors: overrides.behaviors || [],
    children: overrides.children || [],
  };
};

export const createRootElement = (children: Array<WebsiteElement> = []): WebsiteElement => ({
  id: newId('r'),
  type: ROOT_TYPE,
  name: 'Body',
  props: {},
  styles: {},
  classIds: [],
  behaviors: [],
  children,
});

export const canContainChildren = (element: WebsiteElement): boolean =>
  getElementType(element.type).isContainer;
