import React from "react";
import Svg, { Path } from "react-native-svg";

export type Props = { color: string; size: number };

export const Table2 = ({ color, size }: Props) => {
  return (
    <Svg height={size} width={size} viewBox="0 0 16 16">
      <Path fill="none" d="M0 0h16v16H0z" />
      <Path
        fill={color}
        d="M8.66667 6.66667V9.33333H12.6667V6.66667H8.66667ZM7.33333 6.66667H3.33333V9.33333H7.33333V6.66667ZM8.66667 12.6667H12.6667V10.6667H8.66667V12.6667ZM7.33333 12.6667V10.6667H3.33333V12.6667H7.33333ZM8.66667 3.33333V5.33333H12.6667V3.33333H8.66667ZM7.33333 3.33333H3.33333V5.33333H7.33333V3.33333ZM2.66667 2H13.3333C13.5101 2 13.6797 2.07024 13.8047 2.19526C13.9298 2.32029 14 2.48986 14 2.66667V13.3333C14 13.5101 13.9298 13.6797 13.8047 13.8047C13.6797 13.9298 13.5101 14 13.3333 14H2.66667C2.48986 14 2.32029 13.9298 2.19526 13.8047C2.07024 13.6797 2 13.5101 2 13.3333V2.66667C2 2.48986 2.07024 2.32029 2.19526 2.19526C2.32029 2.07024 2.48986 2 2.66667 2V2Z"
      />
    </Svg>
  );
};
