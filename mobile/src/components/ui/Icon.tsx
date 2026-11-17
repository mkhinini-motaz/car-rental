import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

// The app's one icon family (Material Design / community icons). Sizes: 20 in rows, 24 for actions.
export type IconName = React.ComponentProps<typeof MaterialDesignIcons>['name'];

export default function Icon({ name, size = 20, color }: { name: IconName, size?: number, color?: string }): React.JSX.Element {
  return <MaterialDesignIcons name={name} size={size} color={color} />;
}
