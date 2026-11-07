// @flow
// The "Interactions" tab of a page, or of the whole website.
import * as React from 'react';
import EventsList from '../Interactions/EventsList';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { createRootElement } from '../../Website/Elements/ElementTypes';

export const PageEventsTab = ({ pageId, highlightedEventId }: {| pageId: string, highlightedEventId?: ?string |}) => {
  const { project, updateProject, openTab } = useWebsiteEditor();
  const page = project.pages.find(p => p.id === pageId);
  if (!page) return <div className="wve-empty">This page does not exist anymore.</div>;
  return (
    <div className="wve-scroll" style={{ background: 'var(--theme-surface-canvas-background-color)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ padding: '16px 12px 0' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Interactions of the page "{page.name}"</h2>
          <p className="wve-muted" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
            Describe what happens when visitors use the page: <em>when</em> something happens (a click, a form sent,
            scrolling...), <em>if</em> some conditions are true, <em>do</em> some actions. For complex logic, use a{' '}
            <button className="wve-link-button" onClick={() => openTab({ kind: 'page-code', id: pageId })}>
              JavaScript script
            </button>{' '}
            or a custom action.
          </p>
        </div>
        <EventsList
          events={page.events}
          root={page.root}
          highlightedEventId={highlightedEventId}
          onChange={(events, mergeKey) =>
            updateProject(
              current => ({ ...current, pages: current.pages.map(p => (p.id === pageId ? { ...p, events } : p)) }),
              { mergeKey: mergeKey ? `page-events-${pageId}-${mergeKey}` : undefined }
            )
          }
        />
      </div>
    </div>
  );
};

const emptyRoot = createRootElement();

export const SiteEventsTab = () => {
  const { project, updateProject } = useWebsiteEditor();
  return (
    <div className="wve-scroll" style={{ background: 'var(--theme-surface-canvas-background-color)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ padding: '16px 12px 0' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Interactions of all the pages</h2>
          <p className="wve-muted" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
            These interactions run on every page of the website: use them for timers, keyboard shortcuts, scrolling or
            variables changes common to all pages. Use the "Current page" condition to restrict one to some pages.
          </p>
        </div>
        <EventsList
          events={project.globalEvents}
          root={emptyRoot}
          onChange={(globalEvents, mergeKey) =>
            updateProject(current => ({ ...current, globalEvents }), {
              mergeKey: mergeKey ? `site-events-${mergeKey}` : undefined,
            })
          }
          emptyText="No interaction common to all pages yet."
        />
      </div>
    </div>
  );
};
