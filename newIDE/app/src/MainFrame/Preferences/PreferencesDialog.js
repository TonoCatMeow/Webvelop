// @flow
import * as React from 'react';
import Dialog from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import PreferencesContext from './PreferencesContext';
import { themes } from '../../UI/Theme/ThemeRegistry';
import { getAllThemes } from '../../CodeEditor/Theme';
import { SelectInput, CheckboxInput, FieldLabel, TextInput } from '../../WebsiteEditor/Fields/Fields';
import { getWebvelopPaths, openFolder } from '../../Website/Services/WebsiteExporter';

type Props = {| onClose: () => void |};

const PreferencesDialog = ({ onClose }: Props): React.Node => {
  const { values, setValues, resetHiddenAlertMessages } = React.useContext(PreferencesContext);
  const paths = getWebvelopPaths();
  return (
    <Dialog
      open
      title="Preferences"
      maxWidth="sm"
      onRequestClose={onClose}
      actions={[<FlatButton key="close" label="Close" primary onClick={onClose} />]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ margin: 0 }}>Appearance</h3>
        <div>
          <FieldLabel>Theme of the editor</FieldLabel>
          <SelectInput
            value={values.themeName}
            onChange={themeName => setValues({ themeName })}
            options={Object.keys(themes).map(name => ({ value: name, label: name }))}
          />
        </div>
        <h3 style={{ margin: 0 }}>Code editor</h3>
        <div>
          <FieldLabel>Theme of the code editor</FieldLabel>
          <SelectInput
            value={values.codeEditorThemeName}
            onChange={codeEditorThemeName => setValues({ codeEditorThemeName })}
            options={getAllThemes().map(theme => ({ value: theme.themeName, label: theme.name }))}
          />
        </div>
        <div>
          <FieldLabel>Font size</FieldLabel>
          <TextInput
            type="number"
            value={String(values.codeEditorFontSize)}
            onChange={text => setValues({ codeEditorFontSize: Math.max(8, Math.min(32, parseInt(text, 10) || 14)) })}
          />
        </div>
        <CheckboxInput
          checked={values.showJsTypeError}
          onChange={showJsTypeError => setValues({ showJsTypeError })}
          label="Show type errors in JavaScript (in addition to syntax errors)"
        />
        <h3 style={{ margin: 0 }}>Projects</h3>
        <div>
          <FieldLabel>Autosave (for recovery after a crash)</FieldLabel>
          <SelectInput
            value={String(values.autosaveEveryMinutes)}
            onChange={text => setValues({ autosaveEveryMinutes: parseInt(text, 10) || 0 })}
            options={[
              { value: '0', label: 'Disabled' },
              { value: '1', label: 'Every minute' },
              { value: '2', label: 'Every 2 minutes' },
              { value: '5', label: 'Every 5 minutes' },
              { value: '10', label: 'Every 10 minutes' },
            ]}
          />
        </div>
        <CheckboxInput
          checked={values.openLastProjectAtStartup}
          onChange={openLastProjectAtStartup => setValues({ openLastProjectAtStartup })}
          label="Reopen the last website when Webvelop starts"
        />
        <div>
          <FieldLabel>Clicking outside of a dialog</FieldLabel>
          <SelectInput
            value={values.backdropClickBehavior}
            onChange={backdropClickBehavior => setValues({ backdropClickBehavior: (backdropClickBehavior: any) })}
            options={[
              { value: 'nothing', label: 'Does nothing' },
              { value: 'cancel', label: 'Closes the dialog (cancelling)' },
              { value: 'apply', label: 'Closes the dialog (applying changes)' },
            ]}
          />
        </div>
        <div>
          <FlatButton label="Show again the hidden messages and tips" onClick={resetHiddenAlertMessages} />
        </div>
        {paths && (
          <>
            <h3 style={{ margin: 0 }}>Data of Webvelop</h3>
            <div className="wve-muted wve-small" style={{ lineHeight: 1.6 }}>
              Webvelop keeps its settings, autosaves, logs, previews and exports in its own folder, separated from any other
              application:
              <br />
              <code>{paths.dataDir}</code>
              <br />
              New websites are created by default in <code>{paths.projectsDir}</code>.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <FlatButton label="Open the data folder" onClick={() => openFolder(paths.dataDir)} />
              <FlatButton label="Open the exports folder" onClick={() => openFolder(paths.exportsDir)} />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};

export default PreferencesDialog;
