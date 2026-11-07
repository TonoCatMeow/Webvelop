// @flow
import { Trans } from '@lingui/macro';

import * as React from 'react';
import PlaceholderLoader from '../UI/PlaceholderLoader';
import RaisedButton from '../UI/RaisedButton';
import Text from '../UI/Text';
import PreferencesContext from '../MainFrame/Preferences/PreferencesContext';
import {
  registerThemes,
  initializeCompletions,
  enableJsTypeDiagnostics,
  applyElectronClipboardPatch,
  suppressDiagnosticsMessagesForModel,
  unsuppressDiagnosticsMessagesForModel,
  baseEditorOptions,
} from './MonacoSetup';

export type CodeEditorLanguage = 'javascript' | 'css' | 'html';

export type Props = {|
  value: string,
  onChange: string => void,
  language?: CodeEditorLanguage,
  width?: number | string,
  height?: number | string,
  /** Called with the Monaco editor instance and the Monaco API, once mounted. */
  onEditorReady?: (editor: any, monaco: any) => void,
  onFocus?: () => void,
  onBlur?: () => void,
  readOnly?: boolean,
  /**
   * Diagnostics whose message contains one of these texts are not shown
   * in this editor. Useful when the code is run in a way the TypeScript
   * language service can not know about (code of an interaction is run
   * inside an async function, so `await` and `return` are allowed).
   */
  suppressedDiagnosticsMessages?: Array<string>,
|};

/**
 * The code editor (Monaco), used for the JavaScript, React (JSX), CSS and
 * HTML of websites.
 */
export const CodeEditor = ({
  value,
  onChange,
  language = 'javascript',
  width,
  height,
  onEditorReady,
  onFocus,
  onBlur,
  readOnly,
  suppressedDiagnosticsMessages,
}: Props): React.Node => {
  const [MonacoEditor, setMonacoEditor] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const { values: preferences } = React.useContext(PreferencesContext);

  const setupEditorThemes = React.useCallback((monaco: any) => {
    registerThemes(monaco);
  }, []);

  const setupEditor = React.useCallback(
    (editor: any, monaco: any) => {
      if (onFocus) editor.onDidFocusEditorText(onFocus);
      if (onBlur) editor.onDidBlurEditorText(onBlur);
      initializeCompletions(monaco);
      applyElectronClipboardPatch(editor, monaco);
      if (preferences.showJsTypeError) enableJsTypeDiagnostics(monaco);
      if (suppressedDiagnosticsMessages) {
        suppressDiagnosticsMessagesForModel(
          monaco,
          editor.getModel(),
          suppressedDiagnosticsMessages
        );
      }
      if (onEditorReady) onEditorReady(editor, monaco);
    },
    [onFocus, onBlur, onEditorReady, preferences.showJsTypeError, suppressedDiagnosticsMessages]
  );

  const loadMonacoEditor = React.useCallback(() => {
    setError(null);
    // Define the global variable used by Monaco Editor to find its worker
    // (used for auto-completions and errors).
    window.MonacoEnvironment = {
      getWorkerUrl: function(workerId, label) {
        return 'external/monaco-editor-min/vs/base/worker/workerMain.js';
      },
    };
    import(/* webpackChunkName: "react-monaco-editor" */ 'react-monaco-editor')
      .then(module => setMonacoEditor(() => module.default))
      .catch(setError);
  }, []);

  React.useEffect(
    () => {
      loadMonacoEditor();
    },
    [loadMonacoEditor]
  );

  const stopContextMenuPropagation = React.useCallback(
    (event: SyntheticEvent<>) => {
      event.stopPropagation();
    },
    []
  );

  if (error) {
    return (
      <React.Fragment>
        <Text>
          <Trans>Unable to load the code editor</Trans>
        </Text>
        <RaisedButton label={<Trans>Retry</Trans>} onClick={loadMonacoEditor} />
      </React.Fragment>
    );
  }

  if (!MonacoEditor) {
    return (
      <div style={{ width: width || '100%', height: height || '100%' }}>
        <PlaceholderLoader />
      </div>
    );
  }

  return (
    <div
      onContextMenu={stopContextMenuPropagation}
      onKeyDown={e => {
        // Keep the editor shortcuts (undo, delete...) for the code, except saving.
        if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'))
          e.stopPropagation();
      }}
      style={{ width: width || '100%', height: height || '100%' }}
    >
      <MonacoEditor
        width={width || '100%'}
        height={height || '100%'}
        language={language}
        theme={preferences.codeEditorThemeName}
        value={value}
        onChange={onChange}
        editorWillMount={setupEditorThemes}
        editorDidMount={setupEditor}
        editorWillUnmount={(editor, monaco) =>
          unsuppressDiagnosticsMessagesForModel(monaco, editor.getModel())
        }
        options={{
          ...baseEditorOptions,
          automaticLayout: true,
          readOnly: !!readOnly,
          fontSize: preferences.codeEditorFontSize,
          tabSize: 2,
          formatOnPaste: true,
        }}
      />
    </div>
  );
};
