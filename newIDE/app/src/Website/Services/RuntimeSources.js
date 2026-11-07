// @flow
// Access to the files written into previewed and exported websites:
// the Webvelop runtime, and React (only loaded when needed).
import runtimeJs from '../Runtime/webvelop-runtime.raw.js';
import runtimeCss from '../Runtime/webvelop-runtime.raw.css';
import { type RuntimeSources } from '../Rendering/SiteBuilder';

let reactSourcesPromise: ?Promise<{| reactJs: string, reactDomJs: string |}> = null;

const loadReactSources = () => {
  if (!reactSourcesPromise) {
    reactSourcesPromise = Promise.all([
      // $FlowFixMe[cannot-resolve-module] - alias defined in config-overrides.js
      import(/* webpackChunkName: "react-umd" */ 'webvelop-react-umd'),
      // $FlowFixMe[cannot-resolve-module] - alias defined in config-overrides.js
      import(/* webpackChunkName: "react-umd" */ 'webvelop-react-dom-umd'),
    ]).then(([react, reactDom]) => ({
      reactJs: react.default || react,
      reactDomJs: reactDom.default || reactDom,
    }));
  }
  return reactSourcesPromise;
};

export const getRuntimeJs = (): string => runtimeJs;
export const getRuntimeCss = (): string => runtimeCss;

export const getRuntimeSources = async (): Promise<RuntimeSources> => {
  const { reactJs, reactDomJs } = await loadReactSources();
  return { runtimeJs, runtimeCss, reactJs, reactDomJs };
};
