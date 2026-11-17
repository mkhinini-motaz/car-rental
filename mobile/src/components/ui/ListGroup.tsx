import { Children, Fragment } from 'react';
import { View } from 'react-native';
import TranslatableText from '../common/TranslatableText';

// A titled card of rows separated by hairlines (settings, "more", detail lists).
export default function ListGroup({ title, children }: { title?: string, children: React.ReactNode }): React.JSX.Element {
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View className='mx-3 my-2'>
      {title && <TranslatableText data={title} className='text-meta text-muted font-semibold mb-1.5 mx-1 uppercase' />}
      <View className='bg-surface border border-line rounded-xl overflow-hidden'>
        {rows.map((row, index) =>
          <Fragment key={index}>
            {index > 0 && <View className='h-px bg-line ml-3 mr-3' />}
            {row}
          </Fragment>
        )}
      </View>
    </View>
  );
}
