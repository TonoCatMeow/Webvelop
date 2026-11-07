// @flow
// Description of the CSS properties editable in the Style panel.
import { type StyleMap, type ElementStyles, type StyleKey } from '../Model/Schema';

export type StyleControl = 'text' | 'size' | 'select' | 'segmented' | 'color' | 'number' | 'image' | 'font';

export type StyleField = {|
  prop: string,
  label: string,
  control: StyleControl,
  options?: Array<[string, string]>,
  suggestions?: Array<string>,
  /** Only show the field if this returns true (given the effective styles). */
  when?: (styles: StyleMap, elementType: string) => boolean,
  unitless?: boolean,
|};

export type StyleSection = {|
  id: string,
  label: string,
  fields: Array<StyleField>,
  special?: 'spacing' | 'custom',
  defaultOpen?: boolean,
|};

const isFlex = (s: StyleMap) => /flex/.test(s.display || '');
const isGrid = (s: StyleMap) => /grid/.test(s.display || '');
const isFlexOrGrid = (s: StyleMap) => isFlex(s) || isGrid(s);
const isPositioned = (s: StyleMap) => !!s.position && s.position !== 'static';
const isMedia = (s: StyleMap, type: string) => type === 'image' || type === 'video';

const alignOptions: Array<[string, string]> = [
  ['flex-start', 'Start'],
  ['center', 'Center'],
  ['flex-end', 'End'],
  ['stretch', 'Stretch'],
  ['baseline', 'Baseline'],
];

export const STYLE_SECTIONS: Array<StyleSection> = [
  {
    id: 'layout',
    label: 'Layout',
    defaultOpen: true,
    fields: [
      {
        prop: 'display',
        label: 'Display',
        control: 'segmented',
        options: [['block', 'Block'], ['flex', 'Flex'], ['grid', 'Grid'], ['inline-block', 'Inline'], ['none', 'None']],
      },
      {
        prop: 'flexDirection',
        label: 'Direction',
        control: 'segmented',
        options: [['row', 'Row →'], ['column', 'Column ↓'], ['row-reverse', '←'], ['column-reverse', '↑']],
        when: isFlex,
      },
      {
        prop: 'justifyContent',
        label: 'Justify',
        control: 'select',
        options: [
          ['flex-start', 'Start'],
          ['center', 'Center'],
          ['flex-end', 'End'],
          ['space-between', 'Space between'],
          ['space-around', 'Space around'],
          ['space-evenly', 'Space evenly'],
        ],
        when: isFlexOrGrid,
      },
      { prop: 'alignItems', label: 'Align items', control: 'select', options: alignOptions, when: isFlexOrGrid },
      {
        prop: 'flexWrap',
        label: 'Wrap',
        control: 'segmented',
        options: [['nowrap', 'No wrap'], ['wrap', 'Wrap']],
        when: isFlex,
      },
      { prop: 'gap', label: 'Gap', control: 'size', suggestions: ['0', '8px', '16px', '24px', '32px', '48px'], when: isFlexOrGrid },
      {
        prop: 'gridTemplateColumns',
        label: 'Columns',
        control: 'text',
        suggestions: [
          'minmax(0, 1fr)',
          'repeat(2, minmax(0, 1fr))',
          'repeat(3, minmax(0, 1fr))',
          'repeat(4, minmax(0, 1fr))',
          '1fr 2fr',
          '2fr 1fr',
          'repeat(auto-fill, minmax(240px, 1fr))',
        ],
        when: isGrid,
      },
      { prop: 'gridTemplateRows', label: 'Rows', control: 'text', suggestions: ['auto', 'repeat(2, auto)'], when: isGrid },
    ],
  },
  {
    id: 'item',
    label: 'Inside its parent',
    fields: [
      { prop: 'alignSelf', label: 'Align self', control: 'select', options: [['auto', 'Auto'], ...alignOptions] },
      { prop: 'flex', label: 'Flex', control: 'text', suggestions: ['1', '0 0 auto', '1 1 0', '2'] },
      { prop: 'flexShrink', label: 'Shrink', control: 'number', unitless: true },
      { prop: 'order', label: 'Order', control: 'number', unitless: true },
      { prop: 'gridColumn', label: 'Grid column', control: 'text', suggestions: ['span 2', 'span 3', '1 / -1'] },
    ],
  },
  { id: 'spacing', label: 'Spacing', special: 'spacing', fields: [], defaultOpen: true },
  {
    id: 'size',
    label: 'Size',
    defaultOpen: true,
    fields: [
      { prop: 'width', label: 'Width', control: 'size', suggestions: ['auto', '100%', '50%', 'fit-content', '320px'] },
      { prop: 'height', label: 'Height', control: 'size', suggestions: ['auto', '100%', '100vh', '400px'] },
      { prop: 'minWidth', label: 'Min width', control: 'size', suggestions: ['0', '200px'] },
      { prop: 'maxWidth', label: 'Max width', control: 'size', suggestions: ['none', '100%', '640px', '960px', '1200px'] },
      { prop: 'minHeight', label: 'Min height', control: 'size', suggestions: ['0', '100vh', '400px'] },
      { prop: 'maxHeight', label: 'Max height', control: 'size', suggestions: ['none', '100vh'] },
      { prop: 'aspectRatio', label: 'Aspect ratio', control: 'text', suggestions: ['auto', '1 / 1', '4 / 3', '16 / 9', '3 / 4'] },
      {
        prop: 'overflow',
        label: 'Overflow',
        control: 'select',
        options: [['visible', 'Visible'], ['hidden', 'Hidden'], ['auto', 'Scroll if needed'], ['scroll', 'Scroll']],
      },
      {
        prop: 'objectFit',
        label: 'Fit',
        control: 'segmented',
        options: [['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Fill'], ['none', 'None']],
        when: isMedia,
      },
    ],
  },
  {
    id: 'position',
    label: 'Position',
    fields: [
      {
        prop: 'position',
        label: 'Position',
        control: 'select',
        options: [
          ['static', 'Normal (in the flow)'],
          ['relative', 'Relative'],
          ['absolute', 'Absolute (free)'],
          ['fixed', 'Fixed to the screen'],
          ['sticky', 'Sticky'],
        ],
      },
      { prop: 'top', label: 'Top', control: 'size', when: isPositioned },
      { prop: 'right', label: 'Right', control: 'size', when: isPositioned },
      { prop: 'bottom', label: 'Bottom', control: 'size', when: isPositioned },
      { prop: 'left', label: 'Left', control: 'size', when: isPositioned },
      { prop: 'zIndex', label: 'Z-index', control: 'number', unitless: true },
    ],
  },
  {
    id: 'typography',
    label: 'Typography',
    fields: [
      { prop: 'fontFamily', label: 'Font', control: 'font' },
      { prop: 'fontSize', label: 'Size', control: 'size', suggestions: ['12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px', '64px'] },
      {
        prop: 'fontWeight',
        label: 'Weight',
        control: 'select',
        options: [
          ['300', 'Light'],
          ['400', 'Normal'],
          ['500', 'Medium'],
          ['600', 'Semi bold'],
          ['700', 'Bold'],
          ['800', 'Extra bold'],
        ],
      },
      { prop: 'lineHeight', label: 'Line height', control: 'text', unitless: true, suggestions: ['1', '1.2', '1.5', '1.8', '2'] },
      { prop: 'letterSpacing', label: 'Letter spacing', control: 'size', suggestions: ['0', '0.02em', '0.05em', '-0.02em'] },
      { prop: 'color', label: 'Color', control: 'color' },
      {
        prop: 'textAlign',
        label: 'Align',
        control: 'segmented',
        options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justify', 'Justify']],
      },
      {
        prop: 'textTransform',
        label: 'Case',
        control: 'segmented',
        options: [['none', 'Aa'], ['uppercase', 'AA'], ['lowercase', 'aa'], ['capitalize', 'Aa Bb']],
      },
      {
        prop: 'textDecoration',
        label: 'Decoration',
        control: 'segmented',
        options: [['none', 'None'], ['underline', 'Underline'], ['line-through', 'Strike']],
      },
      { prop: 'fontStyle', label: 'Style', control: 'segmented', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      {
        prop: 'whiteSpace',
        label: 'Wrapping',
        control: 'select',
        options: [['normal', 'Wrap'], ['nowrap', 'No wrap'], ['pre-wrap', 'Keep line breaks']],
      },
    ],
  },
  {
    id: 'background',
    label: 'Background',
    fields: [
      { prop: 'backgroundColor', label: 'Color', control: 'color' },
      {
        prop: 'background',
        label: 'Gradient',
        control: 'text',
        suggestions: [
          'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
          'radial-gradient(circle at top, #6366f1, #0f172a)',
          'linear-gradient(90deg, #f97316, #ec4899)',
        ],
      },
      { prop: 'backgroundImage', label: 'Image', control: 'image' },
      {
        prop: 'backgroundSize',
        label: 'Size',
        control: 'segmented',
        options: [['cover', 'Cover'], ['contain', 'Contain'], ['auto', 'Auto']],
      },
      {
        prop: 'backgroundPosition',
        label: 'Position',
        control: 'select',
        options: [['center', 'Center'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']],
      },
      {
        prop: 'backgroundRepeat',
        label: 'Repeat',
        control: 'segmented',
        options: [['no-repeat', 'No'], ['repeat', 'Repeat'], ['repeat-x', 'X'], ['repeat-y', 'Y']],
      },
    ],
  },
  {
    id: 'border',
    label: 'Border',
    fields: [
      { prop: 'border', label: 'Border', control: 'text', suggestions: ['none', '1px solid #e2e8f0', '2px solid var(--color-primary)', '1px dashed #94a3b8'] },
      { prop: 'borderRadius', label: 'Radius', control: 'size', suggestions: ['0', '4px', '8px', '12px', '16px', '999px', '50%'] },
      { prop: 'borderWidth', label: 'Width', control: 'size' },
      {
        prop: 'borderStyle',
        label: 'Style',
        control: 'select',
        options: [['none', 'None'], ['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double']],
      },
      { prop: 'borderColor', label: 'Color', control: 'color' },
      { prop: 'borderTop', label: 'Top border', control: 'text' },
      { prop: 'borderBottom', label: 'Bottom border', control: 'text' },
      { prop: 'outline', label: 'Outline', control: 'text', suggestions: ['none', '2px solid var(--color-primary)'] },
    ],
  },
  {
    id: 'effects',
    label: 'Effects',
    fields: [
      { prop: 'opacity', label: 'Opacity', control: 'text', unitless: true, suggestions: ['1', '0.8', '0.5', '0.2', '0'] },
      {
        prop: 'boxShadow',
        label: 'Shadow',
        control: 'text',
        suggestions: [
          'none',
          '0 1px 3px rgba(15,23,42,0.12)',
          '0 4px 20px rgba(15,23,42,0.08)',
          '0 12px 32px rgba(15,23,42,0.16)',
          '0 24px 64px rgba(0,0,0,0.3)',
        ],
      },
      {
        prop: 'transform',
        label: 'Transform',
        control: 'text',
        suggestions: ['none', 'translateY(-4px)', 'scale(1.05)', 'rotate(-3deg)'],
      },
      {
        prop: 'transition',
        label: 'Transition',
        control: 'text',
        suggestions: ['all 0.2s ease', 'transform 0.2s ease, box-shadow 0.2s ease', 'opacity 0.3s ease', 'none'],
      },
      {
        prop: 'filter',
        label: 'Filter',
        control: 'text',
        suggestions: ['none', 'brightness(1.1)', 'grayscale(1)', 'blur(4px)', 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'],
      },
      {
        prop: 'backdropFilter',
        label: 'Backdrop',
        control: 'text',
        suggestions: ['none', 'blur(8px)', 'blur(16px) saturate(1.5)'],
      },
      {
        prop: 'cursor',
        label: 'Cursor',
        control: 'select',
        options: [['auto', 'Auto'], ['pointer', 'Pointer (hand)'], ['default', 'Arrow'], ['text', 'Text'], ['zoom-in', 'Zoom'], ['not-allowed', 'Not allowed']],
      },
    ],
  },
  { id: 'custom', label: 'All CSS properties', special: 'custom', fields: [] },
];

// Style resolution across breakpoints and states.

const BREAKPOINT_CASCADE: { [StyleKey]: Array<StyleKey> } = {
  desktop: ['desktop'],
  tablet: ['tablet', 'desktop'],
  mobile: ['mobile', 'tablet', 'desktop'],
  hover: ['hover', 'desktop'],
  focus: ['focus', 'desktop'],
  pressed: ['pressed', 'desktop'],
  current: ['current', 'desktop'],
};

/** The value of a property at a style key, and where it comes from. */
export const resolveStyleValue = (
  styles: ElementStyles,
  key: StyleKey,
  prop: string
): {| value: string, source: ?StyleKey |} => {
  for (const candidate of BREAKPOINT_CASCADE[key] || [key]) {
    const map = styles[candidate];
    if (map && map[prop] !== undefined && map[prop] !== '') return { value: map[prop], source: candidate };
  }
  return { value: '', source: null };
};

export const getEffectiveStyles = (styles: ElementStyles, key: StyleKey): StyleMap => {
  const result = {};
  [...(BREAKPOINT_CASCADE[key] || [key])].reverse().forEach(candidate => {
    Object.assign(result, styles[candidate] || {});
  });
  return result;
};

export const setStyleValue = (
  styles: ElementStyles,
  key: StyleKey,
  prop: string,
  value: ?string
): ElementStyles => {
  const map = { ...(styles[key] || {}) };
  if (value === null || value === undefined || String(value).trim() === '') delete map[prop];
  else map[prop] = String(value).trim();
  const newStyles = { ...styles, [key]: map };
  if (!Object.keys(map).length) delete newStyles[key];
  return newStyles;
};

/** Split a CSS shorthand (respecting parentheses), like "8px calc(1px + 2%)". */
export const splitCssValues = (value: string): Array<string> => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of String(value || '').trim()) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
};

export const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

/** Expand margin/padding (shorthand or longhands) into 4 sides for a style map. */
export const getBoxSides = (map: ?StyleMap, property: 'margin' | 'padding'): Array<?string> => {
  const result = [null, null, null, null];
  if (!map) return result;
  if (map[property]) {
    const values = splitCssValues(map[property]);
    const [top, right = top, bottom = top, left = right] = values;
    result[0] = top;
    result[1] = right;
    result[2] = bottom;
    result[3] = left;
  }
  SIDES.forEach((side, index) => {
    const longhand = map[property + side];
    if (longhand !== undefined && longhand !== '') result[index] = longhand;
  });
  return result;
};

/** Change one side of a margin/padding, expanding the shorthand if needed. */
export const setBoxSide = (
  styles: ElementStyles,
  key: StyleKey,
  property: 'margin' | 'padding',
  sideIndex: number,
  value: string
): ElementStyles => {
  const map = { ...(styles[key] || {}) };
  const sides = getBoxSides(map, property);
  delete map[property];
  SIDES.forEach((side, index) => {
    const sideValue = index === sideIndex ? value : sides[index];
    if (sideValue !== null && sideValue !== undefined && String(sideValue).trim() !== '')
      map[property + side] = String(sideValue).trim();
    else delete map[property + side];
  });
  const newStyles = { ...styles, [key]: map };
  if (!Object.keys(map).length) delete newStyles[key];
  return newStyles;
};

/** Add "px" to plain numbers. */
export const normalizeSizeValue = (value: string, unitless?: boolean): string => {
  const trimmed = String(value || '').trim();
  if (!unitless && /^-?\d+(\.\d+)?$/.test(trimmed) && trimmed !== '0') return trimmed + 'px';
  return trimmed;
};

export const ALL_CSS_PROPERTIES: Array<string> = [
  'alignContent', 'alignItems', 'alignSelf', 'animation', 'aspectRatio', 'backdropFilter', 'background',
  'backgroundAttachment', 'backgroundBlendMode', 'backgroundClip', 'backgroundColor', 'backgroundImage',
  'backgroundPosition', 'backgroundRepeat', 'backgroundSize', 'border', 'borderBottom', 'borderColor',
  'borderLeft', 'borderRadius', 'borderRight', 'borderStyle', 'borderTop', 'borderWidth', 'bottom',
  'boxShadow', 'clipPath', 'color', 'columnGap', 'cursor', 'display', 'filter', 'flex', 'flexBasis',
  'flexDirection', 'flexGrow', 'flexShrink', 'flexWrap', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight',
  'gap', 'gridArea', 'gridColumn', 'gridRow', 'gridTemplateAreas', 'gridTemplateColumns', 'gridTemplateRows',
  'height', 'inset', 'justifyContent', 'justifyItems', 'justifySelf', 'left', 'letterSpacing', 'lineHeight',
  'listStyle', 'margin', 'marginBottom', 'marginLeft', 'marginRight', 'marginTop', 'maxHeight', 'maxWidth',
  'minHeight', 'minWidth', 'mixBlendMode', 'objectFit', 'objectPosition', 'opacity', 'order', 'outline',
  'outlineOffset', 'overflow', 'overflowX', 'overflowY', 'padding', 'paddingBottom', 'paddingLeft',
  'paddingRight', 'paddingTop', 'pointerEvents', 'position', 'right', 'rowGap', 'scrollBehavior',
  'textAlign', 'textDecoration', 'textOverflow', 'textShadow', 'textTransform', 'top', 'transform',
  'transformOrigin', 'transition', 'userSelect', 'verticalAlign', 'visibility', 'whiteSpace', 'width',
  'wordBreak', 'zIndex',
];
