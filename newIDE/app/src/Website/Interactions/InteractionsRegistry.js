// @flow
// The website interactions system ("When ... if ... then do ...").
//
// This replaces the game events/instructions metadata of the original editor
// with website oriented triggers, conditions and actions. Each definition has:
// - editor metadata (label, sentence, parameters) used by the interactions
//   editor,
// - an implementation, with the same `type`, in the Webvelop runtime
//   (public/webvelop-runtime/webvelop-runtime.js).
//
// New triggers, conditions and actions can be added with the `register*`
// functions (and their implementation with `Webvelop.registerAction` etc. in
// the runtime). Users can also define their own actions in JavaScript
// (the "custom actions" of a project), that are listed here too.

export type ParamType =
  | 'element'
  | 'form'
  | 'page'
  | 'variable'
  | 'text'
  | 'longText'
  | 'number'
  | 'boolean'
  | 'select'
  | 'className'
  | 'cssProperty'
  | 'code'
  | 'url'
  | 'key'
  | 'operator'
  | 'breakpoint'
  | 'elements';

export type ParamDefinition = {|
  name: string,
  label: string,
  type: ParamType,
  defaultValue?: any,
  options?: Array<{| value: string, label: string |}>,
  optional?: boolean,
  description?: string,
|};

export type TriggerDefinition = {|
  type: string,
  label: string,
  group: string,
  description: string,
  /** 'element' triggers are attached to an element, 'page' ones to the page itself. */
  targetKind: 'element' | 'page',
  sentence: string,
  params: Array<ParamDefinition>,
|};

export type InstructionDefinition = {|
  type: string,
  label: string,
  group: string,
  description: string,
  sentence: string,
  params: Array<ParamDefinition>,
  /** True for actions that wait (the following actions run after it). */
  isAsync?: boolean,
  /** Set for user-defined actions of the project. */
  isCustom?: boolean,
|};

const animationOptions = [
  { value: 'fade-in', label: 'Fade in' },
  { value: 'fade-out', label: 'Fade out' },
  { value: 'fade-up', label: 'Fade up' },
  { value: 'zoom-in', label: 'Zoom in' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'shake', label: 'Shake' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'spin', label: 'Spin' },
  { value: 'wobble', label: 'Wobble' },
];

export const OPERATOR_OPTIONS = [
  { value: '==', label: 'equal to' },
  { value: '!=', label: 'different from' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'less or equal to' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'greater or equal to' },
  { value: 'contains', label: 'containing' },
  { value: 'empty', label: 'empty' },
  { value: 'notEmpty', label: 'not empty' },
];

const target = (label: string = 'Element'): ParamDefinition => ({
  name: 'target',
  label,
  type: 'element',
  defaultValue: '$self',
});

export const TRIGGERS: Array<TriggerDefinition> = [
  {
    type: 'click',
    label: 'Clicked',
    group: 'Mouse and touch',
    description: 'When the element is clicked (or tapped).',
    targetKind: 'element',
    sentence: 'When {target} is clicked',
    params: [],
  },
  {
    type: 'dblclick',
    label: 'Double-clicked',
    group: 'Mouse and touch',
    description: 'When the element is double-clicked.',
    targetKind: 'element',
    sentence: 'When {target} is double-clicked',
    params: [],
  },
  {
    type: 'mouseenter',
    label: 'Mouse enters',
    group: 'Mouse and touch',
    description: 'When the mouse cursor enters the element.',
    targetKind: 'element',
    sentence: 'When the mouse enters {target}',
    params: [],
  },
  {
    type: 'mouseleave',
    label: 'Mouse leaves',
    group: 'Mouse and touch',
    description: 'When the mouse cursor leaves the element.',
    targetKind: 'element',
    sentence: 'When the mouse leaves {target}',
    params: [],
  },
  {
    type: 'submit',
    label: 'Form submitted',
    group: 'Forms',
    description:
      'When a form is submitted. By default, the page is not reloaded so that the form can be handled by actions.',
    targetKind: 'element',
    sentence: 'When the form {target} is submitted',
    params: [
      {
        name: 'preventDefault',
        label: 'Handle the form with the actions (do not reload the page)',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    type: 'input',
    label: 'Value typed',
    group: 'Forms',
    description: 'Each time the value of an input changes, while typing.',
    targetKind: 'element',
    sentence: 'When the value of {target} is typed',
    params: [],
  },
  {
    type: 'change',
    label: 'Value changed',
    group: 'Forms',
    description: 'When the value of an input, a checkbox or a dropdown list is changed.',
    targetKind: 'element',
    sentence: 'When the value of {target} changes',
    params: [],
  },
  {
    type: 'focus',
    label: 'Focused',
    group: 'Forms',
    description: 'When the element receives the keyboard focus.',
    targetKind: 'element',
    sentence: 'When {target} is focused',
    params: [],
  },
  {
    type: 'blur',
    label: 'Focus lost',
    group: 'Forms',
    description: 'When the element loses the keyboard focus.',
    targetKind: 'element',
    sentence: 'When {target} loses the focus',
    params: [],
  },
  {
    type: 'inView',
    label: 'Scrolled into view',
    group: 'Scroll',
    description: 'When the element becomes visible on the screen.',
    targetKind: 'element',
    sentence: 'When {target} scrolls into view',
    params: [
      { name: 'once', label: 'Only the first time', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'outOfView',
    label: 'Scrolled out of view',
    group: 'Scroll',
    description: 'When the element is no longer visible on the screen.',
    targetKind: 'element',
    sentence: 'When {target} scrolls out of view',
    params: [],
  },
  {
    type: 'pageLoad',
    label: 'Page loaded',
    group: 'Page',
    description: 'When the page is loaded and ready.',
    targetKind: 'page',
    sentence: 'When the page is loaded',
    params: [],
  },
  {
    type: 'scroll',
    label: 'Page scrolled past',
    group: 'Scroll',
    description: 'When the page is scrolled further than a distance (and when it goes back).',
    targetKind: 'page',
    sentence: 'When the page is scrolled past {distance}px',
    params: [
      { name: 'distance', label: 'Distance (px)', type: 'number', defaultValue: 200 },
      {
        name: 'direction',
        label: 'Direction',
        type: 'select',
        defaultValue: 'down',
        options: [
          { value: 'down', label: 'Scrolling down past it' },
          { value: 'up', label: 'Scrolling back up above it' },
        ],
      },
    ],
  },
  {
    type: 'keydown',
    label: 'Key pressed',
    group: 'Keyboard',
    description: 'When a key of the keyboard is pressed on the page.',
    targetKind: 'page',
    sentence: 'When the key {key} is pressed',
    params: [
      {
        name: 'key',
        label: 'Key (like Escape, Enter, a, ArrowLeft...)',
        type: 'key',
        defaultValue: 'Escape',
      },
    ],
  },
  {
    type: 'timer',
    label: 'Timer',
    group: 'Page',
    description: 'After a delay, optionally repeated.',
    targetKind: 'page',
    sentence: 'After {delay} seconds',
    params: [
      { name: 'delay', label: 'Delay (seconds)', type: 'number', defaultValue: 3 },
      { name: 'repeat', label: 'Repeat', type: 'boolean', defaultValue: false },
    ],
  },
  {
    type: 'variableChanged',
    label: 'Variable changed',
    group: 'State',
    description: 'When a variable of the website state is changed.',
    targetKind: 'page',
    sentence: 'When the variable {variable} changes',
    params: [{ name: 'variable', label: 'Variable', type: 'variable', defaultValue: '' }],
  },
  {
    type: 'breakpointChanged',
    label: 'Screen size changed',
    group: 'Page',
    description: 'When the screen crosses a responsive breakpoint (desktop, tablet, mobile).',
    targetKind: 'page',
    sentence: 'When the screen size becomes {breakpoint}',
    params: [{ name: 'breakpoint', label: 'Screen size', type: 'breakpoint', defaultValue: 'mobile' }],
  },
];

export const CONDITIONS: Array<InstructionDefinition> = [
  {
    type: 'formIsValid',
    label: 'Form is valid',
    group: 'Forms',
    description: 'Check that all the fields of the form are correctly filled (required, email format...).',
    sentence: 'The form {target} is valid',
    params: [target('Form')],
  },
  {
    type: 'inputValue',
    label: 'Value of an input',
    group: 'Forms',
    description: 'Compare the value of an input, text area or dropdown list.',
    sentence: 'The value of {target} is {operator} {value}',
    params: [
      target('Input'),
      { name: 'operator', label: 'Comparison', type: 'operator', defaultValue: '==' },
      { name: 'value', label: 'Value', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'isChecked',
    label: 'Checkbox is checked',
    group: 'Forms',
    description: 'Check if a checkbox is checked.',
    sentence: '{target} is checked',
    params: [target('Checkbox')],
  },
  {
    type: 'isVisible',
    label: 'Element is visible',
    group: 'Elements',
    description: 'Check if an element is displayed (not hidden).',
    sentence: '{target} is visible',
    params: [target()],
  },
  {
    type: 'hasClass',
    label: 'Element has a class',
    group: 'Elements',
    description: 'Check if an element has a CSS class.',
    sentence: '{target} has the class {className}',
    params: [target(), { name: 'className', label: 'Class', type: 'className', defaultValue: 'is-active' }],
  },
  {
    type: 'variableCompare',
    label: 'Compare a variable',
    group: 'State',
    description: 'Compare the value of a variable of the website state.',
    sentence: 'The variable {variable} is {operator} {value}',
    params: [
      { name: 'variable', label: 'Variable', type: 'variable', defaultValue: '' },
      { name: 'operator', label: 'Comparison', type: 'operator', defaultValue: '==' },
      { name: 'value', label: 'Value', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'screenSize',
    label: 'Screen size',
    group: 'Page',
    description: 'Check the current screen size (responsive breakpoint).',
    sentence: 'The screen size is {breakpoint}',
    params: [{ name: 'breakpoint', label: 'Screen size', type: 'breakpoint', defaultValue: 'mobile' }],
  },
  {
    type: 'currentPage',
    label: 'Current page',
    group: 'Page',
    description: 'Check which page is displayed (useful for interactions running on every page).',
    sentence: 'The current page is {page}',
    params: [{ name: 'page', label: 'Page', type: 'page', defaultValue: '' }],
  },
  {
    type: 'javascript',
    label: 'JavaScript expression',
    group: 'Code',
    description:
      'Evaluate a JavaScript expression. Available: elements (the elements chosen below, like elements.title.isVisible()), element, event, state, Webvelop.',
    sentence: 'The JavaScript expression is true: {code}',
    params: [
      {
        name: 'elements',
        label: 'Elements passed to the code',
        type: 'elements',
        defaultValue: [],
        description: 'Pick elements on the page: they are available in the code as elements.<name>.',
      },
      { name: 'code', label: 'Expression', type: 'code', defaultValue: 'state.get("count") > 3' },
    ],
  },
];

export const ACTIONS: Array<InstructionDefinition> = [
  // Visibility
  {
    type: 'show',
    label: 'Show',
    group: 'Visibility',
    description: 'Show a hidden element.',
    sentence: 'Show {target}',
    params: [target()],
  },
  {
    type: 'hide',
    label: 'Hide',
    group: 'Visibility',
    description: 'Hide an element.',
    sentence: 'Hide {target}',
    params: [target()],
  },
  {
    type: 'toggleVisibility',
    label: 'Toggle visibility',
    group: 'Visibility',
    description: 'Show the element if hidden, hide it otherwise.',
    sentence: 'Toggle the visibility of {target}',
    params: [target()],
  },
  // Classes and style
  {
    type: 'addClass',
    label: 'Add a class',
    group: 'Style',
    description: 'Add a CSS class to an element. "is-active" applies the "Active" style state.',
    sentence: 'Add the class {className} to {target}',
    params: [target(), { name: 'className', label: 'Class', type: 'className', defaultValue: 'is-active' }],
  },
  {
    type: 'removeClass',
    label: 'Remove a class',
    group: 'Style',
    description: 'Remove a CSS class from an element.',
    sentence: 'Remove the class {className} from {target}',
    params: [target(), { name: 'className', label: 'Class', type: 'className', defaultValue: 'is-active' }],
  },
  {
    type: 'toggleClass',
    label: 'Toggle a class',
    group: 'Style',
    description: 'Add a CSS class if missing, remove it otherwise.',
    sentence: 'Toggle the class {className} on {target}',
    params: [target(), { name: 'className', label: 'Class', type: 'className', defaultValue: 'is-active' }],
  },
  {
    type: 'setStyle',
    label: 'Change a style',
    group: 'Style',
    description: 'Change a CSS property of an element.',
    sentence: 'Set {property} of {target} to {value}',
    params: [
      target(),
      { name: 'property', label: 'CSS property', type: 'cssProperty', defaultValue: 'backgroundColor' },
      { name: 'value', label: 'Value', type: 'text', defaultValue: '#ffcc00' },
    ],
  },
  {
    type: 'animate',
    label: 'Play an animation',
    group: 'Style',
    description: 'Play an animation on an element.',
    sentence: 'Play the animation {animation} on {target} ({duration}ms)',
    params: [
      target(),
      { name: 'animation', label: 'Animation', type: 'select', defaultValue: 'pulse', options: animationOptions },
      { name: 'duration', label: 'Duration (ms)', type: 'number', defaultValue: 600 },
      { name: 'wait', label: 'Wait for the end of the animation', type: 'boolean', defaultValue: false },
    ],
    isAsync: true,
  },
  // Content
  {
    type: 'setText',
    label: 'Change the text',
    group: 'Content',
    description: 'Change the text of an element. Use {{state.variable}} to insert a variable.',
    sentence: 'Set the text of {target} to {text}',
    params: [target(), { name: 'text', label: 'Text', type: 'longText', defaultValue: 'New text' }],
  },
  {
    type: 'setAttribute',
    label: 'Change an attribute',
    group: 'Content',
    description: 'Change an HTML attribute (src, href, placeholder...).',
    sentence: 'Set the attribute {name} of {target} to {value}',
    params: [
      target(),
      { name: 'name', label: 'Attribute', type: 'text', defaultValue: 'src' },
      { name: 'value', label: 'Value', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'setInputValue',
    label: 'Change the value of an input',
    group: 'Forms',
    description: 'Change the value of an input, text area or dropdown list.',
    sentence: 'Set the value of {target} to {value}',
    params: [target('Input'), { name: 'value', label: 'Value', type: 'text', defaultValue: '' }],
  },
  {
    type: 'resetForm',
    label: 'Reset a form',
    group: 'Forms',
    description: 'Empty all the fields of a form.',
    sentence: 'Reset the form {target}',
    params: [target('Form')],
  },
  {
    type: 'reportValidity',
    label: 'Show form errors',
    group: 'Forms',
    description: 'Highlight the invalid fields of a form, with their error message.',
    sentence: 'Show the errors of the form {target}',
    params: [target('Form')],
  },
  {
    type: 'sendForm',
    label: 'Send a form to an URL',
    group: 'Forms',
    description:
      'Send the fields of a form, as JSON, to an URL (an API, a form service...). The response is stored in a variable.',
    sentence: 'Send the form {target} to {url}',
    params: [
      target('Form'),
      { name: 'url', label: 'URL', type: 'url', defaultValue: 'https://' },
      {
        name: 'method',
        label: 'Method',
        type: 'select',
        defaultValue: 'POST',
        options: [{ value: 'POST', label: 'POST' }, { value: 'PUT', label: 'PUT' }],
      },
      { name: 'resultVariable', label: 'Store the result status in variable', type: 'variable', defaultValue: '', optional: true },
    ],
    isAsync: true,
  },
  // Navigation
  {
    type: 'goToPage',
    label: 'Go to a page',
    group: 'Navigation',
    description: 'Navigate to another page of the website.',
    sentence: 'Go to the page {page}',
    params: [{ name: 'page', label: 'Page', type: 'page', defaultValue: '' }],
  },
  {
    type: 'openUrl',
    label: 'Open an URL',
    group: 'Navigation',
    description: 'Open a link to another website.',
    sentence: 'Open {url}',
    params: [
      { name: 'url', label: 'URL', type: 'url', defaultValue: 'https://' },
      { name: 'newTab', label: 'In a new tab', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'scrollTo',
    label: 'Scroll to an element',
    group: 'Navigation',
    description: 'Scroll the page so that the element is visible.',
    sentence: 'Scroll to {target}',
    params: [
      target(),
      { name: 'offset', label: 'Offset from the top (px)', type: 'number', defaultValue: 0 },
      { name: 'smooth', label: 'Smooth scrolling', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'scrollToTop',
    label: 'Scroll to the top',
    group: 'Navigation',
    description: 'Scroll back to the top of the page.',
    sentence: 'Scroll to the top of the page',
    params: [{ name: 'smooth', label: 'Smooth scrolling', type: 'boolean', defaultValue: true }],
  },
  // Widgets (behaviors)
  {
    type: 'openModal',
    label: 'Open a popup',
    group: 'Widgets',
    description: 'Open an element having the "Popup (modal)" behavior.',
    sentence: 'Open the popup {target}',
    params: [target('Popup')],
  },
  {
    type: 'closeModal',
    label: 'Close a popup',
    group: 'Widgets',
    description: 'Close a popup. If no popup is given, closes the popup containing the element.',
    sentence: 'Close the popup {target}',
    params: [target('Popup')],
  },
  {
    type: 'activateTab',
    label: 'Change the active tab',
    group: 'Widgets',
    description: 'Change the tab displayed by an element having the "Tabs" behavior.',
    sentence: 'Show the tab number {index} of {target}',
    params: [target('Tabs'), { name: 'index', label: 'Tab number (starting at 1)', type: 'number', defaultValue: 1 }],
  },
  {
    type: 'carouselNext',
    label: 'Next slide',
    group: 'Widgets',
    description: 'Show the next slide of a carousel.',
    sentence: 'Show the next slide of {target}',
    params: [target('Carousel')],
  },
  {
    type: 'carouselPrevious',
    label: 'Previous slide',
    group: 'Widgets',
    description: 'Show the previous slide of a carousel.',
    sentence: 'Show the previous slide of {target}',
    params: [target('Carousel')],
  },
  {
    type: 'carouselGoTo',
    label: 'Go to a slide',
    group: 'Widgets',
    description: 'Show a specific slide of a carousel.',
    sentence: 'Show the slide number {index} of {target}',
    params: [target('Carousel'), { name: 'index', label: 'Slide number (starting at 1)', type: 'number', defaultValue: 1 }],
  },
  {
    type: 'toggleDropdown',
    label: 'Open/close a dropdown menu',
    group: 'Widgets',
    description: 'Toggle an element having the "Dropdown menu" behavior.',
    sentence: 'Open or close the dropdown {target}',
    params: [target('Dropdown')],
  },
  // State
  {
    type: 'setVariable',
    label: 'Change a variable',
    group: 'State',
    description:
      'Change the value of a variable of the website state. Texts showing {{state.variable}} are updated.',
    sentence: 'Set the variable {variable} to {value}',
    params: [
      { name: 'variable', label: 'Variable', type: 'variable', defaultValue: '' },
      { name: 'value', label: 'Value (text, number, or {{state.other}})', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'addToVariable',
    label: 'Add to a variable',
    group: 'State',
    description: 'Add a number to a variable (use a negative number to subtract).',
    sentence: 'Add {amount} to the variable {variable}',
    params: [
      { name: 'variable', label: 'Variable', type: 'variable', defaultValue: '' },
      { name: 'amount', label: 'Amount', type: 'number', defaultValue: 1 },
    ],
  },
  {
    type: 'toggleVariable',
    label: 'Toggle a variable',
    group: 'State',
    description: 'Switch a boolean variable between true and false.',
    sentence: 'Toggle the variable {variable}',
    params: [{ name: 'variable', label: 'Variable', type: 'variable', defaultValue: '' }],
  },
  {
    type: 'setVariableFromInput',
    label: 'Store an input value in a variable',
    group: 'State',
    description: 'Copy the value of an input field into a variable.',
    sentence: 'Store the value of {target} in the variable {variable}',
    params: [target('Input'), { name: 'variable', label: 'Variable', type: 'variable', defaultValue: '' }],
  },
  // Timing & code
  {
    type: 'wait',
    label: 'Wait',
    group: 'Timing',
    description: 'Wait before running the next actions.',
    sentence: 'Wait {duration} seconds',
    params: [{ name: 'duration', label: 'Duration (seconds)', type: 'number', defaultValue: 1 }],
    isAsync: true,
  },
  {
    type: 'copyToClipboard',
    label: 'Copy text to the clipboard',
    group: 'Content',
    description: 'Copy a text to the clipboard of the visitor.',
    sentence: 'Copy {text} to the clipboard',
    params: [{ name: 'text', label: 'Text', type: 'text', defaultValue: '' }],
  },
  {
    type: 'log',
    label: 'Log a message',
    group: 'Code',
    description: 'Write a message in the browser console (useful for debugging).',
    sentence: 'Log {message}',
    params: [{ name: 'message', label: 'Message', type: 'text', defaultValue: 'Hello!' }],
  },
  {
    type: 'javascript',
    label: 'Run JavaScript',
    group: 'Code',
    description:
      'Run JavaScript code. Available: elements (the elements chosen below, like elements.title.text("Hi")), element (the DOM element that triggered it), event, state, Webvelop. Can be async (use await).',
    sentence: 'Run JavaScript {elements}: {code}',
    params: [
      {
        name: 'elements',
        label: 'Elements passed to the code',
        type: 'elements',
        defaultValue: [],
        description: 'Pick elements on the page: they are available in the code as elements.<name>.',
      },
      {
        name: 'code',
        label: 'Code',
        type: 'code',
        defaultValue: "// elements.self is the element that triggered the interaction.\nelements.self.animate('pulse');",
      },
    ],
    isAsync: true,
  },
];

const byType = (list: Array<any>) => {
  const map = {};
  list.forEach(item => {
    map[item.type] = item;
  });
  return map;
};

let triggersByType = byType(TRIGGERS);
let conditionsByType = byType(CONDITIONS);
let actionsByType = byType(ACTIONS);

export const registerTrigger = (definition: TriggerDefinition) => {
  if (triggersByType[definition.type]) return;
  TRIGGERS.push(definition);
  triggersByType = byType(TRIGGERS);
};
export const registerCondition = (definition: InstructionDefinition) => {
  if (conditionsByType[definition.type]) return;
  CONDITIONS.push(definition);
  conditionsByType = byType(CONDITIONS);
};
export const registerAction = (definition: InstructionDefinition) => {
  if (actionsByType[definition.type]) return;
  ACTIONS.push(definition);
  actionsByType = byType(ACTIONS);
};

export const getTrigger = (type: string): ?TriggerDefinition =>
  triggersByType[type] || null;
export const getCondition = (type: string): ?InstructionDefinition =>
  conditionsByType[type] || null;

/** Custom actions of the project are prefixed with "custom:". */
export const CUSTOM_ACTION_PREFIX = 'custom:';

export const getCustomActionDefinitions = (project: any): Array<InstructionDefinition> =>
  ((project && project.customActions) || []).map(customAction => ({
    type: CUSTOM_ACTION_PREFIX + customAction.name,
    label: customAction.label || customAction.name,
    group: 'Custom actions',
    description: customAction.description || 'An action written in JavaScript.',
    sentence:
      (customAction.label || customAction.name) +
      (customAction.params.length
        ? ' (' + customAction.params.map(param => `{${param.name}}`).join(', ') + ')'
        : ''),
    params: customAction.params.map(param => ({
      name: param.name,
      label: param.label || param.name,
      // $FlowFixMe[incompatible-type]
      type: param.type || 'text',
      defaultValue: param.type === 'element' ? '$self' : '',
    })),
    isAsync: true,
    isCustom: true,
  }));

export const getAction = (type: string, project?: any): ?InstructionDefinition => {
  if (actionsByType[type]) return actionsByType[type];
  if (type.startsWith(CUSTOM_ACTION_PREFIX) && project) {
    return (
      getCustomActionDefinitions(project).find(definition => definition.type === type) ||
      null
    );
  }
  return null;
};

export const getAllActions = (project?: any): Array<InstructionDefinition> => [
  ...ACTIONS,
  ...(project ? getCustomActionDefinitions(project) : []),
];

export const getDefaultParams = (params: Array<ParamDefinition>): { [string]: any } => {
  const values = {};
  params.forEach(param => {
    values[param.name] = param.defaultValue !== undefined ? param.defaultValue : '';
  });
  return values;
};

export const groupDefinitions = (
  definitions: Array<any>
): Array<{| group: string, items: Array<any> |}> => {
  const groups = [];
  const indexByGroup = {};
  definitions.forEach(definition => {
    if (indexByGroup[definition.group] === undefined) {
      indexByGroup[definition.group] = groups.length;
      groups.push({ group: definition.group, items: [] });
    }
    groups[indexByGroup[definition.group]].items.push(definition);
  });
  return groups;
};
