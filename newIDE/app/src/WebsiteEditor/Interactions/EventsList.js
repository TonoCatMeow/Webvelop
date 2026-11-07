// @flow
// List of interactions ("events") of a page, a component or the whole website.
// Each interaction is: When <trigger> / If <conditions> / Do <actions> / Otherwise <actions>.
import * as React from 'react';
import {
  type InteractionEvent,
  type InteractionAction,
  type InteractionCondition,
  type WebsiteElement,
} from '../../Website/Model/Schema';
import {
  getTrigger,
  getCondition,
  getAction,
} from '../../Website/Interactions/InteractionsRegistry';
import { makeEvent } from '../../Website/Interactions/EventFactory';
import { newId } from '../../Website/Model/Ids';
import { renderSentence, describeElement } from './InteractionParams';
import InstructionEditorDialog, { type InstructionKind, type InstructionValue } from './InstructionEditorDialog';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import RaisedButton from '../../UI/RaisedButton';
import Add from '../../UI/CustomSvgIcons/Add';
import Trash from '../../UI/CustomSvgIcons/Trash';
import Copy from '../../UI/CustomSvgIcons/Copy';
import ArrowTop from '../../UI/CustomSvgIcons/ArrowTop';
import ArrowBottom from '../../UI/CustomSvgIcons/ArrowBottom';
import Visibility from '../../UI/CustomSvgIcons/Visibility';
import VisibilityOff from '../../UI/CustomSvgIcons/VisibilityOff';

type EditingState = {|
  eventId: ?string,
  kind: InstructionKind,
  list: 'conditions' | 'actions' | 'elseActions' | 'trigger',
  index: ?number,
|};

const moveItem = (list: Array<any>, index: number, delta: number) => {
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(newIndex, 0, item);
  return copy;
};

const InstructionRow = ({
  children,
  disabled,
  onClick,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
  className,
}: {|
  children: React.Node,
  disabled?: boolean,
  onClick: () => void,
  onDelete?: () => void,
  onToggle?: () => void,
  onMoveUp?: () => void,
  onMoveDown?: () => void,
  className?: string,
|}) => (
  <div className={`wve-instruction ${disabled ? 'wve-disabled' : ''} ${className || ''}`} onClick={onClick}>
    <span className="wve-instruction-text">{children}</span>
    <span className="wve-row-actions" onClick={e => e.stopPropagation()}>
      {onToggle && (
        <button className="wve-icon-button" title={disabled ? 'Enable' : 'Disable'} onClick={onToggle}>
          {disabled ? <VisibilityOff /> : <Visibility />}
        </button>
      )}
      {onMoveUp && (
        <button className="wve-icon-button" title="Move up" onClick={onMoveUp}>
          <ArrowTop />
        </button>
      )}
      {onMoveDown && (
        <button className="wve-icon-button" title="Move down" onClick={onMoveDown}>
          <ArrowBottom />
        </button>
      )}
      {onDelete && (
        <button className="wve-icon-button" title="Delete" onClick={onDelete}>
          <Trash />
        </button>
      )}
    </span>
  </div>
);

type Props = {|
  events: Array<InteractionEvent>,
  onChange: (events: Array<InteractionEvent>, mergeKey?: string) => void,
  root: ?WebsiteElement,
  /** Only show (and create) the interactions triggered by this element. */
  filterTargetId?: ?string,
  compact?: boolean,
  highlightedEventId?: ?string,
  emptyText?: React.Node,
|};

const EventsList = ({ events, onChange, root, filterTargetId, compact, highlightedEventId, emptyText }: Props) => {
  const { project } = useWebsiteEditor();
  const [editing, setEditing] = React.useState<?EditingState>(null);
  const visibleEvents = filterTargetId
    ? events.filter(event => event.trigger.target === filterTargetId)
    : events;

  const updateEvent = (eventId: string, updater: InteractionEvent => InteractionEvent, mergeKey?: string) =>
    onChange(events.map(event => (event.id === eventId ? updater(event) : event)), mergeKey);

  const editingEvent = editing && editing.eventId ? events.find(event => event.id === editing.eventId) : null;
  const getEditingInitialValue = (): ?InstructionValue => {
    if (!editing) return null;
    if (editing.list === 'trigger') {
      if (!editingEvent) return null;
      return { type: editingEvent.trigger.type, params: editingEvent.trigger.params, target: editingEvent.trigger.target };
    }
    if (!editingEvent || editing.index === null || editing.index === undefined) return null;
    // $FlowFixMe[invalid-computed-prop]
    const instruction = editingEvent[editing.list][editing.index];
    return instruction ? { type: instruction.type, params: instruction.params, negate: instruction.negate } : null;
  };

  const applyEditing = (value: InstructionValue) => {
    if (!editing) return;
    if (editing.list === 'trigger') {
      if (!editing.eventId) {
        const event = makeEvent({
          trigger: value.type,
          target: value.target,
          triggerParams: value.params,
        });
        onChange([...events, event]);
      } else {
        updateEvent(editing.eventId, event => ({
          ...event,
          trigger: { type: value.type, target: value.target || event.trigger.target, params: value.params },
        }));
      }
    } else if (editing.eventId) {
      const listName = editing.list;
      const index = editing.index;
      updateEvent(editing.eventId, event => {
        // $FlowFixMe[invalid-computed-prop]
        const list = [...(event[listName] || [])];
        const instruction = listName === 'conditions'
          ? ({ id: index != null && list[index] ? list[index].id : newId('c'), type: value.type, params: value.params, negate: !!value.negate }: InteractionCondition)
          : ({ id: index != null && list[index] ? list[index].id : newId('a'), type: value.type, params: value.params }: InteractionAction);
        if (index !== null && index !== undefined) list[index] = { ...list[index], ...instruction };
        else list.push(instruction);
        return { ...event, [listName]: list };
      });
    }
    setEditing(null);
  };

  const renderInstructions = (
    event: InteractionEvent,
    listName: 'conditions' | 'actions' | 'elseActions',
    kind: InstructionKind
  ) => {
    // $FlowFixMe[invalid-computed-prop]
    const list: Array<any> = event[listName] || [];
    const setList = (newList: Array<any>) => updateEvent(event.id, e => ({ ...e, [listName]: newList }));
    return (
      <>
        {list.map((instruction, index) => {
          const definition = kind === 'condition' ? getCondition(instruction.type) : getAction(instruction.type, project);
          return (
            <InstructionRow
              key={instruction.id}
              disabled={instruction.disabled}
              onClick={() => setEditing({ eventId: event.id, kind, list: listName, index })}
              onDelete={() => setList(list.filter((_, i) => i !== index))}
              onToggle={kind === 'action' ? () => setList(list.map((item, i) => (i === index ? { ...item, disabled: !item.disabled } : item))) : undefined}
              onMoveUp={index > 0 ? () => setList(moveItem(list, index, -1)) : undefined}
              onMoveDown={index < list.length - 1 ? () => setList(moveItem(list, index, 1)) : undefined}
            >
              {instruction.negate && <strong>NOT </strong>}
              {definition ? (
                renderSentence(project, root, definition.sentence, definition.params, instruction.params)
              ) : (
                <span className="wve-param wve-missing-param">Unknown: {instruction.type}</span>
              )}
            </InstructionRow>
          );
        })}
        <button
          className="wve-add-instruction"
          onClick={() => setEditing({ eventId: event.id, kind, list: listName, index: null })}
        >
          + Add {kind === 'condition' ? 'a condition' : 'an action'}
        </button>
      </>
    );
  };

  return (
    <div className="wve-events">
      {visibleEvents.length === 0 && (
        <div className="wve-empty">
          {emptyText || 'No interaction yet. Interactions make the website react to visitors: clicks, forms, scrolling...'}
        </div>
      )}
      {visibleEvents.map(event => {
        const trigger = getTrigger(event.trigger.type);
        const index = events.indexOf(event);
        return (
          <div
            key={event.id}
            className={`wve-event ${event.disabled ? 'wve-disabled' : ''} ${highlightedEventId === event.id ? 'wve-highlighted' : ''}`}
          >
            <div className="wve-event-header">
              <input
                type="checkbox"
                checked={!event.disabled}
                title={event.disabled ? 'Enable this interaction' : 'Disable this interaction'}
                onChange={e => updateEvent(event.id, ev => ({ ...ev, disabled: !e.target.checked }))}
              />
              <input
                value={event.name || ''}
                placeholder="Describe this interaction..."
                onChange={e => updateEvent(event.id, ev => ({ ...ev, name: e.target.value }), 'event-name-' + event.id)}
                onKeyDown={e => e.stopPropagation()}
              />
              {!filterTargetId && (
                <>
                  <button className="wve-icon-button" title="Move up" disabled={index === 0} onClick={() => onChange(moveItem(events, index, -1))}>
                    <ArrowTop />
                  </button>
                  <button className="wve-icon-button" title="Move down" disabled={index === events.length - 1} onClick={() => onChange(moveItem(events, index, 1))}>
                    <ArrowBottom />
                  </button>
                </>
              )}
              <button
                className="wve-icon-button"
                title="Duplicate"
                onClick={() => {
                  const copy = {
                    ...JSON.parse(JSON.stringify(event)),
                    id: newId('v'),
                  };
                  copy.conditions = copy.conditions.map(c => ({ ...c, id: newId('c') }));
                  copy.actions = copy.actions.map(a => ({ ...a, id: newId('a') }));
                  copy.elseActions = (copy.elseActions || []).map(a => ({ ...a, id: newId('a') }));
                  const newEvents = [...events];
                  newEvents.splice(index + 1, 0, copy);
                  onChange(newEvents);
                }}
              >
                <Copy />
              </button>
              <button className="wve-icon-button" title="Delete this interaction" onClick={() => onChange(events.filter(e => e.id !== event.id))}>
                <Trash />
              </button>
            </div>
            <div className={`wve-event-body ${compact ? 'wve-compact' : ''}`}>
              <div className="wve-event-column">
                <div className="wve-event-keyword">When</div>
                <InstructionRow
                  className="wve-trigger"
                  onClick={() => setEditing({ eventId: event.id, kind: 'trigger', list: 'trigger', index: null })}
                >
                  {trigger ? (
                    renderSentence(project, root, trigger.sentence, trigger.params, event.trigger.params, {
                      target: describeElement(root, event.trigger.target),
                    })
                  ) : (
                    <span className="wve-param wve-missing-param">Unknown trigger: {event.trigger.type}</span>
                  )}
                </InstructionRow>
                <div className="wve-event-keyword">If</div>
                {event.conditions.length === 0 && <div className="wve-small wve-muted" style={{ paddingLeft: 6 }}>Always</div>}
                {renderInstructions(event, 'conditions', 'condition')}
              </div>
              <div className="wve-event-column">
                <div className="wve-event-keyword">Do</div>
                {renderInstructions(event, 'actions', 'action')}
                {event.conditions.length > 0 && (
                  <>
                    <div className="wve-event-keyword">Otherwise</div>
                    {renderInstructions(event, 'elseActions', 'action')}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div>
        <RaisedButton
          primary
          icon={<Add />}
          label="Add an interaction"
          onClick={() =>
            setEditing({ eventId: null, kind: 'trigger', list: 'trigger', index: null })
          }
        />
      </div>
      {editing && (
        <InstructionEditorDialog
          kind={editing.kind}
          initialValue={getEditingInitialValue()}
          root={root}
          fixedTarget={editing.list === 'trigger' && !editing.eventId ? filterTargetId : null}
          onApply={applyEditing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default EventsList;
