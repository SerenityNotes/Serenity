import React from "react";
import Svg, { Path } from "react-native-svg";

export type Props = { color: string; size: number };

export const ListUnordered = ({ color, size }: Props) => {
  return (
    <Svg height={size} width={size} viewBox="0 0 16 16">
      <Path fill="none" d="M0 0h16v16H0z" />
      <Path
        fill={color}
        d="M5.33333 2.66668H14V4.00001H5.33333V2.66668ZM3 4.33334C2.73478 4.33334 2.48043 4.22799 2.29289 4.04045C2.10536 3.85291 2 3.59856 2 3.33334C2 3.06813 2.10536 2.81377 2.29289 2.62624C2.48043 2.4387 2.73478 2.33334 3 2.33334C3.26522 2.33334 3.51957 2.4387 3.70711 2.62624C3.89464 2.81377 4 3.06813 4 3.33334C4 3.59856 3.89464 3.85291 3.70711 4.04045C3.51957 4.22799 3.26522 4.33334 3 4.33334ZM3 9.00001C2.73478 9.00001 2.48043 8.89465 2.29289 8.70712C2.10536 8.51958 2 8.26523 2 8.00001C2 7.73479 2.10536 7.48044 2.29289 7.2929C2.48043 7.10537 2.73478 7.00001 3 7.00001C3.26522 7.00001 3.51957 7.10537 3.70711 7.2929C3.89464 7.48044 4 7.73479 4 8.00001C4 8.26523 3.89464 8.51958 3.70711 8.70712C3.51957 8.89465 3.26522 9.00001 3 9.00001ZM3 13.6C2.73478 13.6 2.48043 13.4947 2.29289 13.3071C2.10536 13.1196 2 12.8652 2 12.6C2 12.3348 2.10536 12.0804 2.29289 11.8929C2.48043 11.7054 2.73478 11.6 3 11.6C3.26522 11.6 3.51957 11.7054 3.70711 11.8929C3.89464 12.0804 4 12.3348 4 12.6C4 12.8652 3.89464 13.1196 3.70711 13.3071C3.51957 13.4947 3.26522 13.6 3 13.6ZM5.33333 7.33334H14V8.66668H5.33333V7.33334ZM5.33333 12H14V13.3333H5.33333V12Z"
      />
    </Svg>
  );
};
