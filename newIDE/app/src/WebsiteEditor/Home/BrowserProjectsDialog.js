// @flow
// "Open a website" for the web version: projects stored in the browser,
// or a ".webvelop" file to import.
import * as React from 'react';
import Dialog from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import RaisedButton from '../../UI/RaisedButton';
import Upload from '../../UI/CustomSvgIcons/Upload';
import Trash from '../../UI/CustomSvgIcons/Trash';
import {
  listBrowserProjects,
  deleteBrowserProject,
  importProjectFile,
  type BrowserProjectSummary,
} from '../../ProjectsStorage/WebvelopStorageProviders';
import { type FileMetadata } from '../../ProjectsStorage';
import { WebvelopLogoIcon } from '../ElementIcons';
import useAlertDialog from '../../UI/Alert/useAlertDialog';

type Props = {| onChoose: (?FileMetadata) => void |};

const BrowserProjectsDialog = ({ onChoose }: Props) => {
  const [projects, setProjects] = React.useState<?Array<BrowserProjectSummary>>(null);
  const [error, setError] = React.useState<?string>(null);
  const inputRef = React.useRef<?HTMLInputElement>(null);
  const { showDeleteConfirmation } = useAlertDialog();
  const refresh = React.useCallback(() => {
    listBrowserProjects().then(setProjects, e => setError(e.message));
  }, []);
  React.useEffect(refresh, [refresh]);
  return (
    <Dialog
      open
      title="Open a website"
      maxWidth="sm"
      onRequestClose={() => onChoose(null)}
      actions={[<FlatButton key="cancel" label="Cancel" onClick={() => onChoose(null)} />]}
      secondaryActions={[
        <RaisedButton
          key="import"
          icon={<Upload />}
          label="Import a .webvelop file"
          onClick={() => inputRef.current && inputRef.current.click()}
        />,
      ]}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".webvelop,application/json"
        style={{ display: 'none' }}
        onChange={async e => {
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (!file) return;
          try {
            onChoose(await importProjectFile(file));
          } catch (importError) {
            setError(importError.message);
          }
        }}
      />
      {error && <div style={{ color: 'var(--theme-error-color)', marginBottom: 8 }}>{error}</div>}
      {projects === null ? (
        <div className="wve-muted">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="wve-muted">No website is stored in this browser yet.</div>
      ) : (
        <div className="wve-recent-list">
          {projects.map(project => (
            <button
              key={project.id}
              className="wve-recent-item"
              onClick={() =>
                onChoose({ fileIdentifier: project.id, name: project.name, lastModifiedDate: project.lastModifiedDate })
              }
            >
              <WebvelopLogoIcon style={{ width: 28, height: 28 }} />
              <div className="wve-grow">
                <strong>{project.name}</strong>
                <span>{new Date(project.lastModifiedDate).toLocaleString()}</span>
              </div>
              <span
                className="wve-icon-button"
                title="Delete from the browser"
                onClick={async e => {
                  e.stopPropagation();
                  const confirmed = await showDeleteConfirmation({
                    title: 'Delete this website?',
                    message: `"${project.name}" will be deleted from the storage of this browser.`,
                  });
                  if (confirmed) {
                    await deleteBrowserProject(project.id);
                    refresh();
                  }
                }}
              >
                <Trash />
              </span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
};

export default BrowserProjectsDialog;
