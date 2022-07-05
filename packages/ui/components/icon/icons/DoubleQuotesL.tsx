import React from "react";
import Svg, { Path } from "react-native-svg";

export type Props = { color: string; size: string };

export const DoubleQuotesL = ({ color, size }: Props) => {
  return (
    <Svg height={size} width={size} viewBox="0 0 16 16">
      <Path fill="none" d="M0 0h16v16H0z" />
      <Path
        fill={color}
        d="M3.05533 11.5473C2.36867 10.818 2 10 2 8.674C2 6.34066 3.638 4.24933 6.02 3.21533L6.61533 4.134C4.392 5.33667 3.95733 6.89733 3.784 7.88133C4.142 7.696 4.61067 7.63133 5.07 7.674C6.27267 7.78533 7.22067 8.77266 7.22067 10C7.22067 10.6188 6.97483 11.2123 6.53725 11.6499C6.09966 12.0875 5.50617 12.3333 4.88733 12.3333C4.172 12.3333 3.488 12.0067 3.05533 11.5473ZM9.722 11.5473C9.03533 10.818 8.66667 10 8.66667 8.674C8.66667 6.34066 10.3047 4.24933 12.6867 3.21533L13.282 4.134C11.0587 5.33667 10.624 6.89733 10.4507 7.88133C10.8087 7.696 11.2773 7.63133 11.7367 7.674C12.9393 7.78533 13.8873 8.77266 13.8873 10C13.8873 10.6188 13.6415 11.2123 13.2039 11.6499C12.7663 12.0875 12.1728 12.3333 11.554 12.3333C10.8387 12.3333 10.1547 12.0067 9.722 11.5473Z"
      />
    </Svg>
  );
};
