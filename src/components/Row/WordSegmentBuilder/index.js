import ForceWidthWord from "./ForceWidthWord";
import TwoColorWord from "./TwoColorWord";
import ColorSpan from "./ColorSpan";

export class WordSegmentBuilder {
  constructor(key, colorState) {
    this.key = key;
    this.colorState = colorState;
    this.inner = [];
  }

  isLastSegmentSameColor(color) {
    return this.colorState.equals(color);
  }

  appendNormalText(text, isDBCS = false) {
    const last = this.inner[this.inner.length - 1];
    if (isDBCS) {
      if (typeof last === "string") {
        this.inner[this.inner.length - 1] = last + text;
      } else {
        this.inner.push(text);
      }
    } else {
      if (
        last &&
        typeof last === "object" &&
        last.type === "span" &&
        last.props?.className === "term-ascii"
      ) {
        this.inner[this.inner.length - 1] = (
          <span key={last.key} className="term-ascii">
            {last.props.children + text}
          </span>
        );
      } else {
        this.inner.push(
          <span key={this.inner.length} className="term-ascii">
            {text}
          </span>
        );
      }
    }
  }

  appendForceWidthWord(text, forceWidth, cols = 2) {
    this.inner.push(
      <ForceWidthWord
        key={this.inner.length}
        inner={text}
        forceWidth={forceWidth}
        cols={cols}
      />
    );
  }

  build() {
    return (
      <ColorSpan
        key={this.key}
        colorState={this.colorState}
        inner={this.inner}
      />
    );
  }
}

export class TwoColorWordBuilder extends WordSegmentBuilder {
  constructor(key, colorState, colorTail, forceWidth) {
    super(key, colorState);
    this.colorTail = colorTail;
    this.forceWidth = forceWidth;
  }

  isLastSegmentSameColor(color) {
    return false; // forbid appending
  }

  appendNormalText(text) {
    const last = this.inner[this.inner.length - 1];
    if (typeof last === "string") {
      this.inner[this.inner.length - 1] = last + text;
    } else {
      this.inner.push(text);
    }
  }

  build() {
    return (
      <TwoColorWord
        key={this.key}
        colorLead={this.colorState}
        colorTail={this.colorTail}
        forceWidth={this.forceWidth}
        text={this.inner}
      />
    );
  }
}

WordSegmentBuilder.NullObject = {
  isLastSegmentSameColor() {
    return false;
  },

  build() {
    return false;
  }
};

export default WordSegmentBuilder;
