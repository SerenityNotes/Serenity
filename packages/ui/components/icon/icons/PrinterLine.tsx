import React from "react";
import Svg, { Path } from "react-native-svg";

export type Props = { color: string; size: number };

export const PrinterLine = ({ color, size }: Props) => {
  return (
    <Svg height={size} width={size} viewBox="0 0 16 16">
      <Path fill="none" d="M0 0h16v16H0z" />
      <Path
        fill={color}
        d="M3.99998 12.6667H1.99998C1.82317 12.6667 1.6536 12.5964 1.52858 12.4714C1.40355 12.3464 1.33331 12.1768 1.33331 12V5.33334C1.33331 5.15653 1.40355 4.98696 1.52858 4.86194C1.6536 4.73692 1.82317 4.66668 1.99998 4.66668H3.99998V2.00001C3.99998 1.8232 4.07022 1.65363 4.19524 1.52861C4.32027 1.40358 4.48984 1.33334 4.66665 1.33334H11.3333C11.5101 1.33334 11.6797 1.40358 11.8047 1.52861C11.9297 1.65363 12 1.8232 12 2.00001V4.66668H14C14.1768 4.66668 14.3464 4.73692 14.4714 4.86194C14.5964 4.98696 14.6666 5.15653 14.6666 5.33334V12C14.6666 12.1768 14.5964 12.3464 14.4714 12.4714C14.3464 12.5964 14.1768 12.6667 14 12.6667H12V14C12 14.1768 11.9297 14.3464 11.8047 14.4714C11.6797 14.5964 11.5101 14.6667 11.3333 14.6667H4.66665C4.48984 14.6667 4.32027 14.5964 4.19524 14.4714C4.07022 14.3464 3.99998 14.1768 3.99998 14V12.6667ZM3.99998 11.3333V10.6667C3.99998 10.4899 4.07022 10.3203 4.19524 10.1953C4.32027 10.0702 4.48984 10 4.66665 10H11.3333C11.5101 10 11.6797 10.0702 11.8047 10.1953C11.9297 10.3203 12 10.4899 12 10.6667V11.3333H13.3333V6.00001H2.66665V11.3333H3.99998ZM5.33331 2.66668V4.66668H10.6666V2.66668H5.33331ZM5.33331 11.3333V13.3333H10.6666V11.3333H5.33331ZM3.33331 6.66668H5.33331V8.00001H3.33331V6.66668Z"
      />
    </Svg>
  );
};
