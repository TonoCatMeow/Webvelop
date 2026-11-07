// @flow
import {
  getHistoryInitialState,
  saveToHistory,
  undo,
  redo,
  canUndo,
  canRedo,
} from './History';

describe('History', () => {
  it('can undo and redo changes of immutable values', () => {
    const v1 = { name: 'a' };
    const v2 = { name: 'b' };
    const v3 = { name: 'c' };
    let history = getHistoryInitialState(v1, { historyMaxSize: 50 });
    expect(canUndo(history)).toBe(false);
    history = saveToHistory(history, v2, 'EDIT');
    history = saveToHistory(history, v3, 'EDIT');
    expect(history.currentValue).toBe(v3);
    history = undo(history);
    expect(history.currentValue).toBe(v2);
    expect(canRedo(history)).toBe(true);
    history = undo(history);
    expect(history.currentValue).toBe(v1);
    expect(canUndo(history)).toBe(false);
    history = redo(history);
    expect(history.currentValue).toBe(v2);
    history = saveToHistory(history, v3, 'EDIT');
    expect(canRedo(history)).toBe(false);
  });

  it('merges quick changes having the same merge key', () => {
    const v1 = { text: '' };
    let history = getHistoryInitialState(v1, { historyMaxSize: 50 });
    history = saveToHistory(history, { text: 'H' }, 'EDIT', null, 'typing');
    history = saveToHistory(history, { text: 'He' }, 'EDIT', null, 'typing');
    history = saveToHistory(history, { text: 'Hey' }, 'EDIT', null, 'typing');
    expect(history.previousActions.length).toBe(1);
    history = undo(history);
    expect(history.currentValue).toBe(v1);
  });

  it('limits the history size', () => {
    let history = getHistoryInitialState({ i: 0 }, { historyMaxSize: 3 });
    for (let i = 1; i <= 10; i++) history = saveToHistory(history, { i }, 'EDIT');
    expect(history.previousActions.length).toBe(3);
  });
});
