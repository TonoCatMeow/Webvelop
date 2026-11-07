// @flow
// Compilation of the React components (JSX) of a website, and validation of
// the JavaScript written by users, so that errors are reported in the editor
// instead of breaking the published website.
import { transform } from 'sucrase';
import { type ReactComponentDefinition } from '../Model/Schema';

export type CodeError = {|
  message: string,
  line: ?number,
  column: ?number,
|};

const parseErrorLocation = (error: any): {| line: ?number, column: ?number |} => {
  if (error && error.loc) return { line: error.loc.line, column: error.loc.column + 1 };
  const match = String((error && error.message) || '').match(/\((\d+):(\d+)\)/);
  if (match) return { line: parseInt(match[1], 10), column: parseInt(match[2], 10) + 1 };
  return { line: null, column: null };
};

export const REACT_HOOKS_PRELUDE =
  'const { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useReducer, useContext, useId, createContext, Fragment, Children, cloneElement } = React;';

/**
 * Prepare the code of a component: React and hooks are provided by the runtime,
 * so imports of "react" are removed, and exports are turned into declarations.
 */
export const preprocessReactCode = (code: string): {| code: string, errors: Array<CodeError> |} => {
  const errors = [];
  const lines = code.split('\n').map((line, index) => {
    const importMatch = line.match(/^\s*import\s.*?from\s+['"]([^'"]+)['"];?\s*$/) ||
      line.match(/^\s*import\s+['"]([^'"]+)['"];?\s*$/);
    if (importMatch) {
      if (importMatch[1] === 'react' || importMatch[1] === 'react-dom') return '';
      errors.push({
        message: `Imports are not supported ("${importMatch[1]}"). React, its hooks and Webvelop are available directly.`,
        line: index + 1,
        column: 1,
      });
      return '';
    }
    return line
      .replace(/^(\s*)export\s+default\s+(function|class)\b/, '$1$2')
      .replace(/^(\s*)export\s+(function|class|const|let|var)\b/, '$1$2')
      .replace(/^\s*export\s+default\s+[\w$]+\s*;?\s*$/, '');
  });
  return { code: lines.join('\n'), errors };
};

const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;

/** Check the syntax of a function body without running it. */
export const checkFunctionSyntax = (
  body: string,
  parameters: Array<string>,
  { isAsync }: {| isAsync: boolean |}
): ?CodeError => {
  try {
    // eslint-disable-next-line no-new-func
    if (isAsync) new AsyncFunction(...parameters, body);
    // eslint-disable-next-line no-new-func
    else new Function(...parameters, body);
    return null;
  } catch (error) {
    const location = parseErrorLocation(error);
    return { message: error.message, line: location.line, column: location.column };
  }
};

export type CompiledReactComponent = {|
  name: string,
  /** JavaScript registering the component in the Webvelop runtime. */
  registrationCode: string,
  errors: Array<CodeError>,
|};

export const compileReactComponent = (
  definition: ReactComponentDefinition
): CompiledReactComponent => {
  const { name } = definition;
  const failure = (errors: Array<CodeError>) => ({
    name,
    errors,
    registrationCode: `Webvelop.registerReactComponent(${JSON.stringify(name)}, function () {
  throw new Error(${JSON.stringify(
    `The React component "${name}" has errors: ` + errors.map(e => e.message).join('; ')
  )});
});`,
  });

  const preprocessed = preprocessReactCode(definition.code || '');
  if (preprocessed.errors.length) return failure(preprocessed.errors);

  let compiled;
  try {
    compiled = transform(preprocessed.code, {
      transforms: ['jsx'],
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
      production: true,
    }).code;
  } catch (error) {
    const location = parseErrorLocation(error);
    return failure([{ message: error.message.replace(/\s*\(\d+:\d+\)$/, ''), ...location }]);
  }

  const body = `${REACT_HOOKS_PRELUDE}
${compiled}
;return typeof ${name} !== 'undefined' ? ${name} : undefined;`;
  const syntaxError = checkFunctionSyntax(body, ['React', 'Webvelop'], { isAsync: false });
  if (syntaxError) return failure([{ ...syntaxError, line: null, column: null }]);
  if (!new RegExp(`(function|class|const|let|var)\\s+${name}\\b`).test(preprocessed.code)) {
    return failure([
      {
        message: `The code must define a component named "${name}" (for example: function ${name}(props) { ... }).`,
        line: null,
        column: null,
      },
    ]);
  }

  return {
    name,
    errors: [],
    registrationCode: `Webvelop.registerReactComponent(${JSON.stringify(name)}, function (React, Webvelop) {
${body}
});`,
  };
};

/** Check the syntax of all the JavaScript of a project (used to show errors in the editor). */
export const getReactComponentErrors = (definition: ReactComponentDefinition): Array<CodeError> =>
  compileReactComponent(definition).errors;
