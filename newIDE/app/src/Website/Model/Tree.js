// @flow
// Immutable operations on element trees.
// Every function returns a new tree, sharing unchanged branches with the
// previous one, so that the undo/redo history can keep cheap snapshots.
import { newId } from './Ids';
import { type WebsiteElement } from './Schema';

export const walkElements = (
  root: WebsiteElement,
  callback: (element: WebsiteElement, parent: ?WebsiteElement, depth: number) => void | false,
  parent: ?WebsiteElement = null,
  depth: number = 0
): void => {
  if (callback(root, parent, depth) === false) return;
  (root.children || []).forEach(child =>
    walkElements(child, callback, root, depth + 1)
  );
};

export const findElement = (
  root: WebsiteElement,
  id: string
): ?WebsiteElement => {
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const found = findElement(child, id);
    if (found) return found;
  }
  return null;
};

export const findParent = (
  root: WebsiteElement,
  id: string
): ?{| parent: WebsiteElement, index: number |} => {
  const children = root.children || [];
  for (let index = 0; index < children.length; index++) {
    if (children[index].id === id) return { parent: root, index };
    const found = findParent(children[index], id);
    if (found) return found;
  }
  return null;
};

/** Return the list of elements from the root to the element (both included). */
export const getElementPath = (
  root: WebsiteElement,
  id: string
): Array<WebsiteElement> => {
  if (root.id === id) return [root];
  for (const child of root.children || []) {
    const path = getElementPath(child, id);
    if (path.length) return [root, ...path];
  }
  return [];
};

export const isDescendantOf = (
  root: WebsiteElement,
  ancestorId: string,
  id: string
): boolean => {
  const ancestor = findElement(root, ancestorId);
  if (!ancestor) return false;
  return !!findElement(ancestor, id);
};

export const collectElementIds = (root: WebsiteElement): Array<string> => {
  const ids = [];
  walkElements(root, element => {
    ids.push(element.id);
  });
  return ids;
};

/** Apply `updater` to the element with the given id. */
export const updateElement = (
  root: WebsiteElement,
  id: string,
  updater: WebsiteElement => WebsiteElement
): WebsiteElement => {
  if (root.id === id) return updater(root);
  const children = root.children || [];
  let changed = false;
  const newChildren = children.map(child => {
    const newChild = updateElement(child, id, updater);
    if (newChild !== child) changed = true;
    return newChild;
  });
  return changed ? { ...root, children: newChildren } : root;
};

export const removeElement = (
  root: WebsiteElement,
  id: string
): WebsiteElement => {
  const location = findParent(root, id);
  if (!location) return root;
  return updateElement(root, location.parent.id, parent => ({
    ...parent,
    children: parent.children.filter(child => child.id !== id),
  }));
};

export const insertElement = (
  root: WebsiteElement,
  parentId: string,
  index: number,
  element: WebsiteElement
): WebsiteElement =>
  updateElement(root, parentId, parent => {
    const children = [...(parent.children || [])];
    const safeIndex = Math.max(0, Math.min(index, children.length));
    children.splice(safeIndex, 0, element);
    return { ...parent, children };
  });

/**
 * Move an element to a new parent, at the given index (index computed
 * as if the element was still at its old position).
 */
export const moveElement = (
  root: WebsiteElement,
  id: string,
  newParentId: string,
  newIndex: number
): WebsiteElement => {
  if (id === root.id) return root;
  if (id === newParentId || isDescendantOf(root, id, newParentId)) return root;
  const element = findElement(root, id);
  const location = findParent(root, id);
  if (!element || !location) return root;

  let targetIndex = newIndex;
  if (location.parent.id === newParentId && location.index < newIndex) {
    targetIndex--;
  }
  if (location.parent.id === newParentId && location.index === targetIndex) {
    return root;
  }
  const withoutElement = removeElement(root, id);
  return insertElement(withoutElement, newParentId, targetIndex, element);
};

/** Deep clone an element, giving new ids to it and all its descendants. */
export const cloneWithNewIds = (
  element: WebsiteElement,
  idMap: { [oldId: string]: string } = {}
): {| element: WebsiteElement, idMap: { [oldId: string]: string } |} => {
  const cloneRecursively = (current: WebsiteElement): WebsiteElement => {
    const id = newId('e');
    idMap[current.id] = id;
    return {
      ...JSON.parse(JSON.stringify({ ...current, children: [] })),
      id,
      children: (current.children || []).map(cloneRecursively),
    };
  };
  return { element: cloneRecursively(element), idMap };
};

/** Make sure that all ids in a tree are unique, re-generating duplicates. */
export const ensureUniqueIds = (root: WebsiteElement): WebsiteElement => {
  const seen = new Set();
  const fix = (element: WebsiteElement): WebsiteElement => {
    let id = element.id;
    if (!id || seen.has(id)) id = newId('e');
    seen.add(id);
    return { ...element, id, children: (element.children || []).map(fix) };
  };
  return fix(root);
};

export const countElements = (root: WebsiteElement): number => {
  let count = 0;
  walkElements(root, () => {
    count++;
  });
  return count;
};
