// @flow
// Small form fields used by the inspector and the other website editors.
import * as React from 'react';
import Popover from '@material-ui/core/Popover';
import { SketchPicker } from 'react-color';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import Upload from '../../UI/CustomSvgIcons/Upload';
import { ICON_NAMES, renderIconSvg } from '../../Website/Elements/IconSet';
import {
  ASSET_REFERENCE_PREFIX,
  isAssetReference,
  getAssetIdFromReference,
} from '../../Website/Model/ProjectOps';

/** A text input that commits its value on blur or Enter (like GDevelop's semi-controlled fields). */
export const TextInput = ({
  value,
  onChange,
  placeholder,
  multiline,
  code,
  rows,
  className,
  onLiveChange,
  autoFocus,
  error,
  type,
  list,
}: {|
  value: string,
  onChange: string => void,
  placeholder?: string,
  multiline?: boolean,
  code?: boolean,
  rows?: number,
  className?: string,
  /** Called on every key stroke (for live updates). */
  onLiveChange?: string => void,
  autoFocus?: boolean,
  error?: boolean,
  type?: string,
  list?: string,
|}) => {
  const [text, setText] = React.useState<string>(value == null ? '' : String(value));
  const focused = React.useRef(false);
  React.useEffect(
    () => {
      if (!focused.current) setText(value == null ? '' : String(value));
    },
    [value]
  );
  const commit = () => {
    if (text !== (value == null ? '' : String(value))) onChange(text);
  };
  const commonProps = {
    value: text,
    placeholder,
    autoFocus,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      commit();
    },
    onChange: (e: any) => {
      setText(e.target.value);
      if (onLiveChange) onLiveChange(e.target.value);
    },
    onKeyDown: (e: any) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
        commit();
        if (!multiline) e.target.blur();
      }
      if (e.key === 'Escape') {
        setText(value == null ? '' : String(value));
        e.target.blur();
      }
    },
    spellCheck: !code,
    autoComplete: 'off',
  };
  if (multiline)
    return (
      <textarea
        {...commonProps}
        rows={rows || 3}
        className={`wve-textarea ${code ? 'wve-code' : ''} ${className || ''}`}
      />
    );
  return (
    <input
      {...commonProps}
      type={type || 'text'}
      list={list}
      className={`wve-input ${error ? 'wve-error' : ''} ${className || ''}`}
    />
  );
};

export const SelectInput = ({
  value,
  onChange,
  options,
  placeholder,
}: {|
  value: string,
  onChange: string => void,
  options: Array<{ value: string, label: string }>,
  placeholder?: string,
|}) => (
  <select
    className="wve-select"
    value={value == null ? '' : String(value)}
    onChange={e => onChange(e.target.value)}
    onKeyDown={e => e.stopPropagation()}
  >
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
    {value && !options.some(option => option.value === value) && (
      <option value={value}>{value}</option>
    )}
  </select>
);

export const CheckboxInput = ({
  checked,
  onChange,
  label,
}: {|
  checked: boolean,
  onChange: boolean => void,
  label: React.Node,
|}) => (
  <label className="wve-row" style={{ cursor: 'pointer' }}>
    <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

export const FieldLabel = ({ children }: {| children: React.Node |}) => (
  <div className="wve-field-label">{children}</div>
);

// Colors

const parseCssColor = (value: string): ?string => {
  if (!value) return null;
  return value;
};

/** Resolve var(--color-xxx) using the theme of the project, for displaying swatches. */
export const useResolveThemeColor = () => {
  const { project } = useWebsiteEditor();
  return React.useCallback(
    (value: string): string => {
      const match = /^var\(--color-([\w-]+)\)$/.exec((value || '').trim());
      if (!match) return value;
      const color = project.theme.colors.find(c => c.name === match[1]);
      return color ? color.value : value;
    },
    [project.theme.colors]
  );
};

const toPickerColor = (value: string) => {
  // Let the browser parse any CSS color.
  if (typeof document === 'undefined') return '#000000';
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return '#000000';
  context.fillStyle = '#000000';
  context.fillStyle = value;
  return context.fillStyle;
};

export const ColorInput = ({
  value,
  onChange,
  placeholder,
  allowThemeColors = true,
}: {|
  value: string,
  onChange: string => void,
  placeholder?: string,
  allowThemeColors?: boolean,
|}) => {
  const { project } = useWebsiteEditor();
  const resolveThemeColor = useResolveThemeColor();
  const [anchor, setAnchor] = React.useState<?HTMLElement>(null);
  const displayed = resolveThemeColor(value || placeholder || '');
  return (
    <div className="wve-row wve-grow">
      <button
        type="button"
        className="wve-color-swatch"
        onClick={e => setAnchor(e.currentTarget)}
        title="Pick a color"
      >
        <span style={{ background: parseCssColor(displayed) || 'transparent', opacity: value ? 1 : 0.4 }} />
      </button>
      <TextInput value={value} onChange={onChange} placeholder={placeholder} />
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div className="wve-color-popover">
          {allowThemeColors && (
            <>
              <div className="wve-small wve-muted">Theme colors</div>
              <div className="wve-theme-colors">
                {project.theme.colors.map(color => (
                  <button
                    key={color.name}
                    title={`${color.name} (var(--color-${color.name}))`}
                    style={{ background: color.value }}
                    onClick={() => {
                      onChange(`var(--color-${color.name})`);
                      setAnchor(null);
                    }}
                  />
                ))}
                <button
                  title="Transparent"
                  style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px' }}
                  onClick={() => {
                    onChange('transparent');
                    setAnchor(null);
                  }}
                />
              </div>
            </>
          )}
          <SketchPicker
            color={toPickerColor(displayed || '#000000')}
            onChangeComplete={color => {
              const { r, g, b, a } = color.rgb;
              onChange(a === 1 || a === undefined ? color.hex : `rgba(${r}, ${g}, ${b}, ${a})`);
            }}
            presetColors={[]}
          />
        </div>
      </Popover>
    </div>
  );
};

// Assets

export const AssetPicker = ({
  value,
  onChange,
  kind,
  allowUrl = true,
}: {|
  value: string,
  onChange: string => void,
  kind: 'image' | 'video' | 'font' | 'audio' | 'file',
  allowUrl?: boolean,
|}) => {
  const { project, importAssets, resolveAssetUrl } = useWebsiteEditor();
  const inputRef = React.useRef<?HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const assets = project.assets.filter(asset => kind === 'file' || asset.kind === kind);
  const currentAssetId = isAssetReference(value) ? getAssetIdFromReference(value) : '';
  const isEmbedded = typeof value === 'string' && value.startsWith('data:');
  const isUrl = !!value && !currentAssetId && !isEmbedded;
  const [urlMode, setUrlMode] = React.useState<boolean>(isUrl);
  React.useEffect(
    () => {
      if (isUrl) setUrlMode(true);
    },
    [isUrl]
  );
  const preview = currentAssetId ? resolveAssetUrl(currentAssetId) : value;
  const accept =
    kind === 'image'
      ? 'image/*'
      : kind === 'video'
      ? 'video/*'
      : kind === 'font'
      ? '.woff,.woff2,.ttf,.otf'
      : kind === 'audio'
      ? 'audio/*'
      : '*/*';
  const kindLabel = kind === 'file' ? 'file' : kind;

  const upload = async (files: Array<File>) => {
    if (!files.length) return;
    setIsUploading(true);
    const created = await importAssets(files);
    setIsUploading(false);
    if (created[0]) {
      setUrlMode(false);
      onChange(ASSET_REFERENCE_PREFIX + created[0].id);
    }
  };
  const openFilePicker = () => {
    if (inputRef.current) inputRef.current.click();
  };

  const selectValue = currentAssetId
    ? ASSET_REFERENCE_PREFIX + currentAssetId
    : isEmbedded
    ? '__embedded__'
    : urlMode
    ? '__url__'
    : '';

  return (
    <div className="wve-asset-picker">
      {(kind === 'image' || kind === 'video') && (
        <div
          className={`wve-asset-drop ${isDragOver ? 'wve-active' : ''}`}
          role="button"
          tabIndex={0}
          title={`Click or drop a file to upload a new ${kindLabel}`}
          onClick={openFilePicker}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') openFilePicker();
          }}
          onDragOver={e => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragOver(false);
            upload(Array.from(e.dataTransfer.files || []));
          }}
        >
          {preview && kind === 'image' ? (
            <img src={preview} alt="" />
          ) : preview && kind === 'video' ? (
            <video src={preview} muted />
          ) : (
            <span className="wve-asset-drop-empty">
              <Upload />
              Click or drop a {kindLabel} here
            </span>
          )}
          {preview && <span className="wve-asset-drop-hint">{isUploading ? 'Uploading...' : 'Click or drop to replace'}</span>}
        </div>
      )}
      <div className="wve-row">
        <select
          className="wve-select"
          value={selectValue}
          onChange={e => {
            const choice = e.target.value;
            if (choice === '__url__') {
              setUrlMode(true);
              if (currentAssetId || isEmbedded) onChange('');
              return;
            }
            if (choice === '__embedded__') return;
            setUrlMode(false);
            onChange(choice);
          }}
          onKeyDown={e => e.stopPropagation()}
        >
          <option value="">No {kindLabel}</option>
          {isEmbedded && <option value="__embedded__">Embedded {kindLabel} (from the template)</option>}
          {assets.length > 0 && (
            <optgroup label="Assets of the website">
              {assets.map(asset => (
                <option key={asset.id} value={ASSET_REFERENCE_PREFIX + asset.id}>
                  {asset.name}
                </option>
              ))}
            </optgroup>
          )}
          {allowUrl && <option value="__url__">Link to a {kindLabel} on the web (URL)...</option>}
        </select>
        <button
          type="button"
          className="wve-small-button"
          title={`Upload a ${kindLabel} from your computer`}
          onClick={openFilePicker}
          disabled={isUploading}
        >
          <Upload />
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={e => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            upload(files);
          }}
        />
      </div>
      {allowUrl && urlMode && !currentAssetId && !isEmbedded && (
        <TextInput value={value} onChange={onChange} placeholder={`https://example.com/my-${kindLabel}`} />
      )}
    </div>
  );
};

// Links

export const HrefInput = ({
  value,
  onChange,
}: {|
  value: string,
  onChange: string => void,
|}) => {
  const { project } = useWebsiteEditor();
  const current = value || '';
  const kind = current.startsWith('page:')
    ? 'page'
    : current.startsWith('#')
    ? 'anchor'
    : current.startsWith('mailto:')
    ? 'email'
    : current.startsWith('tel:')
    ? 'phone'
    : current.startsWith(ASSET_REFERENCE_PREFIX)
    ? 'file'
    : current
    ? 'url'
    : 'none';
  const pageReference = kind === 'page' ? current.substring(5).split('#')[0] : '';
  const page = project.pages.find(
    p => p.id === pageReference || p.slug === pageReference || p.name.toLowerCase() === pageReference
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SelectInput
        value={kind}
        onChange={newKind => {
          if (newKind === 'none') onChange('');
          else if (newKind === 'page') onChange(project.pages[0] ? 'page:' + project.pages[0].id : '');
          else if (newKind === 'anchor') onChange('#');
          else if (newKind === 'email') onChange('mailto:');
          else if (newKind === 'phone') onChange('tel:');
          else if (newKind === 'file') onChange(project.assets[0] ? ASSET_REFERENCE_PREFIX + project.assets[0].id : '');
          else onChange('https://');
        }}
        options={[
          { value: 'none', label: 'Nothing' },
          { value: 'page', label: 'A page of the website' },
          { value: 'anchor', label: 'A section of the page (#anchor)' },
          { value: 'url', label: 'Another website (URL)' },
          { value: 'email', label: 'Send an email' },
          { value: 'phone', label: 'Call a phone number' },
          { value: 'file', label: 'A file (asset)' },
        ]}
      />
      {kind === 'page' && (
        <SelectInput
          value={page ? page.id : ''}
          onChange={pageId => onChange('page:' + pageId)}
          options={project.pages.map(p => ({ value: p.id, label: p.name }))}
          placeholder="Choose a page"
        />
      )}
      {kind === 'file' && (
        <SelectInput
          value={current}
          onChange={onChange}
          options={project.assets.map(asset => ({ value: ASSET_REFERENCE_PREFIX + asset.id, label: asset.name }))}
          placeholder="Choose a file"
        />
      )}
      {['anchor', 'url', 'email', 'phone'].includes(kind) && (
        <TextInput value={current} onChange={onChange} />
      )}
    </div>
  );
};

// Icons

export const IconPicker = ({
  value,
  onChange,
  allowNone,
}: {|
  value: string,
  onChange: string => void,
  allowNone?: boolean,
|}) => {
  const [anchor, setAnchor] = React.useState<?HTMLElement>(null);
  const isTemplate = typeof value === 'string' && value.includes('{{');
  return (
    <div className="wve-row">
      <button
        type="button"
        className="wve-icon-button"
        style={{ border: '1px solid var(--theme-list-item-separator-color)', width: 32, height: 32 }}
        onClick={e => setAnchor(e.currentTarget)}
        dangerouslySetInnerHTML={{ __html: value && !isTemplate ? renderIconSvg(value) : '' }}
      />
      <TextInput value={value || ''} onChange={onChange} placeholder={allowNone ? 'No icon' : 'Icon name'} />
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 32px)', gap: 4, padding: 8 }}>
          {allowNone && (
            <button
              className="wve-icon-button"
              title="No icon"
              onClick={() => {
                onChange('');
                setAnchor(null);
              }}
            >
              ∅
            </button>
          )}
          {ICON_NAMES.map(name => (
            <button
              key={name}
              title={name}
              className={`wve-icon-button ${value === name ? 'wve-active' : ''}`}
              style={{ width: 32, height: 32 }}
              onClick={() => {
                onChange(name);
                setAnchor(null);
              }}
              dangerouslySetInnerHTML={{ __html: renderIconSvg(name) }}
            />
          ))}
        </div>
      </Popover>
    </div>
  );
};

/** A collapsible section of a panel. */
export const PanelSection = ({
  title,
  children,
  defaultOpen = true,
  actions,
  badge,
}: {|
  title: React.Node,
  children: React.Node,
  defaultOpen?: boolean,
  actions?: React.Node,
  badge?: React.Node,
|}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="wve-section">
      <div className="wve-section-header" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span>
        <span>{title}</span>
        {badge}
        <span className="wve-grow" />
        <span onClick={e => e.stopPropagation()}>{actions}</span>
      </div>
      {open && <div className="wve-section-body">{children}</div>}
    </div>
  );
};
