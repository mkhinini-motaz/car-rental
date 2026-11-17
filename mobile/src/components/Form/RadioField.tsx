import ChipsField from './ChipsField';

interface RadioFieldProps {
    value: number|null,
    label: string,
    options: { label: string, value: number }[],
    onChange: (newValue: number) => void,
    error?: boolean,
    helperText?: string,
    hint?: string,
}

// A few exclusive choices (the form's radio type): the same pills as ChipsField.
export default function RadioField(props: RadioFieldProps): React.JSX.Element {
    return <ChipsField {...props} />;
}
