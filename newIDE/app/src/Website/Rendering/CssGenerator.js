// @flow
// Generation of the CSS of a website: theme variables, shared classes,
// and the responsive styles of every element.
import {
  BREAKPOINTS,
  STYLE_STATES,
  type WebsiteProject,
  type WebsiteElement,
  type StyleMap,
  type ElementStyles,
} from '../Model/Schema';
import { walkElements } from '../Model/Tree';
import { ASSET_REFERENCE_PREFIX } from '../Model/ProjectOps';

export type CssChunks = {|
  base: Array<string>,
  tablet: Array<string>,
  mobile: Array<string>,
|};

export const emptyChunks = (): CssChunks => ({ base: [], tablet: [], mobile: [] });

export const toKebabCase = (property: string): string =>
  property.startsWith('--')
    ? property
    : property.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());

export const toCamelCase = (property: string): string =>
  property.startsWith('--')
    ? property
    : property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());

/** Replace references to assets ("asset:<id>") in CSS values by their URL. */
export const resolveAssetReferencesInCss = (
  value: string,
  resolveAssetUrl: (assetId: string) => string
): string =>
  value.replace(
    new RegExp(ASSET_REFERENCE_PREFIX + '([a-z0-9]+)', 'g'),
    (match, assetId) => resolveAssetUrl(assetId)
  );

const sanitizeValue = (value: string): string =>
  // Prevent breaking out of the declaration block.
  String(value).replace(/[{}]/g, '').replace(/;\s*$/, '');

export const styleMapToDeclarations = (
  styleMap: ?StyleMap,
  resolveAssetUrl: (assetId: string) => string
): string => {
  if (!styleMap) return '';
  return Object.keys(styleMap)
    .filter(property => {
      const value = styleMap[property];
      return value !== undefined && value !== null && String(value).trim() !== '';
    })
    .map(property => {
      let value = sanitizeValue(String(styleMap[property]).trim());
      if (value.includes(ASSET_REFERENCE_PREFIX))
        value = resolveAssetReferencesInCss(value, resolveAssetUrl);
      return `${toKebabCase(property)}:${value}`;
    })
    .join(';');
};

const defaultDisplayForType = (element: WebsiteElement): string => {
  switch (element.type) {
    case 'button':
      return 'inline-flex';
    case 'link':
      return 'inline';
    case 'text':
      return element.props.tag === 'span' || element.props.tag === 'strong' || element.props.tag === 'em'
        ? 'inline'
        : 'block';
    default:
      return 'block';
  }
};

/** The `display` value an element should get when shown by an interaction. */
export const getShowDisplay = (styles: ElementStyles, element: WebsiteElement): string => {
  const candidates = [
    styles.desktop && styles.desktop.display,
    styles.tablet && styles.tablet.display,
    styles.mobile && styles.mobile.display,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate !== 'none') return candidate;
  }
  return defaultDisplayForType(element);
};

/** Add the rules for one set of styles (element, class or instance). */
export const addStylesRules = (
  chunks: CssChunks,
  selector: string,
  styles: ElementStyles,
  resolveAssetUrl: (assetId: string) => string,
  showDisplay: ?string
) => {
  if (!styles) return;
  let desktop = styleMapToDeclarations(styles.desktop, resolveAssetUrl);
  if (showDisplay && showDisplay !== 'block') {
    desktop = (desktop ? desktop + ';' : '') + `--wv-show-display:${showDisplay}`;
  }
  if (desktop) chunks.base.push(`${selector}{${desktop}}`);
  STYLE_STATES.forEach(styleState => {
    const declarations = styleMapToDeclarations(styles[styleState.id], resolveAssetUrl);
    if (declarations) chunks.base.push(`${selector}${styleState.selector}{${declarations}}`);
  });
  const tablet = styleMapToDeclarations(styles.tablet, resolveAssetUrl);
  if (tablet) chunks.tablet.push(`${selector}{${tablet}}`);
  const mobile = styleMapToDeclarations(styles.mobile, resolveAssetUrl);
  if (mobile) chunks.mobile.push(`${selector}{${mobile}}`);
};

/** Add the rules of all the elements of a tree. */
export const addElementTreeRules = (
  chunks: CssChunks,
  root: WebsiteElement,
  resolveAssetUrl: (assetId: string) => string
) => {
  walkElements(root, element => {
    addStylesRules(
      chunks,
      '.wv-' + element.id,
      element.styles || {},
      resolveAssetUrl,
      getShowDisplay(element.styles || {}, element)
    );
  });
};

export const chunksToCss = (chunks: CssChunks): string => {
  const tablet = BREAKPOINTS.find(breakpoint => breakpoint.id === 'tablet');
  const mobile = BREAKPOINTS.find(breakpoint => breakpoint.id === 'mobile');
  let css = chunks.base.join('\n');
  if (chunks.tablet.length && tablet)
    css += `\n@media (max-width:${tablet.maxWidth || 991}px){\n${chunks.tablet.join('\n')}\n}`;
  if (chunks.mobile.length && mobile)
    css += `\n@media (max-width:${mobile.maxWidth || 767}px){\n${chunks.mobile.join('\n')}\n}`;
  return css;
};

const fontFamilyValue = (font: { family: string, googleFont: boolean }): string => {
  const family = (font.family || '').trim();
  if (!family) return 'inherit';
  if (font.googleFont) return `'${family.replace(/'/g, '')}', system-ui, sans-serif`;
  return family;
};

export const getGoogleFontsUrl = (project: WebsiteProject): ?string => {
  const families = project.theme.fonts
    .filter(font => font.googleFont && font.family.trim())
    .map(font => font.family.trim());
  const unique = Array.from(new Set(families));
  if (!unique.length) return null;
  return (
    'https://fonts.googleapis.com/css2?' +
    unique
      .map(family => 'family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':wght@300;400;500;600;700;800')
      .join('&') +
    '&display=swap'
  );
};

export const generateThemeCss = (
  project: WebsiteProject,
  resolveAssetUrl: (assetId: string) => string
): string => {
  const variables = [];
  project.theme.colors.forEach(color => {
    if (color.name) variables.push(`--color-${color.name}:${sanitizeValue(color.value)}`);
  });
  project.theme.fonts.forEach(font => {
    if (font.name) variables.push(`--font-${font.name}:${fontFamilyValue(font)}`);
  });
  if (project.theme.baseFontSize) variables.push(`--font-size-base:${sanitizeValue(project.theme.baseFontSize)}`);

  const fontFaces = project.assets
    .filter(asset => asset.kind === 'font')
    .map(asset => {
      const family = asset.name.replace(/\.[^.]+$/, '');
      return `@font-face{font-family:'${family.replace(/'/g, '')}';src:url("${resolveAssetUrl(asset.id)}");font-display:swap}`;
    });
  return [...fontFaces, `:root{${variables.join(';')}}`].join('\n');
};

export const generateStyleClassesCss = (
  project: WebsiteProject,
  resolveAssetUrl: (assetId: string) => string
): string => {
  const chunks = emptyChunks();
  project.styleClasses.forEach(styleClass => {
    addStylesRules(chunks, '.wvc-' + styleClass.name, styleClass.styles, resolveAssetUrl, null);
  });
  return chunksToCss(chunks);
};
