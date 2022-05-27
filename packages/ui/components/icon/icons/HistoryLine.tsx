import React from "react";
import Svg, { Path } from "react-native-svg";

export type Props = { color: string; size: number };

export const HistoryLine = ({ color, size }: Props) => {
  return (
    <Svg height={size} width={size} viewBox="0 0 16 16">
      <Path fill="none" d="M0 0h16v16H0z" />
      <Path
        fill={color}
        d="M7.99998 1.33334C11.682 1.33334 14.6666 4.31801 14.6666 8.00001C14.6666 11.682 11.682 14.6667 7.99998 14.6667C4.31798 14.6667 1.33331 11.682 1.33331 8.00001H2.66665C2.66665 10.9453 5.05465 13.3333 7.99998 13.3333C10.9453 13.3333 13.3333 10.9453 13.3333 8.00001C13.3333 5.05468 10.9453 2.66668 7.99998 2.66668C6.16665 2.66668 4.54931 3.59134 3.58998 5.00001H5.33331V6.33334H1.33331V2.33334H2.66665V4.00001C3.88265 2.38001 5.81931 1.33334 7.99998 1.33334ZM8.66665 4.66668V7.72334L10.8286 9.88534L9.88531 10.8287L7.33331 8.27534V4.66668H8.66665Z"
      />
    </Svg>
  );
};
