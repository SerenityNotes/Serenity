import React from "react";
import Svg, { Path } from "react-native-svg";

export type Props = { color: string; size: number };

export const SerenityFeather = ({ color, size }: Props) => {
  return (
    <Svg height={size} width={size} viewBox="0 0 16 16">
      <Path fill="none" d="M0 0h16v16H0z" />
      <Path
        fill={color}
        d="M10.45 2C10.391 2.12249 10.3222 2.24011 10.2442 2.35174C10.2424 2.35447 10.2398 2.3581 10.237 2.36184C10.0701 2.61089 9.82868 2.80198 9.54661 2.90833C9.52479 2.91731 9.50308 2.92448 9.48045 2.93175C9.47678 2.93256 9.4723 2.93437 9.46863 2.93528C9.19719 3.0059 8.91538 3.029 8.63592 3.00353C8.59698 3.00171 8.55896 2.99899 8.52002 2.99626C8.47649 2.99273 8.43297 2.99 8.38954 2.98616C8.36141 2.98435 8.33338 2.98162 8.30433 2.9798C8.26814 2.97718 8.23297 2.97536 8.19648 2.97264C8.14123 2.9691 8.08507 2.96638 8.02982 2.96375C7.77825 2.94371 7.52508 2.96493 7.28049 3.02655C6.90079 3.13508 6.55105 3.39535 6.26655 3.97778L6.24259 4.02543L4.11644 8.38675C4.03627 8.55124 3.99646 8.73216 4.00025 8.91478C4.00404 9.09739 4.05132 9.27654 4.13825 9.43763L4.89389 10.8753C4.98539 11.0493 5.03445 11.2421 5.03712 11.4383C5.03979 11.6345 4.99601 11.8286 4.90929 12.005L4.06486 13.7263C4.05051 13.7556 4.04401 13.7882 4.046 13.8208C4.04799 13.8534 4.05839 13.8849 4.07621 13.9124C4.09403 13.9399 4.11867 13.9623 4.14778 13.9777C4.17688 13.993 4.20947 14.0007 4.24243 14L4.93375 13.9856C5.03202 13.9835 5.12779 13.9546 5.21052 13.902C5.29325 13.8494 5.35974 13.7753 5.40265 13.6877L5.969 12.5292C6.05504 12.3536 6.18116 12.2002 6.33737 12.0812C6.49359 11.9622 6.67563 11.8808 6.86908 11.8435L8.5082 11.5294C8.68546 11.4934 8.85197 11.4174 8.99481 11.3074C9.13764 11.1973 9.25296 11.0562 9.33183 10.8949L9.87147 9.78856C9.8788 9.77364 9.8818 9.75699 9.88015 9.74048C9.87849 9.72397 9.87225 9.70823 9.86211 9.69502C9.85197 9.68181 9.83834 9.67164 9.82271 9.66564C9.80709 9.65965 9.79009 9.65806 9.77362 9.66105L7.2596 10.1348C7.24531 10.1375 7.23056 10.1362 7.21698 10.131C7.20341 10.1259 7.19155 10.1171 7.18272 10.1056C7.17389 10.0942 7.16845 10.0806 7.16699 10.0662C7.16554 10.0519 7.16813 10.0375 7.17448 10.0245L7.31943 9.72839C7.40454 9.55384 7.53021 9.40176 7.68614 9.28462C7.84206 9.16748 8.02381 9.08861 8.21646 9.05449L10.0132 8.73677C10.1387 8.71468 10.2572 8.66337 10.3588 8.58707C10.4604 8.51078 10.5423 8.41167 10.5977 8.29791L11.5553 6.33355C12.3799 4.64643 12.0835 2.78344 10.45 2Z"
      />
    </Svg>
  );
};
