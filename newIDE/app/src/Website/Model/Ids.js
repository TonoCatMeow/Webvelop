// @flow
// Identifier helpers for the Webvelop website model.
// Ids are short, url/css-safe and unique enough for a website project.

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

const randomChars = (length: number): string => {
  let result = '';
  const cryptoObject =
    typeof window !== 'undefined' && window.crypto ? window.crypto : null;
  if (cryptoObject && cryptoObject.getRandomValues) {
    const values = new Uint8Array(length);
    cryptoObject.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += alphabet[values[i] % alphabet.length];
    }
    return result;
  }
  for (let i = 0; i < length; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
};

/** Create a new id, prefixed so that ids are valid CSS class names. */
export const newId = (prefix: string = 'e'): string =>
  prefix + randomChars(8);

/** Create a project uuid (v4-like). */
export const newUuid = (): string => {
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) uuid += '-';
    else if (i === 14) uuid += '4';
    else uuid += hex[Math.floor(Math.random() * 16)];
  }
  return uuid;
};

/** Turn any text into a slug usable as a file name / url segment. */
export const slugify = (text: string): string => {
  const slug = (text || '')
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'page';
};

/** Turn any text into a valid JavaScript identifier (PascalCase). */
export const toComponentName = (text: string): string => {
  const words = (text || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  let name = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  if (!name) name = 'Component';
  if (/^[0-9]/.test(name)) name = 'C' + name;
  return name;
};

/** Turn any text into a valid variable name (camelCase). */
export const toVariableName = (text: string): string => {
  const pascal = toComponentName(text);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

/** Return a name not already in `existingNames`, by suffixing a number. */
export const makeUniqueName = (
  baseName: string,
  existingNames: Array<string>,
  separator: string = ' '
): string => {
  const existing = new Set(existingNames.map(name => name.toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) return baseName;
  let index = 2;
  while (existing.has(`${baseName}${separator}${index}`.toLowerCase())) index++;
  return `${baseName}${separator}${index}`;
};
