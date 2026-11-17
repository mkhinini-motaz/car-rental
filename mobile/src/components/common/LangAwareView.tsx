import React, { memo } from 'react';
import { ViewStyle, View } from 'react-native';
import { useLang } from "../../store/hooks";
import { cssInterop } from 'nativewind';

interface LangAwareViewProps {
  style?: ViewStyle|ViewStyle[],
  direction?: 'row' | 'column',
  className?: string,
  children?: any,
}

function LangAwareView({ style, direction = 'row', children }: LangAwareViewProps): React.JSX.Element {
  const { selectedLangWriteFrom } = useLang();
  return (
    <View style={[{
      flexDirection: (direction + (selectedLangWriteFrom === 'right' ? '-reverse' : '')) as ViewStyle['flexDirection'],
    }, style]}
    >
      {children}
    </View>
  );
};
// Register the exported (memo) type: the jsx runtime looks components up by type.
const MemoLangAwareView = memo(LangAwareView);
cssInterop(MemoLangAwareView, { className: 'style' });

export default MemoLangAwareView;
