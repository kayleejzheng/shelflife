// Reusable pop-up form (change email, add recipe, ask your circle, ...)
import { ReactNode, useEffect, useState } from 'react';
import { TextInputProps, View } from 'react-native';
import { colors } from '../lib/theme';
import { Button, Field, Sheet, TextLink, Title } from './ui';

export type PromptField = {
  key: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  hint?: string;
  inputProps?: TextInputProps;
};

export default function PromptModal({
  visible, title, fields, submitLabel = 'Save', onSubmit, onClose, destructiveLabel, onDestructive, children,
}: {
  visible: boolean;
  title: string;
  fields: PromptField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onClose: () => void;
  destructiveLabel?: string;
  onDestructive?: () => void;
  children?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setValues(Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])));
    // reset only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function submit() {
    setBusy(true);
    try {
      await onSubmit(values);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Title size={30}>{title}</Title>
      {children}
      {fields.map((f, i) => (
        <Field
          key={f.key}
          label={f.label}
          hint={f.hint}
          placeholder={f.placeholder}
          value={values[f.key] ?? ''}
          onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
          autoFocus={i === 0}
          {...f.inputProps}
        />
      ))}
      <Button label={busy ? 'Saving...' : submitLabel} onPress={submit} disabled={busy} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextLink label="Cancel" onPress={onClose} color={colors.brownLight} />
        {destructiveLabel && onDestructive ? <TextLink label={destructiveLabel} onPress={onDestructive} color={colors.terra} /> : null}
      </View>
    </Sheet>
  );
}
