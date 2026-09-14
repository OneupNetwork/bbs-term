export const forceWidthStyle = (forceWidth, cols = 2) =>
  typeof forceWidth === "number"
    ? {
        display: "inline-block",
        width:
          cols === 1
            ? `var(--term-chw, ${forceWidth}px)`
            : `calc(var(--term-chw, ${forceWidth / 2}px) * 2)`,
      }
    : undefined;

export const ForceWidthWord = ({ forceWidth, cols = 2, inner }) => (
  <span className="wpadding" style={forceWidthStyle(forceWidth, cols)}>
    {inner}
  </span>
);

export default ForceWidthWord;

