// @flow
// A code editor filling its container, with a toolbar (insert a reference to
// an element picked on the page, format) and a list of problems (syntax errors
// are also shown in the code).
import * as React from 'react';
import { CodeEditor, type CodeEditorLanguage } from '../../CodeEditor';
import { type CodeError } from '../../Website/Rendering/ReactCompiler';
import { snippetSuppressedDiagnostics, generateProjectTypings } from '../../CodeEditor/WebvelopTypings';
import { setProjectTypings } from '../../CodeEditor/MonacoSetup';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { type DocumentRef } from '../../Website/Model/ProjectOps';
import ElementPickerDialog, { getElementCodeReference } from '../Fields/ElementPickerDialog';

type Props = {|
  value: string,
  onChange: string => void,
  language: CodeEditorLanguage,
  problems?: Array<CodeError>,
  toolbar?: React.Node,
  isSnippet?: boolean,
  /** The page or component shown first in the element picker. */
  pickerDocRef?: ?DocumentRef,
  /** Fixed height (the editor fills its container otherwise). */
  height?: number,
|};

/** Keep the names of the website (elements, variables, pages) known by the autocompletion. */
export const useProjectTypings = () => {
  const { project } = useWebsiteEditor();
  const typings = React.useMemo(() => generateProjectTypings(project), [project]);
  React.useEffect(
    () => {
      setProjectTypings(typings);
    },
    [typings]
  );
};

const CodeEditorPanel = ({ value, onChange, language, problems, toolbar, isSnippet, pickerDocRef, height }: Props) => {
  const { project } = useWebsiteEditor();
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  useProjectTypings();

  // Show the problems as markers in the editor.
  React.useEffect(
    () => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco || !editor.getModel()) return;
      monaco.editor.setModelMarkers(
        editor.getModel(),
        'webvelop',
        (problems || [])
          .filter(problem => problem.line)
          .map(problem => ({
            startLineNumber: problem.line || 1,
            startColumn: problem.column || 1,
            endLineNumber: problem.line || 1,
            endColumn: (problem.column || 1) + 1000,
            message: problem.message,
            severity: monaco.MarkerSeverity.Error,
          }))
      );
    },
    [problems]
  );

  const format = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const action = editor.getAction('editor.action.formatDocument');
    if (action) action.run();
  };

  const insertText = (text: string) => {
    const editor = editorRef.current;
    if (!editor) {
      onChange(value + (value.endsWith('\n') || !value ? '' : '\n') + text);
      return;
    }
    const selection = editor.getSelection();
    editor.executeEdits('insert-element', [{ range: selection, text, forceMoveMarkers: true }]);
    editor.focus();
  };

  const canInsertElements = language === 'javascript' || language === 'css';

  return (
    <div className="wve-code-main" style={height ? { height, flex: 'none', width: '100%' } : undefined}>
      <div className="wve-toolbar">
        {toolbar}
        <span style={{ flex: 1 }} />
        {problems && problems.length === 0 && <span className="wve-status-ok wve-small">✔ No problem found</span>}
        {canInsertElements && (
          <button
            className="wve-small-button"
            title={
              language === 'css'
                ? 'Pick an element on the page and insert its CSS selector'
                : "Pick an element on the page and insert Webvelop.$('...') to control it"
            }
            onClick={() => setPickerOpen(true)}
          >
            ⌖ Insert element
          </button>
        )}
        <button className="wve-small-button" title="Format the code (Shift+Alt+F)" onClick={format}>
          Format
        </button>
      </div>
      <div className="wve-code-editor-container">
        <CodeEditor
          value={value}
          onChange={onChange}
          language={language}
          suppressedDiagnosticsMessages={isSnippet ? snippetSuppressedDiagnostics : undefined}
          onEditorReady={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
          }}
        />
      </div>
      {problems && problems.length > 0 && (
        <div className="wve-problems">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="wve-problem wve-error"
              onClick={() => {
                const editor = editorRef.current;
                if (editor && problem.line) {
                  editor.revealLineInCenter(problem.line);
                  editor.setPosition({ lineNumber: problem.line, column: problem.column || 1 });
                  editor.focus();
                }
              }}
            >
              <span>{problem.line ? `Line ${problem.line}` : 'Error'}</span>
              <span>{problem.message}</span>
            </div>
          ))}
        </div>
      )}
      {pickerOpen && (
        <ElementPickerDialog
          title={language === 'css' ? 'Pick an element to style' : 'Pick an element to control in the code'}
          initialDocRef={pickerDocRef}
          onClose={() => setPickerOpen(false)}
          onPick={picked => {
            setPickerOpen(false);
            const text = getElementCodeReference(project, picked, language === 'css' ? 'css' : 'javascript');
            // Insert once the picker is closed, so that focusing the editor does not fight with the dialog.
            setTimeout(() => insertText(text), 50);
          }}
        />
      )}
    </div>
  );
};

export default CodeEditorPanel;
