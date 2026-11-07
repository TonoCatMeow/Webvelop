// @flow
// Preview of the website: the real generated website (HTML, CSS, JavaScript,
// interactions and React components), at the size of a desktop, tablet or mobile.
import * as React from 'react';
import Dialog from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { buildStandalonePage, type BuildIssue } from '../../Website/Rendering/SiteBuilder';
import { getRuntimeSources } from '../../Website/Services/RuntimeSources';
import { openExportInBrowser } from '../../Website/Services/WebsiteExporter';
import { getPageFileName } from '../../Website/Model/ProjectOps';
import { SelectInput } from '../Fields/Fields';
import optionalRequire from '../../Utils/OptionalRequire';
import Desktop from '../../UI/CustomSvgIcons/Desktop';
import Mobile from '../../UI/CustomSvgIcons/Mobile';
import Refresh from '../../UI/CustomSvgIcons/Refresh';
import ShareExternal from '../../UI/CustomSvgIcons/ShareExternal';

const electron = optionalRequire('electron');

const DEVICES = [
  { id: 'full', label: 'Full width', width: null, height: null },
  { id: 'desktop', label: 'Desktop', width: 1280, height: 800 },
  { id: 'tablet', label: 'Tablet', width: 820, height: 1180 },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
];

type LogEntry = {| level: string, message: string |};

type Props = {|
  initialPageId: ?string,
  onClose: () => void,
|};

const PreviewDialog = ({ initialPageId, onClose }: Props) => {
  const { project, projectFilePath, resolveAssetUrl } = useWebsiteEditor();
  const [pageId, setPageId] = React.useState<string>(
    initialPageId || project.settings.homePageId || (project.pages[0] ? project.pages[0].id : '')
  );
  const [device, setDevice] = React.useState<string>('desktop');
  const [srcDoc, setSrcDoc] = React.useState<string>('');
  const [issues, setIssues] = React.useState<Array<BuildIssue>>([]);
  const [logs, setLogs] = React.useState<Array<LogEntry>>([]);
  const [reloadCount, setReloadCount] = React.useState(0);
  const [showConsole, setShowConsole] = React.useState(false);
  const iframeRef = React.useRef<?HTMLIFrameElement>(null);
  const pendingHash = React.useRef<string>('');

  React.useEffect(
    () => {
      let cancelled = false;
      getRuntimeSources().then(runtime => {
        if (cancelled) return;
        const result = buildStandalonePage(project, pageId, runtime, resolveAssetUrl, 'preview');
        setIssues(result.issues);
        setLogs([]);
        setSrcDoc(result.html);
      });
      return () => {
        cancelled = true;
      };
    },
    [project, pageId, reloadCount, resolveAssetUrl]
  );

  React.useEffect(
    () => {
      const onMessage = (event: MessageEvent) => {
        const iframe = iframeRef.current;
        if (!iframe || event.source !== iframe.contentWindow) return;
        const data: any = event.data;
        if (!data || typeof data.type !== 'string') return;
        if (data.type === 'webvelop:navigate') {
          pendingHash.current = data.hash || '';
          if (data.pageId === pageId) setReloadCount(count => count + 1);
          else setPageId(data.pageId);
        } else if (data.type === 'webvelop:console') {
          setLogs(previous => [...previous.slice(-300), { level: data.level, message: data.message }]);
        } else if (data.type === 'webvelop:error') {
          setLogs(previous => [...previous.slice(-300), { level: 'error', message: (data.where ? data.where + ': ' : '') + data.message }]);
          setShowConsole(true);
        } else if (data.type === 'webvelop:external-link') {
          if (electron) electron.shell.openExternal(data.url);
          else window.open(data.url, '_blank', 'noopener');
        }
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    },
    [pageId]
  );

  const deviceInfo = DEVICES.find(d => d.id === device) || DEVICES[0];
  const errors = issues.filter(issue => issue.severity === 'error');
  const page = project.pages.find(p => p.id === pageId);

  return (
    <Dialog
      open
      title={`Preview — ${project.name}`}
      fullscreen="always-even-on-desktop"
      noPadding
      flexColumnBody
      onRequestClose={onClose}
      actions={[<FlatButton key="close" label="Close the preview" primary onClick={onClose} />]}
    >
      <div className="wve-preview">
        <div className="wve-toolbar">
          <div style={{ width: 220 }}>
            <SelectInput
              value={pageId}
              onChange={setPageId}
              options={project.pages.map(p => ({ value: p.id, label: `${p.name} (${getPageFileName(p)})` }))}
            />
          </div>
          <div className="wve-breakpoints">
            {DEVICES.map(d => (
              <button key={d.id} className={device === d.id ? 'wve-active' : ''} onClick={() => setDevice(d.id)}>
                {d.id === 'mobile' ? <Mobile /> : d.id === 'desktop' || d.id === 'full' ? <Desktop /> : null}
                {d.label}
              </button>
            ))}
          </div>
          <button className="wve-icon-button" title="Reload" onClick={() => setReloadCount(count => count + 1)}>
            <Refresh />
          </button>
          <span style={{ flex: 1 }} />
          <button className={`wve-icon-button ${showConsole ? 'wve-active' : ''}`} onClick={() => setShowConsole(!showConsole)}>
            Console{logs.length ? ` (${logs.length})` : ''}
            {errors.length ? ` — ${errors.length} problem(s)` : ''}
          </button>
          {electron && (
            <button
              className="wve-icon-button"
              title="Export the website in a temporary folder and open it in your web browser"
              onClick={() => openExportInBrowser(project, projectFilePath, page ? getPageFileName(page) : 'index.html')}
            >
              <ShareExternal />
              <span style={{ marginLeft: 4 }}>Open in the browser</span>
            </button>
          )}
        </div>
        <div className="wve-preview-stage">
          <iframe
            ref={iframeRef}
            key={reloadCount + '-' + pageId}
            title="Website preview"
            srcDoc={srcDoc}
            onLoad={() => {
              const hash = pendingHash.current;
              pendingHash.current = '';
              const iframe = iframeRef.current;
              if (hash && iframe && iframe.contentDocument) {
                const target = iframe.contentDocument.getElementById(hash.substring(1));
                if (target) target.scrollIntoView();
              }
            }}
            style={{
              width: deviceInfo.width ? deviceInfo.width : '100%',
              height: deviceInfo.height ? Math.min(deviceInfo.height, 4000) : '100%',
              maxHeight: '100%',
            }}
          />
        </div>
        {showConsole && (
          <div className="wve-console">
            {errors.map((issue, index) => (
              <div key={'issue' + index} className="wve-error">
                {issue.source}: {issue.message}
              </div>
            ))}
            {issues
              .filter(issue => issue.severity === 'warning')
              .map((issue, index) => (
                <div key={'warning' + index} className="wve-warn">
                  {issue.source}: {issue.message}
                </div>
              ))}
            {logs.map((log, index) => (
              <div key={index} className={log.level === 'error' ? 'wve-error' : log.level === 'warn' ? 'wve-warn' : ''}>
                {log.message}
              </div>
            ))}
            {!logs.length && !issues.length && <div className="wve-muted">Nothing logged yet. Use console.log in your scripts.</div>}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default PreviewDialog;
