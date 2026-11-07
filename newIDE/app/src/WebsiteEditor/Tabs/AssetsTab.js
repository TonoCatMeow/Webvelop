// @flow
// The assets of the website: images, videos, fonts and other files.
import * as React from 'react';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { TextInput, FieldLabel } from '../Fields/Fields';
import { type WebsiteProject } from '../../Website/Model/Schema';
import { walkElements } from '../../Website/Model/Tree';
import { ASSET_REFERENCE_PREFIX } from '../../Website/Model/ProjectOps';
import RaisedButton from '../../UI/RaisedButton';
import FlatButton from '../../UI/FlatButton';
import Upload from '../../UI/CustomSvgIcons/Upload';
import { ElementIcon } from '../ElementIcons';
import useAlertDialog from '../../UI/Alert/useAlertDialog';

const formatSize = (size: ?number) => {
  if (!size) return '';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return Math.round(size / 1024) + ' KB';
  return (size / 1024 / 1024).toFixed(1) + ' MB';
};

/** Find where an asset is used, by searching its reference in the project. */
const getAssetUsages = (project: WebsiteProject, assetId: string): Array<string> => {
  const reference = ASSET_REFERENCE_PREFIX + assetId;
  const usages = [];
  const scan = (name: string, root: any) =>
    walkElements(root, element => {
      if (JSON.stringify(element.props).includes(reference) || JSON.stringify(element.styles).includes(reference))
        usages.push(`${name} › ${element.name}`);
    });
  project.pages.forEach(page => scan(page.name, page.root));
  project.components.forEach(component => scan(component.name, component.root));
  if (project.settings.faviconAssetId === assetId) usages.push('Favicon');
  return usages;
};

const AssetsTab = () => {
  const { project, updateProject, importAssets, resolveAssetUrl } = useWebsiteEditor();
  const { showDeleteConfirmation } = useAlertDialog();
  const [selectedId, setSelectedId] = React.useState<?string>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<?HTMLInputElement>(null);
  const selected = project.assets.find(asset => asset.id === selectedId);

  const onFiles = async (files: Array<File>) => {
    if (!files.length) return;
    const created = await importAssets(files);
    if (created.length) setSelectedId(created[created.length - 1].id);
  };

  return (
    <div className="wve-editor">
      <div
        className="wve-scroll"
        style={{ outline: isDragOver ? '2px dashed var(--theme-primary-color)' : undefined, outlineOffset: -8 }}
        onDragOver={e => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          onFiles(Array.from(e.dataTransfer.files || []));
        }}
      >
        <div className="wve-toolbar">
          <strong>Assets ({project.assets.length})</strong>
          <span style={{ flex: 1 }} />
          <RaisedButton primary icon={<Upload />} label="Import files" onClick={() => inputRef.current && inputRef.current.click()} />
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              onFiles(files);
            }}
          />
        </div>
        {project.assets.length === 0 && (
          <div className="wve-empty" style={{ padding: 48 }}>
            Drop images, videos, fonts or any file here, or click "Import files". Assets are copied into the "assets"
            folder of the website, and included in the exported website.
          </div>
        )}
        <div className="wve-assets-grid">
          {project.assets.map(asset => {
            const url = resolveAssetUrl(asset.id);
            return (
              <div
                key={asset.id}
                className={`wve-asset-card ${asset.id === selectedId ? 'wve-active' : ''}`}
                onClick={() => setSelectedId(asset.id)}
              >
                <div className="wve-asset-thumb">
                  {asset.kind === 'image' && url ? (
                    <img src={url} alt={asset.name} />
                  ) : asset.kind === 'video' && url ? (
                    <video src={url} muted />
                  ) : (
                    <ElementIcon name={asset.kind === 'font' ? 'text' : asset.kind === 'video' ? 'video' : 'file'} style={{ fontSize: 40, opacity: 0.6 }} />
                  )}
                </div>
                <div className="wve-asset-name" title={asset.name}>
                  {asset.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="wve-panel wve-right" style={{ width: 300, flexShrink: 0 }}>
          <div className="wve-scroll" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={selected.name}
                onChange={name =>
                  name.trim() &&
                  updateProject(current => ({
                    ...current,
                    assets: current.assets.map(a => (a.id === selected.id ? { ...a, name: name.trim() } : a)),
                  }))
                }
              />
            </div>
            <div className="wve-muted wve-small" style={{ lineHeight: 1.6 }}>
              Type: {selected.kind} ({selected.mimeType})
              <br />
              {selected.size ? `Size: ${formatSize(selected.size)}` : ''}
              <br />
              {selected.path ? `File: ${selected.path}` : 'Stored in the project file'}
            </div>
            <div>
              <FieldLabel>Used by</FieldLabel>
              {(() => {
                const usages = getAssetUsages(project, selected.id);
                return usages.length ? (
                  usages.map(usage => (
                    <div key={usage} className="wve-small">
                      {usage}
                    </div>
                  ))
                ) : (
                  <div className="wve-muted wve-small">Not used by any element.</div>
                );
              })()}
            </div>
            <FlatButton
              label="Delete this asset"
              onClick={async () => {
                const confirmed = await showDeleteConfirmation({
                  title: 'Delete this asset?',
                  message: `"${selected.name}" will be removed from the website. Elements using it will show an empty image.`,
                });
                if (!confirmed) return;
                updateProject(current => ({
                  ...current,
                  assets: current.assets.filter(a => a.id !== selected.id),
                  settings: {
                    ...current.settings,
                    faviconAssetId: current.settings.faviconAssetId === selected.id ? null : current.settings.faviconAssetId,
                  },
                }));
                setSelectedId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsTab;
