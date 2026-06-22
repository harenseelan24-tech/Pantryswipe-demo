import { Platform, ScrollView, ScrollViewProps } from "react-native";

let KeyboardAwareScrollView: any = null;
try {
  KeyboardAwareScrollView = require("react-native-keyboard-controller").KeyboardAwareScrollView;
} catch {
  // react-native-keyboard-controller not available in Expo Go
}

type Props = ScrollViewProps & { [key: string]: any };

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web" || !KeyboardAwareScrollView) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
