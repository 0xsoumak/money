import { fonts, type as typeScale } from "@money/shared";
import { Text, type TextProps, type TextStyle } from "react-native";
import { c } from "../lib/theme";

type Variant = keyof typeof typeScale;
type Weight = keyof typeof fonts.nativeFamily;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  /** Override the size from the scale (line height and tracking follow). */
  size?: number;
  /** Shrink to fit one line. For big money figures that could overflow. */
  fit?: boolean;
}

/** Text in Space Grotesk using the shared type scale. Numbers always use tabular figures. */
export function T({ variant = "body", color, size, fit, style, ...rest }: Props) {
  const t = typeScale[variant];
  const px = size ?? t.size;
  const base: TextStyle = {
    fontFamily: fonts.nativeFamily[t.weight as Weight],
    fontSize: px,
    lineHeight: Math.round(px * t.lineHeight),
    letterSpacing: t.tracking * px,
    color: color ?? c.text,
    fontVariant: ["tabular-nums"],
    ...("uppercase" in t && t.uppercase ? { textTransform: "uppercase" as const } : {}),
  };
  return (
    <Text
      {...(fit ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.5 } : {})}
      {...rest}
      style={[base, style]}
    />
  );
}

/** Small uppercase section label in the muted color. */
export function Label({ children, ...rest }: TextProps) {
  return (
    <T variant="label" color={c.textMuted} {...rest}>
      {children}
    </T>
  );
}
