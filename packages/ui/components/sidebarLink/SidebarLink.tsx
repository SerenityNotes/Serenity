import * as React from "react";
import { Platform, Pressable } from "react-native";
import { tw } from "../../tailwind";
import { useLinkProps } from "@react-navigation/native";
import type { NavigationAction } from "@react-navigation/core";
import { GestureResponderEvent, TextProps, StyleSheet } from "react-native";
import { To } from "@react-navigation/native/lib/typescript/src/useLinkTo";
import { useFocusRing } from "@react-native-aria/focus";
import { HStack } from "native-base";
import { useIsDesktopDevice } from "../../hooks/useIsDesktopDevice/useIsDesktopDevice";
import { SidebarIconNavRight } from "../sidebarIconNavRight/SidebarIconNavRight";
import { IconNames } from "../icon/Icon";
import { SidebarText } from "../sidebarText/SidebarText";
import { SidebarIconLeft } from "../sidebarIconLeft/SidebarIconLeft";

// copied from react-navigation type definitions
declare type SidebarLinkProps<ParamList extends ReactNavigation.RootParamList> =
  {
    to: To<ParamList>;
    action?: NavigationAction;
    target?: string;
    onPress?: (
      e: React.MouseEvent<HTMLAnchorElement, MouseEvent> | GestureResponderEvent
    ) => void;
  } & (TextProps & {
    children: React.ReactNode;
    icon: IconNames;
  });

export function SidebarLink<ParamList extends ReactNavigation.RootParamList>(
  props: SidebarLinkProps<ParamList>
) {
  const isDesktopDevice = useIsDesktopDevice();
  const [isHovered, setIsHovered] = React.useState(false);
  const { isFocusVisible, focusProps: focusRingProps }: any = useFocusRing();
  const linkProps = useLinkProps({
    ...props,
  });
  const { icon } = props;

  const styles = StyleSheet.create({
    link: tw.style(Platform.OS === "web" && { outlineWidth: 0 }),
    stack: tw.style(`flex px-5 md:px-4 py-3 md:py-1.5`), // flex needed for correct height calculation
    hover: tw`bg-gray-200`,
    focusVisible: Platform.OS === "web" ? tw`se-inset-focus-mini` : {},
  });

  return (
    <Pressable
      {...linkProps}
      {...props}
      {...focusRingProps} // sets onFocus and onBlur
      onPress={(event) => {
        if (props.onPress) {
          props.onPress(event);
        }
        linkProps.onPress(event);
      }}
      style={[
        styles.link,
        isHovered && styles.hover,
        isFocusVisible && styles.focusVisible,
      ]}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <HStack space={2} alignItems="center" style={[styles.stack, props.style]}>
        {icon ? <SidebarIconLeft name={icon} /> : null}
        <SidebarText>{props.children}</SidebarText>
        {!isDesktopDevice ? <SidebarIconNavRight /> : null}
      </HStack>
    </Pressable>
  );
}
