// @flow
// Dialog to choose and configure a trigger, a condition or an action
// (the website equivalent of the instruction editor of the original editor).
import * as React from 'react';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import { type WebsiteElement } from '../../Website/Model/Schema';
import {
  TRIGGERS,
  CONDITIONS,
  getAllActions,
  getDefaultParams,
  groupDefinitions,
} from '../../Website/Interactions/InteractionsRegistry';
import {
  ParamsForm,
  getElementOptions,
  describeElement,
  renderSentence,
} from './InteractionParams';
import { SelectInput, CheckboxInput, FieldLabel, TextInput } from '../Fields/Fields';
import { useWebsiteEditor } from '../WebsiteEditorContext';

export type InstructionKind = 'trigger' | 'condition' | 'action';

export type InstructionValue = {|
  type: string,
  params: { [string]: any },
  negate?: boolean,
  target?: string,
|};

type Props = {|
  kind: InstructionKind,
  initialValue: ?InstructionValue,
  root: ?WebsiteElement,
  /** For triggers: when set, the target is fixed to this element. */
  fixedTarget?: ?string,
  onApply: (value: InstructionValue) => void,
  onClose: () => void,
|};

const titles = {
  trigger: 'When should this happen?',
  condition: 'Add a condition',
  action: 'Add an action',
};

const InstructionEditorDialog = ({ kind, initialValue, root, fixedTarget, onApply, onClose }: Props) => {
  const { project } = useWebsiteEditor();
  const definitions = kind === 'trigger' ? TRIGGERS : kind === 'condition' ? CONDITIONS : getAllActions(project);
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<string>(
    initialValue ? initialValue.type : fixedTarget || kind !== 'trigger' ? definitions[0].type : 'click'
  );
  const definition = definitions.find(d => d.type === type) || definitions[0];
  const [params, setParams] = React.useState<{ [string]: any }>(
    initialValue ? initialValue.params : getDefaultParams(definition.params)
  );
  const [negate, setNegate] = React.useState<boolean>(!!(initialValue && initialValue.negate));
  const [target, setTarget] = React.useState<string>(
    fixedTarget || (initialValue && initialValue.target) || ''
  );

  const selectType = (newType: string) => {
    const newDefinition = definitions.find(d => d.type === newType);
    if (!newDefinition) return;
    setType(newType);
    // Keep the values of parameters with the same name (like the target).
    const defaults = getDefaultParams(newDefinition.params);
    const kept = {};
    newDefinition.params.forEach(param => {
      kept[param.name] = params[param.name] !== undefined && params[param.name] !== '' ? params[param.name] : defaults[param.name];
    });
    setParams(kept);
  };

  const filtered = definitions.filter(
    d =>
      !search ||
      (d.label + ' ' + d.description + ' ' + d.group).toLowerCase().includes(search.toLowerCase())
  );
  const triggerNeedsTarget = kind === 'trigger' && (definition: any).targetKind === 'element';
  const canApply = !triggerNeedsTarget || !!target;

  const apply = () => {
    if (!canApply) return;
    onApply({
      type: definition.type,
      params,
      negate: kind === 'condition' ? negate : undefined,
      target: kind === 'trigger' ? (triggerNeedsTarget ? target : '$page') : undefined,
    });
  };

  return (
    <Dialog
      open
      title={initialValue ? 'Edit' : titles[kind]}
      maxWidth="md"
      onRequestClose={onClose}
      onApply={apply}
      actions={[
        <FlatButton key="cancel" label="Cancel" onClick={onClose} />,
        <DialogPrimaryButton key="ok" primary label="OK" disabled={!canApply} onClick={apply} />,
      ]}
    >
      <div className="wve-instruction-picker">
        <div className="wve-instruction-list">
          <TextInput value={search} onChange={setSearch} onLiveChange={setSearch} placeholder="Search..." autoFocus />
          {groupDefinitions(filtered).map(group => (
            <React.Fragment key={group.group}>
              <div className="wve-group">{group.group}</div>
              {group.items.map(item => (
                <button
                  key={item.type}
                  className={item.type === type ? 'wve-active' : ''}
                  onClick={() => selectType(item.type)}
                  onDoubleClick={apply}
                  title={item.description}
                >
                  {item.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
        <div className="wve-instruction-params">
          <div>
            <strong style={{ fontSize: 16 }}>{definition.label}</strong>
            <div className="wve-muted" style={{ marginTop: 4 }}>
              {definition.description}
            </div>
          </div>
          {triggerNeedsTarget && !fixedTarget && (
            <div>
              <FieldLabel>Element</FieldLabel>
              <SelectInput
                value={target}
                onChange={setTarget}
                placeholder="Choose an element"
                options={getElementOptions(root, { includeSelf: false })}
              />
            </div>
          )}
          <ParamsForm
            params={definition.params}
            values={params}
            onChange={setParams}
            root={root}
            allowSelf={kind !== 'trigger'}
          />
          {kind === 'condition' && (
            <CheckboxInput checked={negate} onChange={setNegate} label="Invert the condition (true when it is NOT the case)" />
          )}
          <div className="wve-muted" style={{ marginTop: 'auto', paddingTop: 8 }}>
            Preview:{' '}
            {renderSentence(
              project,
              root,
              definition.sentence,
              definition.params,
              params,
              kind === 'trigger'
                ? {
                    target: target
                      ? describeElement(root, target)
                      : { text: 'choose an element', missing: true },
                  }
                : {}
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default InstructionEditorDialog;
