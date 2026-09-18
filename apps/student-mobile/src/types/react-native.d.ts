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

  export interface ModalProps {
    visible?: boolean;
    animationType?: "none" | "slide" | "fade";
    transparent?: boolean;
    onRequestClose?: () => void;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface ActivityIndicatorProps {
    size?: "small" | "large" | number;
    color?: string;
    [key: string]: any;
  }

  export interface RefreshControlProps {
    refreshing: boolean;
    onRefresh?: () => void;
    tintColor?: string;
    colors?: string[];
    [key: string]: any;
  }

  export interface AlertButton {
    text?: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }

  export const View: React.FC<ViewProps>;
  export const Text: React.FC<TextProps>;
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const ScrollView: React.FC<ScrollViewProps>;
  export const TextInput: React.FC<TextInputProps>;
  export const SafeAreaView: React.FC<ViewProps>;
  export const StatusBar: React.FC<StatusBarProps>;
  export const Modal: React.FC<ModalProps>;
  export const ActivityIndicator: React.FC<ActivityIndicatorProps>;
  export const RefreshControl: React.FC<RefreshControlProps>;

  export namespace Alert {
    export function alert(
      title: string,
      message?: string,
      buttons?: AlertButton[],
      options?: any
    ): void;
  }

  export namespace StyleSheet {
    export function create<T extends Record<string, any>>(styles: T): T;
  }
}
