// @flow
// Editors of the parameters referencing elements: a single element (with a
// "Pick on the page" button), the elements passed to JavaScript code (like
// the objects given to a code event in the original editor), and the code.
import * as React from 'react';
import { type WebsiteElement } from '../../Website/Model/Schema';
import { findElement } from '../../Website/Model/Tree';
import { toVariableName, makeUniqueName } from '../../Website/Model/Ids';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { SelectInput, TextInput } from '../Fields/Fields';
import ElementPickerDialog, { findDocumentRefByRootId } from '../Fields/ElementPickerDialog';
import CodeEditorPanel from '../Code/CodeEditorPanel';

export type CodeElementEntry = {| id: string, as: string |};

export const ElementParamInput = ({
  value,
  onChange,
  root,
  options,
}: {|
  value: string,
  onChange: string => void,
  root: ?WebsiteElement,
  options: Array<{| value: string, label: string |}>,
|}) => {
  const { project } = useWebsiteEditor();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const docRef = findDocumentRefByRootId(project, root ? root.id : null);
  return (
    <div className="wve-row">
      <div className="wve-grow">
        <SelectInput value={value || ''} onChange={onChange} placeholder="Choose an element" options={options} />
      </div>
      {docRef && (
        <button className="wve-small-button" title="Click on the element in a preview of the page" onClick={() => setPickerOpen(true)}>
          ⌖ Pick
        </button>
      )}
      {pickerOpen && (
        <ElementPickerDialog
          initialDocRef={docRef}
          lockDocument
          selectedId={value && !value.startsWith('$') ? value : null}
          onClose={() => setPickerOpen(false)}
          onPick={picked => {
            setPickerOpen(false);
            onChange(picked.id);
          }}
        />
      )}
    </div>
  );
};

export const CodeElementsInput = ({
  value,
  onChange,
  root,
}: {|
  value: Array<CodeElementEntry>,
  onChange: (Array<CodeElementEntry>) => void,
  root: ?WebsiteElement,
|}) => {
  const { project } = useWebsiteEditor();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const entries = Array.isArray(value) ? value : [];
  const docRef = findDocumentRefByRootId(project, root ? root.id : null);
  return (
    <div className="wve-code-elements">
      {entries.length === 0 && (
        <div className="wve-muted wve-small">
          No element yet. elements.self (the element that triggered the interaction) is always available.
        </div>
      )}
      {entries.map((entry, index) => {
        const element = root ? findElement(root, entry.id) : null;
        return (
          <div className="wve-row" key={entry.id + index}>
            <code className="wve-code-element-name">elements.</code>
            <div style={{ width: 130 }}>
              <TextInput
                value={entry.as}
                onChange={as => {
                  const name = toVariableName(as);
                  if (name) onChange(entries.map((e, i) => (i === index ? { ...e, as: name } : e)));
                }}
              />
            </div>
            <span className="wve-grow wve-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {element ? `→ ${element.name}` : '→ missing element'}
            </span>
            <button className="wve-icon-button" title="Remove" onClick={() => onChange(entries.filter((_, i) => i !== index))}>
              ×
            </button>
          </div>
        );
      })}
      <div>
        <button className="wve-small-button" onClick={() => setPickerOpen(true)} disabled={!docRef}>
          ⌖ Add an element (pick it on the page)
        </button>
      </div>
      {pickerOpen && (
        <ElementPickerDialog
          title="Pick an element to use in the code"
          initialDocRef={docRef}
          lockDocument
          onClose={() => setPickerOpen(false)}
          onPick={picked => {
            setPickerOpen(false);
            const as = makeUniqueName(
              toVariableName(picked.name) || 'element',
              ['self', ...entries.map(e => e.as)],
              ''
            );
            onChange([...entries, { id: picked.id, as }]);
          }}
        />
      )}
    </div>
  );
};

export const CodeParamInput = ({
  value,
  onChange,
  root,
}: {|
  value: string,
  onChange: string => void,
  root: ?WebsiteElement,
|}) => {
  const { project } = useWebsiteEditor();
  return (
    <div className="wve-inline-code-editor">
      <CodeEditorPanel
        language="javascript"
        height={260}
        isSnippet
        value={value || ''}
        onChange={onChange}
        pickerDocRef={findDocumentRefByRootId(project, root ? root.id : null)}
        toolbar={<span className="wve-muted wve-small">JavaScript</span>}
      />
    </div>
  );
};
