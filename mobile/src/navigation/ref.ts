import { createNavigationContainerRef, ParamListBase } from '@react-navigation/native';

// For what runs outside a screen: a tapped push notification opens its screen through it.
export const navigationRef = createNavigationContainerRef<ParamListBase>();
