import React, { useEffect, useRef } from "react";
import { Animated, TextStyle, View, ViewStyle } from "react-native";

interface BlurTextProps {
  text: string;
  delay?: number;
  direction?: "top" | "bottom";
  style?: TextStyle;
  containerStyle?: ViewStyle;
  onAnimationComplete?: () => void;
}

export function BlurText({
  text,
  delay = 150,
  direction = "top",
  style,
  containerStyle,
  onAnimationComplete,
}: BlurTextProps) {
  const words = text.split(" ");
  const anims = useRef(
    words.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(direction === "top" ? -14 : 14),
    }))
  ).current;

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1,
          duration: 380,
          delay: i * delay,
          useNativeDriver: false,
        }),
        Animated.spring(a.translateY, {
          toValue: 0,
          delay: i * delay,
          tension: 90,
          friction: 14,
          useNativeDriver: false,
        }),
      ])
    );
    Animated.parallel(animations).start(() => {
      onAnimationComplete?.();
    });
  }, [text]);

  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap" }, containerStyle]}>
      {words.map((word, i) => (
        <Animated.Text
          key={i}
          style={[
            style,
            {
              opacity: anims[i].opacity,
              transform: [{ translateY: anims[i].translateY }],
            },
          ]}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </Animated.Text>
      ))}
    </View>
  );
}
