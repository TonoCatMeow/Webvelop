// @flow
// Export of the website: a static website (HTML, CSS, JavaScript and assets)
// or a React project, written to a folder (desktop) or downloaded as a ZIP.
import * as React from 'react';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import {
  exportToFolder,
  exportToZipBlob,
  downloadBlob,
  getDefaultExportFolder,
  chooseFolder,
  openFolder,
  type ExportFormat,
} from '../../Website/Services/WebsiteExporter';
import { type BuildIssue, checkProject } from '../../Website/Rendering/SiteBuilder';
import { slugify } from '../../Website/Model/Ids';
import { TextInput, FieldLabel } from '../Fields/Fields';
import optionalRequire from '../../Utils/OptionalRequire';

const electron = optionalRequire('electron');
const path = optionalRequire('path');

const FORMATS: Array<{| id: ExportFormat, title: string, description: string |}> = [
  {
    id: 'static',
    title: 'Static website (HTML, CSS, JavaScript)',
    description:
      'Ready to publish on any web hosting (Netlify, GitHub Pages, a server...) or to open directly from the folder. Includes the interactions, React components and assets.',
  },
  {
    id: 'react',
    title: 'React project (Vite)',
    description:
      'A React project where every page is a JSX component. Continue the development with npm: "npm install" then "npm run dev".',
  },
];

type Props = {| onClose: () => void, onOpenProblem: (issue: BuildIssue) => void |};

const ExportDialog = ({ onClose, onOpenProblem }: Props) => {
  const { project, projectFilePath } = useWebsiteEditor();
  const [format, setFormat] = React.useState<ExportFormat>('static');
  const [folder, setFolder] = React.useState<string>(getDefaultExportFolder(project, 'static') || '');
  const [isExporting, setIsExporting] = React.useState(false);
  const [result, setResult] = React.useState<?{| issues: Array<BuildIssue>, fileCount: number, outputPath: ?string |}>(null);
  const [error, setError] = React.useState<?string>(null);
  const preflightIssues = React.useMemo(() => checkProject(project), [project]);
  const isDesktop = !!electron;

  React.useEffect(
    () => {
      const defaultFolder = getDefaultExportFolder(project, format);
      if (defaultFolder) setFolder(defaultFolder);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format]
  );

  const doExport = async () => {
    setIsExporting(true);
    setError(null);
    setResult(null);
    try {
      if (isDesktop) {
        setResult(await exportToFolder(project, projectFilePath, folder, format));
      } else {
        const { blob, issues, fileCount } = await exportToZipBlob(project, projectFilePath, format);
        downloadBlob(blob, `${slugify(project.name)}${format === 'react' ? '-react' : ''}.zip`);
        setResult({ issues, fileCount, outputPath: null });
      }
    } catch (exportError) {
      console.error('Export failed:', exportError);
      setError(exportError.message || String(exportError));
    }
    setIsExporting(false);
  };

  const downloadZip = async () => {
    setIsExporting(true);
    try {
      const { blob } = await exportToZipBlob(project, projectFilePath, format);
      downloadBlob(blob, `${slugify(project.name)}${format === 'react' ? '-react' : ''}.zip`);
    } catch (exportError) {
      setError(exportError.message || String(exportError));
    }
    setIsExporting(false);
  };

  const issues = result ? result.issues : preflightIssues;
  return (
    <Dialog
      open
      title="Export the website"
      maxWidth="md"
      onRequestClose={onClose}
      actions={[
        <FlatButton key="close" label="Close" onClick={onClose} />,
        isDesktop ? <FlatButton key="zip" label="Save as ZIP" disabled={isExporting} onClick={downloadZip} /> : null,
        <DialogPrimaryButton
          key="export"
          primary
          label={isExporting ? 'Exporting...' : isDesktop ? 'Export to the folder' : 'Download as ZIP'}
          disabled={isExporting || (isDesktop && !folder)}
          onClick={doExport}
        />,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="wve-template-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {FORMATS.map(item => (
            <button
              key={item.id}
              className={`wve-template-card ${format === item.id ? 'wve-active' : ''}`}
              onClick={() => setFormat(item.id)}
            >
              <div className="wve-template-card-body">
                <div className="wve-template-card-title">
                  <strong>{item.title}</strong>
                </div>
                <p>{item.description}</p>
              </div>
            </button>
          ))}
        </div>
        {isDesktop && (
          <div>
            <FieldLabel>Folder where the website is written</FieldLabel>
            <div className="wve-row">
              <div className="wve-grow">
                <TextInput value={folder} onChange={setFolder} />
              </div>
              <FlatButton
                label="Choose..."
                onClick={async () => {
                  const chosen = await chooseFolder('Choose the export folder', folder);
                  if (chosen) setFolder(path ? path.join(chosen, slugify(project.name)) : chosen);
                }}
              />
            </div>
          </div>
        )}
        {error && <div style={{ color: 'var(--theme-error-color)' }}>The export failed: {error}</div>}
        {result && (
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--theme-surface-canvas-background-color)' }}>
            <strong className="wve-status-ok">✔ Export finished ({result.fileCount} files).</strong>
            {result.outputPath && (
              <div className="wve-row" style={{ marginTop: 8 }}>
                <span className="wve-grow wve-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {result.outputPath}
                </span>
                <FlatButton label="Open the folder" onClick={() => result.outputPath && openFolder(result.outputPath)} />
                {format === 'static' && electron && path && (
                  <FlatButton
                    label="Open in the browser"
                    onClick={() =>
                      result.outputPath &&
                      electron.shell.openExternal('file:///' + path.join(result.outputPath, 'index.html').replace(/\\/g, '/'))
                    }
                  />
                )}
              </div>
            )}
            {format === 'react' && (
              <div className="wve-muted wve-small" style={{ marginTop: 6 }}>
                In the exported folder, run <code>npm install</code> then <code>npm run dev</code>.
              </div>
            )}
          </div>
        )}
        {issues.length > 0 && (
          <div>
            <FieldLabel>{result ? 'Problems found during the export' : 'Problems to check before exporting'}</FieldLabel>
            <div className="wve-problems" style={{ maxHeight: 200, borderRadius: 6 }}>
              {issues.map((issue, index) => (
                <div
                  key={index}
                  className={`wve-problem ${issue.severity === 'error' ? 'wve-error' : 'wve-warning'}`}
                  onClick={() => issue.location && onOpenProblem(issue)}
                >
                  <span>{issue.source}</span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!issues.length && !result && <div className="wve-status-ok">✔ No problem found in the website.</div>}
      </div>
    </Dialog>
  );
};

export default ExportDialog;
