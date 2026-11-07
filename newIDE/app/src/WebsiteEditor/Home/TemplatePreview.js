// @flow
// A live miniature of a website template: its first page rendered by the
// Webvelop renderer, shown in a scaled-down iframe (scripts disabled).
import * as React from 'react';
import { createWebsiteProject } from '../../Website/Model/Templates';
import { buildStandalonePage } from '../../Website/Rendering/SiteBuilder';
import { getRuntimeJs, getRuntimeCss } from '../../Website/Services/RuntimeSources';

const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 800;
const htmlCache: { [string]: string } = {};

const getTemplateHtml = (templateId: string): string => {
  if (htmlCache[templateId]) return htmlCache[templateId];
  const project = createWebsiteProject({ name: 'My website', templateId });
  const { html } = buildStandalonePage(
    project,
    project.settings.homePageId,
    { runtimeJs: getRuntimeJs(), runtimeCss: getRuntimeCss(), reactJs: '', reactDomJs: '' },
    () => '',
    'export'
  );
  // Hide the scrollbars of the miniature.
  htmlCache[templateId] = html.replace(
    '</head>',
    '<style>html,body{overflow:hidden!important;scrollbar-width:none}</style></head>'
  );
  return htmlCache[templateId];
};

const TemplatePreview = ({ templateId }: {| templateId: string |}): React.Node => {
  const containerRef = React.useRef<?HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const html = React.useMemo(() => getTemplateHtml(templateId), [templateId]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setWidth(container.clientWidth);
    update();
    // $FlowFixMe[cannot-resolve-name]
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const scale = width ? width / PAGE_WIDTH : 0.2;
  return (
    <div className="wve-template-preview" ref={containerRef}>
      <iframe
        title={`Preview of the template ${templateId}`}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        aria-hidden="true"
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
};

export default TemplatePreview;
