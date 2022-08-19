import { HStack } from "native-base";
import React from "react";
import { StyleSheet } from "react-native";
import { tw } from "../../tailwind";
import { View, ViewProps } from "../view/View";

export type DesignSystemExampleAreaProps = ViewProps & {};

export const DesignSystemExampleArea = (
  props: DesignSystemExampleAreaProps
) => {
  const styles = StyleSheet.create({
    area: tw`mt-2.5 p-4 border border-gray-200 rounded overflow-scroll sm:overflow-visible items-start`,
  });

  return (
    <View {...props} style={[styles.area, props.style]}>
      <HStack space={4} alignItems={"center"}>
        {props.children}
      </HStack>
    </View>
  );
};
