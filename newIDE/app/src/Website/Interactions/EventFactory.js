// @flow
// Helpers to create interaction events, conditions and actions.
import { newId } from '../Model/Ids';
import {
  type InteractionEvent,
  type InteractionAction,
  type InteractionCondition,
} from '../Model/Schema';
import {
  getTrigger,
  getCondition,
  getAction,
  getDefaultParams,
} from './InteractionsRegistry';

export const makeAction = (
  type: string,
  params: { [string]: any } = {},
  project?: any
): InteractionAction => {
  const definition = getAction(type, project);
  return {
    id: newId('a'),
    type,
    params: { ...(definition ? getDefaultParams(definition.params) : {}), ...params },
  };
};

export const makeCondition = (
  type: string,
  params: { [string]: any } = {},
  negate: boolean = false
): InteractionCondition => {
  const definition = getCondition(type);
  return {
    id: newId('c'),
    type,
    params: { ...(definition ? getDefaultParams(definition.params) : {}), ...params },
    negate,
  };
};

export const makeEvent = ({
  trigger,
  target,
  triggerParams,
  conditions,
  actions,
  elseActions,
  name,
}: {|
  trigger: string,
  target?: string,
  triggerParams?: { [string]: any },
  conditions?: Array<InteractionCondition>,
  actions?: Array<InteractionAction>,
  elseActions?: Array<InteractionAction>,
  name?: string,
|}): InteractionEvent => {
  const definition = getTrigger(trigger);
  return {
    id: newId('v'),
    name: name || '',
    trigger: {
      type: trigger,
      target: definition && definition.targetKind === 'page' ? '$page' : target || '',
      params: {
        ...(definition ? getDefaultParams(definition.params) : {}),
        ...(triggerParams || {}),
      },
    },
    conditions: conditions || [],
    actions: actions || [],
    elseActions: elseActions || [],
  };
};

/** Deep clone events, giving new ids and remapping the referenced elements. */
export const cloneEventsWithIdMap = (
  events: Array<InteractionEvent>,
  idMap: { [oldId: string]: string }
): Array<InteractionEvent> => {
  const remap = (value: any) =>
    typeof value === 'string' && idMap[value] ? idMap[value] : value;
  const remapParams = (params: { [string]: any }) => {
    const newParams = {};
    Object.keys(params || {}).forEach(key => {
      newParams[key] = remap(params[key]);
    });
    return newParams;
  };
  const remapInstructions = (instructions: Array<any>, prefix: string) =>
    instructions.map(instruction => ({
      ...instruction,
      id: newId(prefix),
      params: remapParams(instruction.params),
    }));
  return events.map(event => ({
    ...event,
    id: newId('v'),
    trigger: {
      ...event.trigger,
      target: remap(event.trigger.target),
      params: remapParams(event.trigger.params),
    },
    conditions: remapInstructions(event.conditions, 'c'),
    actions: remapInstructions(event.actions, 'a'),
    elseActions: remapInstructions(event.elseActions || [], 'a'),
  }));
};

/** Return the ids of the elements referenced by an event. */
export const getEventReferencedElementIds = (event: InteractionEvent): Array<string> => {
  const ids = [];
  if (event.trigger.target) ids.push(event.trigger.target);
  [...event.conditions, ...event.actions, ...(event.elseActions || [])].forEach(
    instruction => {
      if (instruction.params && typeof instruction.params.target === 'string')
        ids.push(instruction.params.target);
    }
  );
  return ids;
};
