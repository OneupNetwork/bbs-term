import {
  termColors,
  termDefaultBg,
  termDefaultFg,
  termDefaultLink,
  getContrastColor,
} from "../../js/color_schemes.js";
import {
  SmoothAnsiArt,
  ANSI_BLOCK_SET,
  LOWER_BLOCK_MAP,
  UPPER_BLOCK_MAP,
  hasAnsiArt,
} from "./SmoothAnsiArt.js";
import { CanvasSelection } from "./CanvasSelection.js";

// URL underline color matches DOM mode's URL underline (#ff6600)
const URL_UNDERLINE_COLOR = "#ff6600";

export class CanvasRenderer {
  constructor() {
    this.textBuckets = Array.from({ length: 16 }, () => []);
    this.ansiBlockBuckets = Array.from({ length: 16 }, () => []);
    this.bgBuckets = Array.from({ length: 17 }, () => []);
    this.underlineBuckets = Array.from({ length: 16 }, () => []);
    this.urlUnderlineRuns = [];
    this.textPool = [];
    this.textPoolIndex = 0;
    this.blockPool = [];
    this.blockPoolIndex = 0;
    this.blockGrid = null;
    this.metricsCache = new Map();
    this.lastFontKey = "";
    this.lastAppliedFont = "";
    this.hasBlink = false;
    this.bufferCanvas =
      typeof document !== "undefined" ? document.createElement("canvas") : null;
    this.contentDirty = true;
    this.dirtyRows = null;
    this.hasDrawnBefore = false;
  }

  markDirty(dirtyRows = null) {
    this.contentDirty = true;
    this.dirtyRows = dirtyRows;
  }

  clearFontCache() {
    this.metricsCache.clear();
    this.lastAppliedFont = "";
    this.markDirty();
  }

  getTextItem(text, x0, cellW, devY, isDBCS, clip = null, bgIndex = 0) {
    let item = this.textPool[this.textPoolIndex];
    if (!item) {
      item = { text, x0, cellW, devY, isDBCS, clip, bgIndex };
      this.textPool[this.textPoolIndex] = item;
    } else {
      item.text = text;
      item.x0 = x0;
      item.cellW = cellW;
      item.devY = devY;
      item.isDBCS = isDBCS;
      item.clip = clip;
      item.bgIndex = bgIndex;
    }
    this.textPoolIndex++;
    return item;
  }

  getBlockItem(
    type,
    r,
    c,
    x,
    y,
    w,
    h,
    fgIndex,
    bgIndex = 0,
    clip = null,
    span = 1
  ) {
    let item = this.blockPool[this.blockPoolIndex];
    if (!item) {
      item = { type, r, c, x, y, w, h, fgIndex, bgIndex, clip, span };
      this.blockPool[this.blockPoolIndex] = item;
    } else {
      item.type = type;
      item.r = r;
      item.c = c;
      item.x = x;
      item.y = y;
      item.w = w;
      item.h = h;
      item.fgIndex = fgIndex;
      item.bgIndex = bgIndex;
      item.clip = clip;
      item.span = span;
    }
    this.blockPoolIndex++;
    return item;
  }

  getCharMetrics(ctx, text, isDBCS, targetWidthDev) {
    const key = isDBCS ? text + "\x01" : text;
    let cached = this.metricsCache.get(key);
    if (cached !== undefined) return cached;

    if (this.metricsCache.size > 20000) {
      this.metricsCache.clear();
    }
    const textWidth = ctx.measureText(text).width;
    const scale =
      textWidth > 0 && Math.abs(textWidth - targetWidthDev) > 0.5
        ? targetWidthDev / textWidth
        : 1;
    const result = { scale, textWidth };
    this.metricsCache.set(key, result);
    return result;
  }

  draw(canvas, options) {
    const shouldMeasure =
      typeof options.onRenderFrame === "function" &&
      typeof performance !== "undefined";
    const t0 = shouldMeasure ? performance.now() : 0;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, chw, chh, selStart, selEnd } = options;
    const scaleX = options.scaleX || 1;
    const scaleY = options.scaleY || 1;
    const width = cols * chw;
    const height = rows * chh;
    const cssWidth = width * scaleX;
    const cssHeight = height * scaleY;

    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const targetWidth = Math.round(cssWidth * dpr);
    const targetHeight = Math.round(cssHeight * dpr);
    const effScaleX = width > 0 ? targetWidth / width : dpr * scaleX;
    const effScaleY = height > 0 ? targetHeight / height : dpr * scaleY;

    const canvasResized =
      canvas.width !== targetWidth || canvas.height !== targetHeight;
    if (canvasResized) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      this.contentDirty = true;
    }

    if (!this.bufferCanvas && typeof document !== "undefined") {
      this.bufferCanvas = document.createElement("canvas");
    }

    let bufferResized = false;
    if (this.bufferCanvas) {
      if (
        this.bufferCanvas.width !== targetWidth ||
        this.bufferCanvas.height !== targetHeight
      ) {
        this.bufferCanvas.width = targetWidth;
        this.bufferCanvas.height = targetHeight;
        this.contentDirty = true;
        bufferResized = true;
      }
    }

    const bctx = this.bufferCanvas ? this.bufferCanvas.getContext("2d") : ctx;

    if (canvasResized || bufferResized || !this.hasDrawnBefore) {
      this.dirtyRows = null;
    }

    let dirtyRows = this.dirtyRows;
    if (dirtyRows && dirtyRows.length > 0 && dirtyRows.length <= 6) {
      if (options.smoothAnsiArt && hasAnsiArt(options.lines, dirtyRows)) {
        dirtyRows = null;
      }
    } else {
      dirtyRows = null;
    }

    if (this.contentDirty || !this.bufferCanvas) {
      this.drawContent(
        bctx,
        cols,
        rows,
        chw,
        chh,
        width,
        height,
        dpr,
        bufferResized || canvasResized,
        dirtyRows,
        {
          ...options,
          effScaleX,
          effScaleY,
        }
      );
      this.contentDirty = false;
      this.dirtyRows = null;
      this.hasDrawnBefore = true;
    }

    if (this.bufferCanvas) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.bufferCanvas, 0, 0);
    }
    ctx.setTransform(effScaleX, 0, 0, effScaleY, 0, 0);

    CanvasSelection.drawSelection(ctx, selStart, selEnd, cols, chw, chh, {
      effScaleX,
      effScaleY,
    });

    if (t0 > 0) {
      const durationMs = performance.now() - t0;
      options.onRenderFrame({ durationMs, isCanvas: true });
    }
  }

  drawContent(
    ctx,
    cols,
    rows,
    chw,
    chh,
    width,
    height,
    dpr,
    contextResized,
    dirtyRows,
    options
  ) {
    const effScaleX =
      options?.effScaleX || (options?.scaleX ? options.scaleX * dpr : dpr);
    const effScaleY =
      options?.effScaleY || (options?.scaleY ? options.scaleY * dpr : dpr);
    const colX = (c) => Math.round(c * chw * effScaleX);
    const rowY = (r) => Math.round(r * chh * effScaleY);
    const targetWidth = colX(cols);
    const targetHeight = rowY(rows);

    const fontFace = options.fontFace || "MingLiu, monospace";
    const rawFontSize = options.fontSize || (chw ? chw * 2 : chh);
    const devFontSize =
      chh * effScaleY >= 4
        ? Math.max(2, Math.round((rawFontSize * effScaleY) / 2) * 2)
        : rawFontSize * effScaleY;
    const fontString = `${devFontSize}px ${fontFace}`;
    const fontKey = `${devFontSize}px ${fontFace}:${chw * effScaleX}`;

    if (this.lastFontKey !== fontKey) {
      this.metricsCache.clear();
      this.lastFontKey = fontKey;
    }

    if (contextResized || this.lastAppliedFont !== fontString) {
      ctx.font = fontString;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.lastAppliedFont = fontString;
    }

    const isBlinkHidden =
      typeof document !== "undefined" &&
      document.body.classList.contains("blink--active");

    const currentHl =
      options.currentHighlighted !== undefined
        ? options.currentHighlighted
        : options.nowHighlight !== undefined
          ? options.nowHighlight
          : -1;
    const hlColor =
      termColors[options.highlightBG !== undefined ? options.highlightBG : 2] ||
      "#008000";

    this.textPoolIndex = 0;
    this.blockPoolIndex = 0;

    const textBuckets = this.textBuckets;
    const ansiBlockBuckets = this.ansiBlockBuckets;
    const bgBuckets = this.bgBuckets;
    const underlineBuckets = this.underlineBuckets;
    const urlUnderlineRuns = this.urlUnderlineRuns;
    for (let i = 0; i < 16; ++i) {
      textBuckets[i].length = 0;
      ansiBlockBuckets[i].length = 0;
      underlineBuckets[i].length = 0;
    }
    for (let i = 0; i < 17; ++i) {
      bgBuckets[i].length = 0;
    }
    urlUnderlineRuns.length = 0;

    const smoothAnsiArt = !!options.smoothAnsiArt && !dirtyRows;
    let blockGrid = null;
    if (smoothAnsiArt) {
      if (!this.blockGrid || this.blockGrid.length !== rows * cols) {
        this.blockGrid = new Array(rows * cols).fill(null);
      } else {
        this.blockGrid.fill(null);
      }
      blockGrid = this.blockGrid;
    }

    const lines = options.lines;
    const targetRows = dirtyRows || null;
    const rowCount = targetRows
      ? targetRows.length
      : lines
        ? Math.min(rows, lines.length)
        : 0;

    if (lines) {
      let hasBlink = false;
      const underlineH = Math.max(1, Math.round(effScaleY));

      for (let idx = 0; idx < rowCount; ++idx) {
        const r = targetRows ? targetRows[idx] : idx;
        if (r < 0 || r >= rows || r >= lines.length) continue;
        const line = lines[r];
        if (!line) continue;
        const isLineHighlighted = r === currentHl;
        const y0 = rowY(r);
        const y1 = rowY(r + 1);
        const h = y1 - y0;
        const devDrawY =
          h >= 4
            ? y0 + Math.round((h - devFontSize) / 2) + devFontSize / 2
            : y0 + h / 2;
        const urlUnderlineY =
          y0 + Math.min(h - underlineH, Math.round((h - underlineH) * 0.9));
        const textUnderlineY = y1 - underlineH;

        let runBgIdx = 0;
        let runStartCol = 0;
        let runLength = 0;
        let urlStartCol = -1;

        for (let c = 0; c < cols; ++c) {
          const ch = line[c];
          let bgIdx = ch ? ch.getBg() : 0;
          if (isLineHighlighted && bgIdx === 0) {
            bgIdx = 16;
          }

          if (bgIdx === runBgIdx) {
            runLength++;
          } else {
            if (runBgIdx !== 0) {
              const rx0 = colX(runStartCol);
              const rx1 = colX(runStartCol + runLength);
              bgBuckets[runBgIdx].push(rx0, y0, rx1 - rx0, h);
            }
            runBgIdx = bgIdx;
            runStartCol = c;
            runLength = 1;
          }

          const isUrl = !!(ch && ch.isPartOfURL());
          if (isUrl) {
            if (urlStartCol === -1) {
              urlStartCol = c;
            }
          } else if (urlStartCol !== -1) {
            const ux0 = colX(urlStartCol);
            const ux1 = colX(c);
            urlUnderlineRuns.push(ux0, urlUnderlineY, ux1 - ux0, underlineH);
            urlStartCol = -1;
          }
        }

        if (runBgIdx !== 0) {
          const rx0 = colX(runStartCol);
          const rx1 = colX(runStartCol + runLength);
          bgBuckets[runBgIdx].push(rx0, y0, rx1 - rx0, h);
        }
        if (urlStartCol !== -1) {
          const ux0 = colX(urlStartCol);
          const ux1 = colX(cols);
          urlUnderlineRuns.push(ux0, urlUnderlineY, ux1 - ux0, underlineH);
        }

        for (let c = 0; c < cols; ++c) {
          const ch = line[c];
          if (!ch) continue;

          // Unicode DBCS character: stored in cell c, and trail cell c + 1 has isDBCSTrail
          if (
            c + 1 < cols &&
            line[c + 1] &&
            (line[c + 1].isDBCSTrail || line[c + 1].ch === "") &&
            ch.isDBCSLead
          ) {
            const trailCh = line[c + 1];
            if (ch.blink || trailCh.blink) {
              hasBlink = true;
            }
            const isLeadHidden = ch.blink && isBlinkHidden;
            const isTrailHidden = trailCh.blink && isBlinkHidden;
            const leadFgIndex = ch.getFg() !== undefined ? ch.getFg() : 7;
            const trailFgIndex =
              trailCh.getFg() !== undefined ? trailCh.getFg() : 7;
            const rawLeadBg = ch.getBg() !== undefined ? ch.getBg() : 0;
            const rawTrailBg =
              trailCh.getBg() !== undefined ? trailCh.getBg() : 0;
            const leadBgIndex =
              isLineHighlighted && rawLeadBg === 0 ? 16 : rawLeadBg;
            const trailBgIndex =
              isLineHighlighted && rawTrailBg === 0 ? 16 : rawTrailBg;

            const xL = colX(c);
            const xM = colX(c + 1);
            const xR = colX(c + 2);
            const wL = xM - xL;
            const wR = xR - xM;
            const wFull = xR - xL;

            const isEmptyChar =
              !ch.ch || ch.ch === " " || ch.ch === "\u3000" || ch.ch === "\x00";
            const isLeadSolid =
              isLeadHidden || isEmptyChar || leadFgIndex === leadBgIndex;
            const isTrailSolid =
              isTrailHidden || isEmptyChar || trailFgIndex === trailBgIndex;

            if (blockGrid) {
              if (isLeadSolid) {
                blockGrid[r * cols + c] = this.getBlockItem(
                  "\u2588",
                  r,
                  c,
                  xL,
                  y0,
                  wL,
                  h,
                  leadBgIndex,
                  leadBgIndex,
                  null,
                  1
                );
              }
              if (isTrailSolid) {
                blockGrid[r * cols + c + 1] = this.getBlockItem(
                  "\u2588",
                  r,
                  c + 1,
                  xM,
                  y0,
                  wR,
                  h,
                  trailBgIndex,
                  trailBgIndex,
                  null,
                  1
                );
              }
            }

            if (!isLeadSolid || !isTrailSolid) {
              if (ANSI_BLOCK_SET.has(ch.ch)) {
                if (
                  !isLeadSolid &&
                  !isTrailSolid &&
                  leadFgIndex === trailFgIndex &&
                  leadBgIndex === trailBgIndex
                ) {
                  const item = this.getBlockItem(
                    ch.ch,
                    r,
                    c,
                    xL,
                    y0,
                    wFull,
                    h,
                    leadFgIndex,
                    leadBgIndex,
                    null,
                    2
                  );
                  ansiBlockBuckets[leadFgIndex].push(item);
                  if (blockGrid) {
                    blockGrid[r * cols + c] = item;
                    blockGrid[r * cols + c + 1] = item;
                  }
                } else if (
                  ch.ch === "\u2588" ||
                  ch.ch === "\u25a0" ||
                  LOWER_BLOCK_MAP[ch.ch] !== undefined ||
                  UPPER_BLOCK_MAP[ch.ch] !== undefined
                ) {
                  if (!isLeadSolid) {
                    const itemL = this.getBlockItem(
                      ch.ch,
                      r,
                      c,
                      xL,
                      y0,
                      wL,
                      h,
                      leadFgIndex,
                      leadBgIndex,
                      null,
                      1
                    );
                    ansiBlockBuckets[leadFgIndex].push(itemL);
                    if (blockGrid) blockGrid[r * cols + c] = itemL;
                  }
                  if (!isTrailSolid) {
                    const itemR = this.getBlockItem(
                      ch.ch,
                      r,
                      c + 1,
                      xM,
                      y0,
                      wR,
                      h,
                      trailFgIndex,
                      trailBgIndex,
                      null,
                      1
                    );
                    ansiBlockBuckets[trailFgIndex].push(itemR);
                    if (blockGrid) blockGrid[r * cols + c + 1] = itemR;
                  }
                } else {
                  if (!isLeadSolid) {
                    const itemL = this.getBlockItem(
                      ch.ch,
                      r,
                      c,
                      xL,
                      y0,
                      wFull,
                      h,
                      leadFgIndex,
                      leadBgIndex,
                      { x: xL, y: y0, w: wL, h },
                      2
                    );
                    ansiBlockBuckets[leadFgIndex].push(itemL);
                    if (blockGrid) blockGrid[r * cols + c] = itemL;
                  }
                  if (!isTrailSolid) {
                    const itemR = this.getBlockItem(
                      ch.ch,
                      r,
                      c,
                      xL,
                      y0,
                      wFull,
                      h,
                      trailFgIndex,
                      trailBgIndex,
                      { x: xM, y: y0, w: wR, h },
                      2
                    );
                    ansiBlockBuckets[trailFgIndex].push(itemR);
                    if (blockGrid) blockGrid[r * cols + c + 1] = itemR;
                  }
                }
              } else {
                if (
                  !isLeadSolid &&
                  !isTrailSolid &&
                  leadFgIndex === trailFgIndex &&
                  leadBgIndex === trailBgIndex
                ) {
                  textBuckets[leadFgIndex].push(
                    this.getTextItem(
                      ch.ch,
                      xL,
                      wFull,
                      devDrawY,
                      true,
                      null,
                      leadBgIndex
                    )
                  );
                } else {
                  if (!isLeadSolid) {
                    textBuckets[leadFgIndex].push(
                      this.getTextItem(
                        ch.ch,
                        xL,
                        wFull,
                        devDrawY,
                        true,
                        { x: xL, y: y0, w: wL, h },
                        leadBgIndex
                      )
                    );
                  }
                  if (!isTrailSolid) {
                    textBuckets[trailFgIndex].push(
                      this.getTextItem(
                        ch.ch,
                        xL,
                        wFull,
                        devDrawY,
                        true,
                        { x: xM, y: y0, w: wR, h },
                        trailBgIndex
                      )
                    );
                  }
                }
              }
            }

            if (ch.underLine && !isLeadHidden) {
              underlineBuckets[leadFgIndex].push(
                xL,
                textUnderlineY,
                wL,
                underlineH
              );
            }
            if (trailCh.underLine && !isTrailHidden) {
              underlineBuckets[trailFgIndex].push(
                xM,
                textUnderlineY,
                wR,
                underlineH
              );
            }
            c++;
            continue;
          }

          if (ch.isDBCSTrail || ch.ch === "") {
            continue;
          }

          if (ch.blink) {
            hasBlink = true;
          }
          const isHidden = ch.blink && isBlinkHidden;
          const charStr = ch.ch;
          const fgIndex = ch.getFg() !== undefined ? ch.getFg() : 7;
          const rawBg = ch.getBg() !== undefined ? ch.getBg() : 0;
          const bgIndex = isLineHighlighted && rawBg === 0 ? 16 : rawBg;
          const x0 = colX(c);
          const x1 = colX(c + 1);
          const w = x1 - x0;
          const isEmptyChar = !charStr || charStr === " " || charStr === "\x00";
          const isSolid = isHidden || isEmptyChar || fgIndex === bgIndex;

          if (isSolid) {
            if (blockGrid) {
              blockGrid[r * cols + c] = this.getBlockItem(
                "\u2588",
                r,
                c,
                x0,
                y0,
                w,
                h,
                bgIndex,
                bgIndex,
                null,
                1
              );
            }
          } else if (ANSI_BLOCK_SET.has(charStr)) {
            const item = this.getBlockItem(
              charStr,
              r,
              c,
              x0,
              y0,
              w,
              h,
              fgIndex,
              bgIndex,
              null,
              1
            );
            ansiBlockBuckets[fgIndex].push(item);
            if (blockGrid) blockGrid[r * cols + c] = item;
          } else {
            textBuckets[fgIndex].push(
              this.getTextItem(charStr, x0, w, devDrawY, false, null, bgIndex)
            );
          }

          if (ch.underLine && !isHidden) {
            underlineBuckets[fgIndex].push(x0, textUnderlineY, w, underlineH);
          }
        }
      }
      if (!targetRows) {
        this.hasBlink = hasBlink;
      } else if (hasBlink) {
        this.hasBlink = true;
      }
    } else {
      this.hasBlink = false;
    }

    const defaultBg =
      termColors.defaultBg || termDefaultBg || termColors[0] || "#000000";
    const defaultFg =
      termColors.defaultFg || termDefaultFg || termColors[7] || "#c0c0c0";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (targetRows) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < targetRows.length; ++i) {
        const r = targetRows[i];
        const ry0 = rowY(r);
        ctx.rect(0, ry0, targetWidth, rowY(r + 1) - ry0);
      }
      ctx.clip();

      ctx.fillStyle = defaultBg;
      for (let i = 0; i < targetRows.length; ++i) {
        const r = targetRows[i];
        const ry0 = rowY(r);
        ctx.fillRect(0, ry0, targetWidth, rowY(r + 1) - ry0);
      }
    } else {
      ctx.fillStyle = defaultBg;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    const isPlain = !!termColors.forcePlainText;
    const minContrast = isPlain ? 0 : termColors.minimumContrast || 0;
    const getBgHex = (bgIdx) => {
      if (bgIdx === 16) return hlColor;
      if (bgIdx === 0) return defaultBg;
      return termColors[bgIdx] || defaultBg;
    };

    for (let bgIdx = 1; bgIdx < 17; ++bgIdx) {
      if (isPlain && bgIdx < 16) continue;
      const runs = bgBuckets[bgIdx];
      if (runs.length === 0) continue;
      ctx.fillStyle = bgIdx === 16 ? hlColor : termColors[bgIdx];
      for (let i = 0; i < runs.length; i += 4) {
        ctx.fillRect(runs[i], runs[i + 1], runs[i + 2], runs[i + 3]);
      }
    }

    for (let cIdx = 0; cIdx < 16; ++cIdx) {
      const bucket = ansiBlockBuckets[cIdx];
      if (bucket.length === 0) continue;
      const baseFg = isPlain || cIdx === 7 ? defaultFg : termColors[cIdx];
      let currentFill = null;
      let hasOpenPath = false;

      for (let i = 0; i < bucket.length; ++i) {
        const item = bucket[i];
        const color =
          minContrast > 0
            ? getContrastColor(baseFg, getBgHex(item.bgIndex || 0), minContrast)
            : baseFg;

        if (item.clip) {
          if (hasOpenPath) {
            ctx.fill();
            hasOpenPath = false;
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(item.clip.x, item.clip.y, item.clip.w, item.clip.h);
          ctx.clip();
          ctx.fillStyle = color;
          ctx.beginPath();
          SmoothAnsiArt.drawBlock(
            ctx,
            item,
            smoothAnsiArt ? blockGrid : null,
            cols,
            rows,
            chw,
            chh
          );
          ctx.fill();
          ctx.restore();
          currentFill = null;
          continue;
        }

        if (color !== currentFill) {
          if (hasOpenPath) {
            ctx.fill();
          }
          currentFill = color;
          ctx.fillStyle = currentFill;
          ctx.beginPath();
          hasOpenPath = true;
        } else if (!hasOpenPath) {
          ctx.fillStyle = currentFill;
          ctx.beginPath();
          hasOpenPath = true;
        }

        SmoothAnsiArt.drawBlock(
          ctx,
          item,
          smoothAnsiArt ? blockGrid : null,
          cols,
          rows,
          chw,
          chh
        );
      }
      if (hasOpenPath) {
        ctx.fill();
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (ctx.font !== fontString) {
      ctx.font = fontString;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }
    const targetW1 = chw * effScaleX;
    const targetW2 = 2 * chw * effScaleX;
    for (let cIdx = 0; cIdx < 16; ++cIdx) {
      const bucket = textBuckets[cIdx];
      if (bucket.length === 0) continue;
      const baseFg = isPlain || cIdx === 7 ? defaultFg : termColors[cIdx];
      let currentFill =
        minContrast > 0
          ? getContrastColor(baseFg, defaultBg, minContrast)
          : baseFg;
      ctx.fillStyle = currentFill;
      for (let i = 0; i < bucket.length; ++i) {
        const item = bucket[i];
        if (minContrast > 0) {
          const itemColor = getContrastColor(
            baseFg,
            getBgHex(item.bgIndex || 0),
            minContrast
          );
          if (itemColor !== currentFill) {
            currentFill = itemColor;
            ctx.fillStyle = currentFill;
          }
        }
        if (item.clip) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.beginPath();
          ctx.rect(item.clip.x, item.clip.y, item.clip.w, item.clip.h);
          ctx.clip();
        }
        const targetW = item.isDBCS ? targetW2 : targetW1;
        const { scale, textWidth } = this.getCharMetrics(
          ctx,
          item.text,
          item.isDBCS,
          targetW
        );
        const renderedW = textWidth * scale;
        const xLeft =
          item.cellW >= 4
            ? item.x0 + Math.round((item.cellW - renderedW) / 2)
            : item.x0 + (item.cellW - renderedW) / 2;
        const devDrawX = xLeft + renderedW / 2;
        if (scale === 1) {
          ctx.fillText(item.text, devDrawX, item.devY);
        } else {
          ctx.setTransform(scale, 0, 0, 1, devDrawX, item.devY);
          ctx.fillText(item.text, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        if (item.clip) {
          ctx.restore();
        }
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let uIdx = 0; uIdx < 16; ++uIdx) {
      const uRuns = underlineBuckets[uIdx];
      if (uRuns.length === 0) continue;
      const baseFg = isPlain || uIdx === 7 ? defaultFg : termColors[uIdx];
      ctx.fillStyle =
        minContrast > 0
          ? getContrastColor(baseFg, defaultBg, minContrast)
          : baseFg;
      for (let i = 0; i < uRuns.length; i += 4) {
        ctx.fillRect(uRuns[i], uRuns[i + 1], uRuns[i + 2], uRuns[i + 3]);
      }
    }

    if (urlUnderlineRuns.length > 0) {
      ctx.fillStyle =
        termColors.defaultLink || termDefaultLink || URL_UNDERLINE_COLOR;
      for (let i = 0; i < urlUnderlineRuns.length; i += 4) {
        ctx.fillRect(
          urlUnderlineRuns[i],
          urlUnderlineRuns[i + 1],
          urlUnderlineRuns[i + 2],
          urlUnderlineRuns[i + 3]
        );
      }
    }

    if (targetRows) {
      ctx.restore();
    }
  }
}

export default CanvasRenderer;
