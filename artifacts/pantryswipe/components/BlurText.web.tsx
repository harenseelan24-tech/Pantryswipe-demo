import React, { useEffect } from "react";

let styleInjected = false;

function injectStyle() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes blurTextInTop {
      0%   { filter: blur(10px); opacity: 0; transform: translateY(-22px); }
      55%  { filter: blur(3px);  opacity: 0.7; transform: translateY(4px);  }
      100% { filter: blur(0px);  opacity: 1;   transform: translateY(0);    }
    }
    @keyframes blurTextInBottom {
      0%   { filter: blur(10px); opacity: 0; transform: translateY(22px);  }
      55%  { filter: blur(3px);  opacity: 0.7; transform: translateY(-4px); }
      100% { filter: blur(0px);  opacity: 1;   transform: translateY(0);    }
    }
  `;
  document.head.appendChild(el);
}

interface BlurTextProps {
  text: string;
  delay?: number;
  direction?: "top" | "bottom";
  style?: object;
  containerStyle?: object;
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
  useEffect(() => {
    injectStyle();
  }, []);

  const words = text.split(" ");
  const keyframeName = direction === "top" ? "blurTextInTop" : "blurTextInBottom";
  const stepDuration = 0.42;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap" as const,
        ...(containerStyle as React.CSSProperties),
      }}
    >
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            willChange: "transform, filter, opacity",
            opacity: 0,
            animation: `${keyframeName} ${stepDuration}s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            animationDelay: `${(i * delay) / 1000}s`,
            ...(i < words.length - 1 ? { marginRight: "0.28em" } : {}),
            ...(style as React.CSSProperties),
          }}
          onAnimationEnd={
            i === words.length - 1 ? onAnimationComplete : undefined
          }
        >
          {word}
        </span>
      ))}
    </div>
  );
}
