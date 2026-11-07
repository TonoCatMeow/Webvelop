// @flow
// Tools to keep track of the history of changes made on an immutable value
// (the website project), to support undo and redo.
//
// Values are never mutated: each change produces a new value, sharing the
// unchanged parts with the previous one, so keeping snapshots is cheap.
//
// There are 3 main types of changes:
// - ADD: something didn't exist before, and is now created
// - DELETE: something existed before, and is now removed
// - EDIT: something exists before and after (moved, renamed, restyled, ...)
export type RevertableActionType = 'ADD' | 'DELETE' | 'EDIT';

export type UndoAction = {|
  type?: RevertableActionType,
  valueBeforeChange: any,
  changeContext: any,
  /** Changes with the same merge key, done in a short time, are merged into one. */
  mergeKey?: ?string,
  time: number,
|};

export type RedoAction = {|
  type?: RevertableActionType,
  valueAfterChange: any,
  changeContext: any,
|};

export type HistoryState = {|
  previousActions: Array<UndoAction>,
  currentValue: any,
  futureActions: Array<RedoAction>,
  maxSize: number,
|};

const MERGE_DELAY_MS = 1200;

/**
 * Return the initial state of the history.
 */
export const getHistoryInitialState = (
  value: any,
  { historyMaxSize }: { historyMaxSize: number }
): HistoryState => ({
  previousActions: [],
  currentValue: value,
  futureActions: [],
  maxSize: historyMaxSize,
});

/**
 * Return true if redo can be applied for the given history
 */
export const canRedo = (history: HistoryState): boolean =>
  !!history.futureActions.length;

/**
 * Return true if undo can be applied for the given history
 */
export const canUndo = (history: HistoryState): boolean =>
  !!history.previousActions.length;

/**
 * Save a new value to the history.
 */
export const saveToHistory = (
  history: HistoryState,
  newValue: any,
  actionType?: RevertableActionType,
  changeContext?: any,
  mergeKey?: ?string
): HistoryState => {
  if (newValue === history.currentValue) return history;
  const now = Date.now();
  const lastAction = history.previousActions[history.previousActions.length - 1];
  if (
    mergeKey &&
    lastAction &&
    lastAction.mergeKey === mergeKey &&
    now - lastAction.time < MERGE_DELAY_MS
  ) {
    // Merge with the last change (typing in a field, dragging...): keep the
    // value from before the first change.
    return {
      ...history,
      currentValue: newValue,
      previousActions: [
        ...history.previousActions.slice(0, -1),
        { ...lastAction, time: now },
      ],
      futureActions: [],
    };
  }

  const newPreviousActions = [
    ...history.previousActions,
    {
      type: actionType,
      valueBeforeChange: history.currentValue,
      changeContext,
      mergeKey: mergeKey || null,
      time: now,
    },
  ];
  // If we reach the max size, remove the oldest action.
  if (newPreviousActions.length > history.maxSize) {
    newPreviousActions.splice(0, newPreviousActions.length - history.maxSize);
  }

  return {
    ...history,
    currentValue: newValue,
    previousActions: newPreviousActions,
    futureActions: [], // Empty the future actions on save.
  };
};

/**
 * Undo the last change. The value to use is `history.currentValue`.
 */
export const undo = (history: HistoryState): HistoryState => {
  if (!history.previousActions.length) return history;
  const previousAction =
    history.previousActions[history.previousActions.length - 1];
  return {
    ...history,
    previousActions: history.previousActions.slice(0, -1),
    futureActions: [
      ...history.futureActions,
      {
        type: previousAction.type,
        changeContext: previousAction.changeContext,
        valueAfterChange: history.currentValue,
      },
    ],
    currentValue: previousAction.valueBeforeChange,
  };
};

/**
 * Redo the last undone change. The value to use is `history.currentValue`.
 */
export const redo = (history: HistoryState): HistoryState => {
  if (!history.futureActions.length) return history;
  const futureAction = history.futureActions[history.futureActions.length - 1];
  return {
    ...history,
    previousActions: [
      ...history.previousActions,
      {
        type: futureAction.type,
        changeContext: futureAction.changeContext,
        valueBeforeChange: history.currentValue,
        mergeKey: null,
        time: Date.now(),
      },
    ],
    futureActions: history.futureActions.slice(0, -1),
    currentValue: futureAction.valueAfterChange,
  };
};

/** The context of the last change that can be undone (to restore the selection, for example). */
export const getUndoChangeContext = (history: HistoryState): any => {
  const last = history.previousActions[history.previousActions.length - 1];
  return last ? last.changeContext : null;
};
