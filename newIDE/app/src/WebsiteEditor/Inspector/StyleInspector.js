// @flow
// The "Style" panel: edits the CSS of an element (or of a shared class), for
// the current breakpoint (desktop, tablet, mobile) or state (hover, focus...).
import * as React from 'react';
import {
  STYLE_SECTIONS,
  resolveStyleValue,
  getEffectiveStyles,
  setStyleValue,
  getBoxSides,
  setBoxSide,
  normalizeSizeValue,
  ALL_CSS_PROPERTIES,
  type StyleField,
} from '../../Website/Styles/StyleProperties';
import { type ElementStyles, type StyleKey, BREAKPOINTS, STYLE_STATES } from '../../Website/Model/Schema';
import { toCamelCase, toKebabCase } from '../../Website/Rendering/CssGenerator';
import { TextInput, SelectInput, ColorInput, AssetPicker, PanelSection } from '../Fields/Fields';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { CodeEditor } from '../../CodeEditor';

const keyLabel = (key: ?StyleKey): string => {
  if (!key) return '';
  const breakpoint = BREAKPOINTS.find(b => b.id === key);
  if (breakpoint) return breakpoint.label;
  const state = STYLE_STATES.find(s => s.id === key);
  return state ? state.label : key;
};

type Props = {|
  styles: ElementStyles,
  onChange: (styles: ElementStyles, mergeKey?: string) => void,
  styleKey: StyleKey,
  elementType: string,
|};

const ResetButton = ({ onClick }: {| onClick: () => void |}) => (
  <button className="wve-icon-button" title="Reset (use the inherited value)" onClick={onClick}>
    ×
  </button>
);

const FieldRow = ({
  field,
  styles,
  styleKey,
  onSet,
  effective,
}: {|
  field: StyleField,
  styles: ElementStyles,
  styleKey: StyleKey,
  onSet: (prop: string, value: ?string) => void,
  effective: { [string]: string },
|}) => {
  const { project } = useWebsiteEditor();
  const { value: resolved, source } = resolveStyleValue(styles, styleKey, field.prop);
  const isSetHere = source === styleKey;
  const ownValue = isSetHere ? resolved : '';
  const placeholder = !isSetHere && resolved ? resolved : '';
  const labelClass = isSetHere ? 'wve-set' : source ? 'wve-inherited' : '';
  const title = isSetHere
    ? `Set for ${keyLabel(styleKey)}`
    : source
    ? `Inherited from ${keyLabel(source)}`
    : 'Not set';
  const listId = field.suggestions ? `wve-suggestions-${field.prop}` : undefined;
  const set = (value: ?string) =>
    onSet(field.prop, value === null || value === undefined ? value : normalizeSizeValue(value, field.unitless || field.control !== 'size'));

  let control = null;
  switch (field.control) {
    case 'segmented': {
      const current = ownValue || placeholder;
      control = (
        <div className="wve-segmented">
          {(field.options || []).map(([value, label]) => (
            <button
              key={value}
              title={value}
              className={current === value ? 'wve-active' : ''}
              style={current === value && !isSetHere ? { opacity: 0.6 } : undefined}
              onClick={() => set(ownValue === value ? null : value)}
            >
              {label}
            </button>
          ))}
        </div>
      );
      break;
    }
    case 'select':
      control = (
        <SelectInput
          value={ownValue}
          onChange={value => set(value || null)}
          placeholder={placeholder ? `${placeholder} (inherited)` : '—'}
          options={(field.options || []).map(([value, label]) => ({ value, label }))}
        />
      );
      break;
    case 'color':
      control = <ColorInput value={ownValue} onChange={value => set(value || null)} placeholder={placeholder} />;
      break;
    case 'image': {
      const match = /url\(["']?(.*?)["']?\)/.exec(ownValue || '');
      control = (
        <div className="wve-grow">
          <AssetPicker
            kind="image"
            value={match ? match[1] : ''}
            onChange={value => set(value ? `url("${value}")` : null)}
          />
        </div>
      );
      break;
    }
    case 'font': {
      const options = project.theme.fonts.map(font => ({
        value: `var(--font-${font.name})`,
        label: `${font.name} font (${font.family.split(',')[0].replace(/'/g, '')})`,
      }));
      control = (
        <div className="wve-grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SelectInput
            value={options.some(o => o.value === ownValue) ? ownValue : ownValue ? '__custom__' : ''}
            onChange={value => {
              if (value === '__custom__') set('Georgia, serif');
              else set(value || null);
            }}
            placeholder={placeholder ? `${placeholder} (inherited)` : 'Default'}
            options={[...options, { value: '__custom__', label: 'Other font...' }]}
          />
          {ownValue && !options.some(o => o.value === ownValue) && (
            <TextInput value={ownValue} onChange={value => set(value || null)} />
          )}
        </div>
      );
      break;
    }
    default:
      control = (
        <div className="wve-grow">
          <TextInput value={ownValue} placeholder={placeholder} onChange={value => set(value || null)} list={listId} />
          {field.suggestions && (
            <datalist id={listId}>
              {field.suggestions.map(suggestion => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          )}
        </div>
      );
  }
  return (
    <div className="wve-row">
      <span className={`wve-label ${labelClass}`} title={title}>
        {field.label}
      </span>
      {control}
      {isSetHere ? <ResetButton onClick={() => onSet(field.prop, null)} /> : <span style={{ width: 26, flexShrink: 0 }} />}
    </div>
  );
};

const BoxInput = ({
  value,
  placeholder,
  onChange,
}: {|
  value: ?string,
  placeholder: ?string,
  onChange: string => void,
|}) => {
  const [text, setText] = React.useState(value || '');
  React.useEffect(() => setText(value || ''), [value]);
  return (
    <input
      className={value ? 'wve-set' : ''}
      value={text}
      placeholder={placeholder || '-'}
      title={value ? 'Set here' : placeholder ? 'Inherited: ' + placeholder : 'Not set'}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        if (text !== (value || '')) onChange(normalizeSizeValue(text));
      }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const match = /^(-?\d+(?:\.\d+)?)(.*)$/.exec(text || placeholder || '0');
          if (match) {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
            const newText = `${parseFloat(match[1]) + step}${match[2] || 'px'}`;
            setText(newText);
            onChange(newText);
          }
        }
      }}
    />
  );
};

const SpacingEditor = ({
  styles,
  styleKey,
  onChange,
}: {|
  styles: ElementStyles,
  styleKey: StyleKey,
  onChange: (styles: ElementStyles, mergeKey?: string) => void,
|}) => {
  const effective = getEffectiveStyles(styles, styleKey);
  const own = styles[styleKey] || {};
  const render = (property: 'margin' | 'padding') => {
    const ownSides = getBoxSides(own, property);
    const effectiveSides = getBoxSides(effective, property);
    return [0, 1, 2, 3].map(index => (
      <BoxInput
        key={property + index}
        value={ownSides[index]}
        placeholder={effectiveSides[index]}
        onChange={value => onChange(setBoxSide(styles, styleKey, property, index, value))}
      />
    ));
  };
  const [mt, mr, mb, ml] = render('margin');
  const [pt, pr, pb, pl] = render('padding');
  return (
    <div className="wve-box-model">
      <span className="wve-box-title">Margin</span>
      <span />
      {mt}
      <span />
      {ml}
      <div className="wve-box-model wve-inner">
        <span className="wve-box-title">Padding</span>
        <span />
        {pt}
        <span />
        {pl}
        <span style={{ alignSelf: 'center', justifySelf: 'center', opacity: 0.5 }}>content</span>
        {pr}
        <span />
        {pb}
        <span />
      </div>
      {mr}
      <span />
      {mb}
      <span />
    </div>
  );
};

/** The styles of an element written as CSS declarations ("color: red;"), applied when leaving the editor. */
const stylesToCss = (map: { [string]: string }): string =>
  Object.keys(map)
    .map(prop => `  ${toKebabCase(prop)}: ${map[prop]};`)
    .join('\n');

const cssToStyles = (text: string): { [string]: string } => {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const body = withoutComments.includes('{')
    ? withoutComments.slice(withoutComments.indexOf('{') + 1, withoutComments.lastIndexOf('}'))
    : withoutComments;
  const map = {};
  body.split(';').forEach(declaration => {
    const index = declaration.indexOf(':');
    if (index === -1) return;
    const property = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (property && value) map[toCamelCase(property)] = value;
  });
  return map;
};

const CssDeclarationsEditor = ({
  styles,
  styleKey,
  onChange,
}: {|
  styles: ElementStyles,
  styleKey: StyleKey,
  onChange: (styles: ElementStyles) => void,
|}) => {
  const own = styles[styleKey] || {};
  const initialText = `.this-element {\n${stylesToCss(own)}\n}\n`;
  const [text, setText] = React.useState(initialText);
  const textRef = React.useRef(text);
  const latest = React.useRef({ styles, styleKey, onChange });
  latest.current = { styles, styleKey, onChange };
  // Reload the CSS when another element, breakpoint or state is edited.
  React.useEffect(
    () => {
      setText(initialText);
      textRef.current = initialText;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styleKey, JSON.stringify(own)]
  );
  const apply = React.useCallback(() => {
    const { styles: currentStyles, styleKey: currentKey, onChange: currentOnChange } = latest.current;
    const map = cssToStyles(textRef.current);
    if (JSON.stringify(map) === JSON.stringify(currentStyles[currentKey] || {})) return;
    const newStyles = { ...currentStyles, [currentKey]: map };
    if (!Object.keys(map).length) delete newStyles[currentKey];
    currentOnChange(newStyles);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ height: 200, border: '1px solid var(--theme-list-item-separator-color)', borderRadius: 4, overflow: 'hidden' }}>
        <CodeEditor
          language="css"
          value={text}
          onChange={value => {
            setText(value);
            textRef.current = value;
          }}
          onBlur={apply}
        />
      </div>
      <div className="wve-muted wve-small">
        Write CSS declarations for {keyLabel(styleKey)}. They are applied when you click outside of the editor.
      </div>
    </div>
  );
};

const CustomPropertiesEditor = ({
  styles,
  styleKey,
  onChange,
}: {|
  styles: ElementStyles,
  styleKey: StyleKey,
  onChange: (styles: ElementStyles) => void,
|}) => {
  const own = styles[styleKey] || {};
  const [newProp, setNewProp] = React.useState('');
  const [editAsCss, setEditAsCss] = React.useState(false);
  return (
    <>
      <div className="wve-row">
        <span className="wve-grow wve-muted wve-small">Properties for {keyLabel(styleKey)}</span>
        <button className="wve-small-button" onClick={() => setEditAsCss(!editAsCss)}>
          {editAsCss ? 'Edit as fields' : '{ } Edit as CSS'}
        </button>
      </div>
      {editAsCss ? (
        <CssDeclarationsEditor
          styles={styles}
          styleKey={styleKey}
          onChange={onChange}
        />
      ) : (
      <>
      {Object.keys(own).length === 0 && <div className="wve-muted wve-small">No property set for {keyLabel(styleKey)}.</div>}
      {Object.keys(own).map(prop => (
        <div className="wve-row" key={prop}>
          <span className="wve-label wve-set" title={toKebabCase(prop)}>
            {toKebabCase(prop)}
          </span>
          <div className="wve-grow">
            <TextInput value={own[prop]} onChange={value => onChange(setStyleValue(styles, styleKey, prop, value || null))} />
          </div>
          <ResetButton onClick={() => onChange(setStyleValue(styles, styleKey, prop, null))} />
        </div>
      ))}
      <div className="wve-row">
        <div className="wve-grow">
          <TextInput
            value={newProp}
            onChange={setNewProp}
            onLiveChange={setNewProp}
            placeholder="Add a property (e.g. letter-spacing)"
            list="wve-all-css-properties"
          />
          <datalist id="wve-all-css-properties">
            {ALL_CSS_PROPERTIES.map(prop => (
              <option key={prop} value={toKebabCase(prop)} />
            ))}
          </datalist>
        </div>
        <button
          className="wve-icon-button"
          disabled={!newProp.trim()}
          onClick={() => {
            const prop = toCamelCase(newProp.trim());
            if (!own[prop]) onChange(setStyleValue(styles, styleKey, prop, 'initial'));
            setNewProp('');
          }}
        >
          +
        </button>
      </div>
      </>
      )}
    </>
  );
};

const StyleInspector = ({ styles, onChange, styleKey, elementType }: Props) => {
  const effective = getEffectiveStyles(styles, styleKey);
  const onSet = (prop: string, value: ?string) =>
    onChange(setStyleValue(styles, styleKey, prop, value), `style-${prop}-${styleKey}`);
  return (
    <>
      {STYLE_SECTIONS.map(section => {
        const fields = section.fields.filter(field => !field.when || field.when(effective, elementType));
        const setCount = section.special === 'spacing'
          ? Object.keys(styles[styleKey] || {}).filter(p => /^(margin|padding)/.test(p)).length
          : section.special === 'custom'
          ? Object.keys(styles[styleKey] || {}).length
          : fields.filter(field => (styles[styleKey] || {})[field.prop] !== undefined).length;
        return (
          <PanelSection
            key={section.id}
            title={section.label}
            defaultOpen={!!section.defaultOpen}
            badge={setCount ? <span className="wve-chip wve-primary">{setCount}</span> : null}
          >
            {section.special === 'spacing' ? (
              <SpacingEditor styles={styles} styleKey={styleKey} onChange={onChange} />
            ) : section.special === 'custom' ? (
              <CustomPropertiesEditor styles={styles} styleKey={styleKey} onChange={onChange} />
            ) : (
              fields.map(field => (
                <FieldRow
                  key={field.prop}
                  field={field}
                  styles={styles}
                  styleKey={styleKey}
                  onSet={onSet}
                  effective={effective}
                />
              ))
            )}
          </PanelSection>
        );
      })}
    </>
  );
};

export default StyleInspector;
