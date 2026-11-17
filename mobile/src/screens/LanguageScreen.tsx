import { ScrollView } from 'react-native';
import { availableLangs } from '../i18n';
import { useLang, useSetLang } from '../store/hooks';
import TranslatableText from '../components/common/TranslatableText';
import Icon from '../components/ui/Icon';
import ListGroup from '../components/ui/ListGroup';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { useColors } from '../store/ThemeContext';

// The app's language on this phone (saved on the phone, not the account).
export default function LanguageScreen(): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const setLang = useSetLang();

  return (
    <Screen>
      <ScrollView>
        <ListGroup>
          {(Object.keys(availableLangs) as (keyof typeof availableLangs)[]).map(lang => <ListRow
            key={lang}
            title={<TranslatableText data={'lang:' + lang} className='text-body text-ink' />}
            meta={lang === selectedLang ? <Icon name='check' size={22} color={COLORS.primary} /> : undefined}
            onPress={() => setLang(lang)}
            chevron={false}
          />)}
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}
