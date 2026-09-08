declare module "react-native" {
  import * as React from "react";

  export interface StyleProp<T> {
    [key: string]: any;
  }

  export interface ViewStyle {
    [key: string]: any;
  }

  export interface TextStyle {
    [key: string]: any;
  }

  export interface ViewProps {
    style?: any;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TextProps {
    style?: any;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TouchableOpacityProps {
    style?: any;
    onPress?: () => void;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface ScrollViewProps {
    style?: any;
    contentContainerStyle?: any;
    horizontal?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TextInputProps {
    placeholder?: string;
    placeholderTextColor?: string;
    style?: any;
    value?: string;
    onChangeText?: (text: string) => void;
    [key: string]: any;
  }

  export interface StatusBarProps {
    barStyle?: "default" | "light-content" | "dark-content";
    backgroundColor?: string;
    [key: string]: any;
  }

  export const View: React.FC<ViewProps>;
  export const Text: React.FC<TextProps>;
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const ScrollView: React.FC<ScrollViewProps>;
  export const TextInput: React.FC<TextInputProps>;
  export const SafeAreaView: React.FC<ViewProps>;
  export const StatusBar: React.FC<StatusBarProps>;

  export namespace StyleSheet {
    export function create<T extends Record<string, any>>(styles: T): T;
  }
}
