import { Text, TextStyle } from 'react-native';
import { translate } from "../../i18n";
import Translatable from "../../classes/Translatable";
import { useLang } from "../../store/hooks";
import { cssInterop } from 'nativewind';

interface TranslatableTextProps {
  data: string | Translatable;
  params?: any;
  style?: TextStyle|TextStyle[];
  className?: string;
}

function TranslatableText({ data, params = {}, style }: TranslatableTextProps): React.JSX.Element {
  const { selectedLangWriteFrom, selectedLang } = useLang();
  return (
    <Text style={[ {textAlign: selectedLangWriteFrom}, style ]}>{translate(data, selectedLang, params)}</Text>
  );
};

// className becomes `style`, merged after the default textAlign so classes like text-center win.
cssInterop(TranslatableText, { className: 'style' });

export default TranslatableText;
