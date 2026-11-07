// @flow
// Behaviors add ready-made interactive functionality to an element
// (like behaviors added to objects in the original editor).
// Their implementation lives in the Webvelop runtime
// (public/webvelop-runtime/webvelop-runtime.js), under the same `type`.

export type BehaviorConfigField = {|
  name: string,
  label: string,
  type: 'number' | 'boolean' | 'select' | 'text',
  defaultValue: any,
  options?: Array<{| value: string, label: string |}>,
|};

export type BehaviorTypeDefinition = {|
  type: string,
  label: string,
  description: string,
  structure: string,
  fields: Array<BehaviorConfigField>,
|};

export const BEHAVIOR_TYPES: Array<BehaviorTypeDefinition> = [
  {
    type: 'tabs',
    label: 'Tabs',
    description: 'Shows one panel at a time, selected by clicking on its tab.',
    structure:
      'First child: the row of tab buttons. Second child: the panels (one per tab). The active tab receives the "Active" style state.',
    fields: [
      { name: 'initialIndex', label: 'Initially opened tab (starting at 0)', type: 'number', defaultValue: 0 },
    ],
  },
  {
    type: 'accordion',
    label: 'Accordion',
    description: 'Items that expand and collapse when their header is clicked.',
    structure:
      'Each child is an item: its first child is the header, its second child is the content.',
    fields: [
      { name: 'allowMultiple', label: 'Allow several items to be opened', type: 'boolean', defaultValue: false },
      { name: 'firstOpen', label: 'First item opened at start', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'carousel',
    label: 'Carousel / slider',
    description: 'Shows its slides one at a time, with arrows, dots and autoplay.',
    structure: 'Each child is a slide.',
    fields: [
      { name: 'autoplay', label: 'Autoplay delay in seconds (0 to disable)', type: 'number', defaultValue: 5 },
      { name: 'loop', label: 'Loop', type: 'boolean', defaultValue: true },
      { name: 'showArrows', label: 'Show arrows', type: 'boolean', defaultValue: true },
      { name: 'showDots', label: 'Show dots', type: 'boolean', defaultValue: true },
      { name: 'swipe', label: 'Swipe on touch screens', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'modal',
    label: 'Popup (modal)',
    description:
      'Displays the element above the page. Open it with the "Open popup" action.',
    structure:
      'The element is the dark overlay covering the page. Put the popup box inside it.',
    fields: [
      { name: 'closeOnBackdrop', label: 'Close when clicking outside of the box', type: 'boolean', defaultValue: true },
      { name: 'closeOnEscape', label: 'Close with the Escape key', type: 'boolean', defaultValue: true },
      { name: 'lockScroll', label: 'Prevent the page from scrolling while open', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'dropdown',
    label: 'Dropdown menu',
    description: 'A menu that opens when its trigger is clicked or hovered.',
    structure: 'First child: the trigger (a button). Second child: the menu.',
    fields: [
      {
        name: 'openOn',
        label: 'Open on',
        type: 'select',
        defaultValue: 'click',
        options: [{ value: 'click', label: 'Click' }, { value: 'hover', label: 'Hover' }],
      },
    ],
  },
  {
    type: 'lightbox',
    label: 'Image gallery (lightbox)',
    description:
      'Clicking an image inside the element opens it in full screen, with previous/next navigation.',
    structure: 'Put images inside the element (any depth).',
    fields: [],
  },
  {
    type: 'stickyHeader',
    label: 'Sticky on scroll',
    description:
      'Keeps the element at the top of the screen when scrolling, and gives it the "Active" style once the page is scrolled.',
    structure: 'Usually applied to the header.',
    fields: [
      { name: 'offset', label: 'Scroll distance (px) before becoming active', type: 'number', defaultValue: 40 },
    ],
  },
  {
    type: 'counter',
    label: 'Animated number',
    description: 'Counts from 0 to the number written in the element when it scrolls into view.',
    structure: 'Apply to a text or heading containing a number.',
    fields: [
      { name: 'duration', label: 'Duration (ms)', type: 'number', defaultValue: 1500 },
    ],
  },
];

const behaviorsByType: { [string]: BehaviorTypeDefinition } = {};
BEHAVIOR_TYPES.forEach(definition => {
  behaviorsByType[definition.type] = definition;
});

export const getBehaviorType = (type: string): ?BehaviorTypeDefinition =>
  behaviorsByType[type] || null;

export const registerBehaviorType = (definition: BehaviorTypeDefinition) => {
  if (behaviorsByType[definition.type]) return;
  BEHAVIOR_TYPES.push(definition);
  behaviorsByType[definition.type] = definition;
};

export const getDefaultBehaviorConfig = (type: string): { [string]: any } => {
  const definition = getBehaviorType(type);
  const config = {};
  if (!definition) return config;
  definition.fields.forEach(field => {
    config[field.name] = field.defaultValue;
  });
  return config;
};
