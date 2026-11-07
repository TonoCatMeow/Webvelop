// @flow
// A dialog asking for a text (window.prompt is not available in the desktop app).
import * as React from 'react';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import TextField from '../../UI/TextField';

export type PromptOptions = {|
  title: string,
  label?: string,
  defaultValue?: string,
  confirmLabel?: string,
  description?: string,
|};

type PromptFunction = (options: PromptOptions) => Promise<?string>;

const PromptContext = React.createContext<PromptFunction>(() => Promise.resolve(null));

export const usePrompt = (): PromptFunction => React.useContext(PromptContext);

export const PromptProvider = ({ children }: {| children: React.Node |}) => {
  const [current, setCurrent] = React.useState<?{|
    options: PromptOptions,
    resolve: (?string) => void,
  |}>(null);
  const [value, setValue] = React.useState('');

  const prompt = React.useCallback(
    (options: PromptOptions) =>
      new Promise(resolve => {
        setValue(options.defaultValue || '');
        setCurrent({ options, resolve });
      }),
    []
  );

  const close = (result: ?string) => {
    if (current) current.resolve(result);
    setCurrent(null);
  };

  return (
    <PromptContext.Provider value={prompt}>
      {children}
      {current && (
        <Dialog
          open
          title={current.options.title}
          maxWidth="sm"
          onRequestClose={() => close(null)}
          onApply={() => close(value.trim() || null)}
          actions={[
            <FlatButton key="cancel" label="Cancel" onClick={() => close(null)} />,
            <DialogPrimaryButton
              key="ok"
              primary
              label={current.options.confirmLabel || 'OK'}
              disabled={!value.trim()}
              onClick={() => close(value.trim() || null)}
            />,
          ]}
        >
          {current.options.description && <p>{current.options.description}</p>}
          <TextField
            autoFocus="desktopAndMobileDevices"
            fullWidth
            autoComplete="off"
            floatingLabelText={current.options.label || ''}
            value={value}
            onChange={(e, newValue) => setValue(newValue)}
          />
        </Dialog>
      )}
    </PromptContext.Provider>
  );
};
