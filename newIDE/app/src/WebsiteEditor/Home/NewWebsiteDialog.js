// @flow
// Dialog to create a new website: name, template and location.
import * as React from 'react';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import { WEBSITE_TEMPLATES } from '../../Website/Model/Templates';
import TemplatePreview from './TemplatePreview';
import { TextInput, FieldLabel } from '../Fields/Fields';
import { chooseFolder, getWebvelopPaths } from '../../Website/Services/WebsiteExporter';
import optionalRequire from '../../Utils/OptionalRequire';

const electron = optionalRequire('electron');

type Props = {|
  initialTemplateId: ?string,
  onClose: () => void,
  onCreate: ({| name: string, templateId: string, folder: ?string |}) => void,
|};

const NewWebsiteDialog = ({ initialTemplateId, onClose, onCreate }: Props) => {
  const [name, setName] = React.useState('My website');
  const [templateId, setTemplateId] = React.useState(initialTemplateId || 'landing');
  const paths = getWebvelopPaths();
  const [folder, setFolder] = React.useState<?string>(paths ? paths.projectsDir : null);
  const create = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), templateId, folder });
  };
  return (
    <Dialog
      open
      title="Create a new website"
      maxWidth="md"
      onRequestClose={onClose}
      onApply={create}
      actions={[
        <FlatButton key="cancel" label="Cancel" onClick={onClose} />,
        <DialogPrimaryButton key="create" primary label="Create the website" disabled={!name.trim()} onClick={create} />,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <FieldLabel>Name of the website</FieldLabel>
          <TextInput value={name} onChange={setName} onLiveChange={setName} autoFocus />
        </div>
        <div>
          <FieldLabel>Template</FieldLabel>
          <div className="wve-template-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {WEBSITE_TEMPLATES.map(template => (
              <button
                key={template.id}
                className={`wve-template-card ${templateId === template.id ? 'wve-active' : ''}`}
                onClick={() => setTemplateId(template.id)}
                onDoubleClick={() => {
                  setTemplateId(template.id);
                  if (name.trim()) onCreate({ name: name.trim(), templateId: template.id, folder });
                }}
              >
                <div className="wve-template-card-preview">
                  <TemplatePreview templateId={template.id} />
                </div>
                <div className="wve-template-card-body">
                  <div className="wve-template-card-title">
                    <strong>{template.name}</strong>
                  </div>
                  <p>{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        {electron ? (
          <div>
            <FieldLabel>Location (a folder is created for the website inside it)</FieldLabel>
            <div className="wve-row">
              <div className="wve-grow">
                <TextInput value={folder || ''} onChange={setFolder} />
              </div>
              <FlatButton
                label="Choose..."
                onClick={async () => {
                  const chosen = await chooseFolder('Choose where to create the website', folder);
                  if (chosen) setFolder(chosen);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="wve-muted wve-small">
            The website will be saved in the storage of this browser. Use "Export" to download it, or the desktop app to
            work with files.
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default NewWebsiteDialog;
