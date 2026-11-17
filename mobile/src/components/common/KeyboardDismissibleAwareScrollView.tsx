import React, { memo } from 'react';
import KeyboardScroll from '../ui/KeyboardScroll';

// Kept for its callers (ContractScreen, Form): the kit's KeyboardScroll, which also closes the keyboard on a drag.
function KeyboardDismissibleAwareScrollView({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <KeyboardScroll>{children}</KeyboardScroll>;
}
export default memo(KeyboardDismissibleAwareScrollView);
