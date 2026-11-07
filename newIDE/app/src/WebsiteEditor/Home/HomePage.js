// @flow
// The start page of Webvelop: create a website from a template, open a
// website, or continue a recent one.
import * as React from 'react';
import { WEBSITE_TEMPLATES } from '../../Website/Model/Templates';
import { type FileMetadataAndStorageProviderName } from '../../ProjectsStorage';
import { WebvelopLogoIcon } from '../ElementIcons';
import TemplatePreview from './TemplatePreview';
import Add from '../../UI/CustomSvgIcons/Add';
import Folder from '../../UI/CustomSvgIcons/Folder';
import Cross from '../../UI/CustomSvgIcons/Cross';
import ArrowRight from '../../UI/CustomSvgIcons/ArrowRight';
import { getIDEVersion } from '../../Version';

const TEMPLATE_TAGS = {
  blank: ['Empty page'],
  landing: ['React component', 'Contact form', 'Responsive menu'],
  business: ['Shared header & footer', 'Components with props'],
  portfolio: ['Lightbox gallery', 'Tabs', 'Popup'],
};

export const formatRelativeDate = (timestamp: ?number): string => {
  if (!timestamp) return '';
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleDateString();
};

export const getRecentName = (item: FileMetadataAndStorageProviderName): string =>
  item.fileMetadata.name ||
  (item.fileMetadata.fileIdentifier.split(/[\\/]/).pop() || '').replace(/\.webvelop$/, '');

type Props = {|
  recentProjects: Array<FileMetadataAndStorageProviderName>,
  hasOpenedProject: boolean,
  projectName: ?string,
  onCreate: (templateId: ?string) => void,
  onOpen: () => void,
  onOpenRecent: (item: FileMetadataAndStorageProviderName) => void,
  onRemoveRecent: (item: FileMetadataAndStorageProviderName) => void,
  onContinue: () => void,
|};

const HomePage = ({
  recentProjects,
  hasOpenedProject,
  projectName,
  onCreate,
  onOpen,
  onOpenRecent,
  onRemoveRecent,
  onContinue,
}: Props): React.Node => (
  <div className="wve-home">
    <div className="wve-home-inner">
      <header className="wve-home-hero">
        <div className="wve-home-hero-text">
          <div className="wve-home-brand">
            <WebvelopLogoIcon style={{ width: 28, height: 28 }} />
            <span>Webvelop</span>
          </div>
          <h1>Build beautiful websites, visually.</h1>
          <p>
            Design responsive pages, make them interactive, add React components and JavaScript, then export a real website
            ready to publish.
          </p>
          <div className="wve-home-actions">
            <button className="wve-button wve-button-primary" onClick={() => onCreate(null)}>
              <Add />
              New website
            </button>
            <button className="wve-button" onClick={onOpen}>
              <Folder />
              Open a website
            </button>
          </div>
        </div>
        {hasOpenedProject && (
          <button className="wve-home-continue" onClick={onContinue}>
            <span className="wve-home-continue-label">Currently open</span>
            <strong>{projectName}</strong>
            <span className="wve-home-continue-action">
              Continue editing <ArrowRight />
            </span>
          </button>
        )}
      </header>

      <section>
        <div className="wve-home-section-header">
          <h2>Start from a template</h2>
          <p>Every template is a complete, responsive website that you can customize entirely.</p>
        </div>
        <div className="wve-template-grid">
          {WEBSITE_TEMPLATES.map(template => (
            <button key={template.id} className="wve-template-card" onClick={() => onCreate(template.id)}>
              <div className="wve-template-card-preview">
                <TemplatePreview templateId={template.id} />
                <span className="wve-template-card-overlay">
                  <span>Use this template</span>
                </span>
              </div>
              <div className="wve-template-card-body">
                <div className="wve-template-card-title">
                  <strong>{template.name}</strong>
                  <span className="wve-template-card-pages">
                    {template.pages.length} page{template.pages.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p>{template.description}</p>
                <div className="wve-template-card-tags">
                  {(TEMPLATE_TAGS[template.id] || []).map(tag => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="wve-home-section-header">
          <h2>Recent websites</h2>
        </div>
        {recentProjects.length === 0 ? (
          <div className="wve-home-empty">
            <Folder />
            <div>
              <strong>No recent website yet</strong>
              <p>Websites you create or open will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="wve-recent-list">
            {recentProjects.map(item => (
              <div
                key={item.storageProviderName + item.fileMetadata.fileIdentifier}
                className="wve-recent-item"
                role="button"
                tabIndex={0}
                onClick={() => onOpenRecent(item)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onOpenRecent(item);
                }}
              >
                <div className="wve-recent-icon">{getRecentName(item).charAt(0).toUpperCase() || 'W'}</div>
                <div className="wve-recent-text">
                  <strong>{getRecentName(item)}</strong>
                  <span>
                    {item.storageProviderName === 'Browser' ? 'Stored in this browser' : item.fileMetadata.fileIdentifier}
                  </span>
                </div>
                <span className="wve-recent-date">{formatRelativeDate(item.fileMetadata.lastModifiedDate)}</span>
                <button
                  className="wve-icon-button wve-recent-remove"
                  title="Remove from the list"
                  onClick={e => {
                    e.stopPropagation();
                    onRemoveRecent(item);
                  }}
                >
                  <Cross />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="wve-home-footer">Webvelop {getIDEVersion()}</footer>
    </div>
  </div>
);

export default HomePage;
