export const LOWER_BLOCK_MAP = {
  "\uff3f": 0.03, // ＿ fullwidth low line
  "\u02cd": 0.07, // ˍ modifier letter low line
  "\u2581": 1 / 8, // ▁ lower 1/8
  "\u2582": 2 / 8, // ▂ lower 1/4
  "\u2583": 3 / 8, // ▃ lower 3/8
  "\u2584": 4 / 8, // ▄ lower 1/2
  "\u2585": 5 / 8, // ▅ lower 5/8
  "\u2586": 6 / 8, // ▆ lower 3/4
  "\u2587": 7 / 8, // ▇ lower 7/8
  "\u2588": 1.0, // █ full block
  "\u25a0": 1.0, // ■ black square
};

export const UPPER_BLOCK_MAP = {
  "\u2594": 1 / 8, // ▔ upper 1/8
  "\u2580": 4 / 8, // ▀ upper 1/2
  "\u2588": 1.0, // █ full block
  "\u25a0": 1.0, // ■ black square
};

export const LEFT_BLOCK_MAP = {
  "\u258f": 1 / 8, // ▏ left 1/8
  "\u258e": 2 / 8, // ▎ left 1/4
  "\u258d": 3 / 8, // ▍ left 3/8
  "\u258c": 4 / 8, // ▌ left 1/2
  "\u258b": 5 / 8, // ▋ left 5/8
  "\u258a": 6 / 8, // ▊ left 3/4
  "\u2589": 7 / 8, // ▉ left 7/8
  "\u2588": 1.0, // █ full block
  "\u25a0": 1.0, // ■ black square
};

export const RIGHT_BLOCK_MAP = {
  "\u2595": 1 / 8, // ▕ right 1/8
  "\u2590": 4 / 8, // ▐ right 1/2
  "\u2588": 1.0, // █ full block
  "\u25a0": 1.0, // ■ black square
};

export const ANSI_BLOCK_SET = new Set([
  "\u2588", // █ full block
  "\u25a0", // ■ black square
  "\u2584", // ▄ lower half block
  "\u2580", // ▀ upper half block
  "\u258c", // ▌ left half block
  "\u2590", // ▐ right half block
  "\u25e2", // ◢ lower right triangle
  "\u25e3", // ◣ lower left triangle
  "\u25e5", // ◥ upper right triangle
  "\u25e4", // ◤ upper left triangle
  "\u25b2", // ▲ up triangle
  "\u25bc", // ▼ down triangle
  // Lower fractional blocks & low lines
  "\uff3f", // ＿ fullwidth low line
  "\u02cd", // ˍ modifier letter low line
  "\u2581", // ▁ lower 1/8
  "\u2582", // ▂ lower 1/4
  "\u2583", // ▃ lower 3/8
  "\u2585", // ▅ lower 5/8
  "\u2586", // ▆ lower 3/4
  "\u2587", // ▇ lower 7/8
  // Left fractional blocks
  "\u258f", // ▏ left 1/8
  "\u258e", // ▎ left 1/4
  "\u258d", // ▍ left 3/8
  "\u258b", // ▋ left 5/8
  "\u258a", // ▊ left 3/4
  "\u2589", // ▉ left 7/8
  // Upper / right fractional blocks
  "\u2594", // ▔ upper 1/8
  "\u2595", // ▕ right 1/8
]);

export function hasAnsiArt(lines, dirtyRows) {
  if (!dirtyRows || !lines) return false;
  for (let i = 0; i < dirtyRows.length; ++i) {
    const r = dirtyRows[i];
    const line = lines[r];
    if (!line) continue;
    for (let c = 0; c < line.length; ++c) {
      const ch = line[c];
      if (!ch || !ch.ch) continue;
      if (ANSI_BLOCK_SET.has(ch.ch)) {
        return true;
      }
    }
  }
  return false;
}

export const hasAnsiBlock = hasAnsiArt;

export class SmoothAnsiArt {
  static isSolidColor(cell, colorIndex) {
    if (!cell || colorIndex === undefined) return false;
    if (cell.type === "\u2588" || cell.type === "\u25a0") {
      return cell.fgIndex === colorIndex;
    }
    return false;
  }

  static getLeftBoundaryX(cell, leftColor, rightColor) {
    if (!cell) return null;
    if (cell.type === "\u2588" || cell.type === "\u25a0") {
      if (cell.fgIndex === leftColor) return 1.0;
      if (rightColor !== undefined && cell.fgIndex === rightColor) return 0.0;
      return null;
    }
    if (LEFT_BLOCK_MAP[cell.type] !== undefined) {
      if (
        cell.fgIndex === leftColor &&
        (rightColor === undefined ||
          cell.bgIndex === rightColor ||
          rightColor === leftColor)
      ) {
        return LEFT_BLOCK_MAP[cell.type];
      }
    }
    if (RIGHT_BLOCK_MAP[cell.type] !== undefined) {
      if (
        rightColor !== undefined &&
        cell.fgIndex === rightColor &&
        (leftColor === undefined || cell.bgIndex === leftColor)
      ) {
        return 1.0 - RIGHT_BLOCK_MAP[cell.type];
      }
    }
    return null;
  }

  static hasLRBoundary(cell, grid, cols, chw, leftColor, rightColor) {
    if (!cell || !grid) return false;
    const x = this.getLeftBoundaryX(cell, leftColor, rightColor);
    if (x !== null && x > 0.0 && x < 1.0) {
      return true;
    }
    if (cell.type === "\u2588" || cell.type === "\u25a0") {
      const stepCol = cell.span || (chw && cell.w > chw ? 2 : 1);
      if (cell.fgIndex === rightColor && cell.bgIndex === leftColor) {
        const leftNeighbor =
          cell.c > 0 ? grid[cell.r * cols + cell.c - 1] : null;
        return this.isSolidColor(leftNeighbor, leftColor);
      }
      if (cell.fgIndex === leftColor && cell.bgIndex === rightColor) {
        const rightNeighbor =
          cell.c + stepCol < cols
            ? grid[cell.r * cols + cell.c + stepCol]
            : null;
        return this.isSolidColor(rightNeighbor, rightColor);
      }
    }
    return false;
  }

  static drawBlock(ctx, item, grid, cols, rows, chw, chh) {
    const { type, x, y, w, h } = item;

    if (type === "\u2588" || type === "\u25a0") {
      if (grid) {
        if (this.drawLowerBlockRamp(ctx, item, grid, cols, rows, chw, chh)) {
          return;
        }
        if (this.drawUpperBlockRamp(ctx, item, grid, cols, rows, chw, chh)) {
          return;
        }
        if (this.drawLeftBlockRamp(ctx, item, grid, cols, rows, chw, chh)) {
          return;
        }
        if (this.drawRightBlockRamp(ctx, item, grid, cols, rows, chw, chh)) {
          return;
        }
      }
      ctx.rect(x, y, w, h);
      return;
    }

    if (LOWER_BLOCK_MAP[type] !== undefined) {
      this.drawLowerBlockRamp(ctx, item, grid, cols, rows, chw, chh);
      return;
    }

    if (UPPER_BLOCK_MAP[type] !== undefined) {
      this.drawUpperBlockRamp(ctx, item, grid, cols, rows, chw, chh);
      return;
    }

    if (LEFT_BLOCK_MAP[type] !== undefined) {
      this.drawLeftBlockRamp(ctx, item, grid, cols, rows, chw, chh);
      return;
    }

    if (RIGHT_BLOCK_MAP[type] !== undefined) {
      this.drawRightBlockRamp(ctx, item, grid, cols, rows, chw, chh);
      return;
    }

    switch (type) {
      case "\u25e2": // ◢ lower right triangle
      case "\u25e3": // ◣ lower left triangle
      case "\u25e5": // ◥ upper right triangle
      case "\u25e4": // ◤ upper left triangle
        this.drawTriangle(ctx, item, grid, cols, chw);
        break;

      case "\u25b2": // ▲ up triangle
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;

      case "\u25bc": // ▼ down triangle
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w / 2, y + h);
        ctx.closePath();
        break;

      default: {
        ctx.rect(x, y, w, h);
        break;
      }
    }
  }

  static drawLowerBlockRamp(ctx, item, grid, cols, rows, chw, chh) {
    const { x, y, w, h, r, c, fgIndex, type } = item;
    const curH = LOWER_BLOCK_MAP[type];
    if (curH === undefined) return false;

    const leftCol = c - 1;
    const leftCell = grid && leftCol >= 0 ? grid[r * cols + leftCol] : null;
    const isSameLeft =
      leftCell &&
      leftCell.fgIndex === fgIndex &&
      LOWER_BLOCK_MAP[leftCell.type] !== undefined;

    const stepCol = item.span || (chw && w > chw ? 2 : 1);
    const rightCol = c + stepCol;
    const rightCell =
      grid && rightCol < cols ? grid[r * cols + rightCol] : null;
    const isSameRight =
      rightCell &&
      rightCell.fgIndex === fgIndex &&
      LOWER_BLOCK_MAP[rightCell.type] !== undefined;

    const leftH = isSameLeft ? LOWER_BLOCK_MAP[leftCell.type] : null;
    const rightH = isSameRight ? LOWER_BLOCK_MAP[rightCell.type] : null;

    if (type === "\u2588" || type === "\u25a0") {
      const touchesLowerRamp =
        (leftH !== null && leftH < 1.0) || (rightH !== null && rightH < 1.0);
      if (!touchesLowerRamp) return false;
    }

    const leftW = isSameLeft ? leftCell.w : w;
    const rightW = isSameRight ? rightCell.w : w;

    let hL, hR;
    if (leftH !== null && rightH !== null) {
      hL = (leftH * w + curH * leftW) / (leftW + w);
      hR = (curH * rightW + rightH * w) / (w + rightW);
    } else if (leftH !== null) {
      hL = (leftH * w + curH * leftW) / (leftW + w);
      const delta = (curH - leftH) * (w / (leftW + w));
      hR = Math.min(1.0, Math.max(0.0, curH + delta));
      if (curH >= 0.95 && curH >= leftH) hR = 1.0;
      if (curH <= 0.05 && curH <= leftH) hR = 0.0;
    } else if (rightH !== null) {
      const delta = (rightH - curH) * (w / (w + rightW));
      hL = Math.min(1.0, Math.max(0.0, curH - delta));
      if (curH <= 0.05 && curH <= rightH) hL = 0.0;
      if (curH >= 0.95 && curH >= rightH) hL = 1.0;
      hR = (curH * rightW + rightH * w) / (w + rightW);
    } else {
      hL = curH;
      hR = curH;
    }

    const isPeak =
      leftH !== null && rightH !== null && curH > leftH && curH > rightH;
    const isValley =
      leftH !== null && rightH !== null && curH < leftH && curH < rightH;

    if (hL === hR && !isPeak && !isValley && h >= 4) {
      const topY = y + h - Math.round(hL * h);
      ctx.rect(x, topY, w, y + h - topY);
      return true;
    }

    const xR = x + w;

    ctx.moveTo(x, y + h - hL * h);
    if (isPeak || isValley) {
      ctx.lineTo(x + w / 2, y + h - curH * h);
    }
    ctx.lineTo(xR, y + h - hR * h);
    ctx.lineTo(xR, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return true;
  }

  static drawUpperBlockRamp(ctx, item, grid, cols, rows, chw, chh) {
    const { x, y, w, h, r, c, fgIndex, type } = item;
    const curH = UPPER_BLOCK_MAP[type];
    if (curH === undefined) return false;

    const leftCol = c - 1;
    const leftCell = grid && leftCol >= 0 ? grid[r * cols + leftCol] : null;
    const isSameLeft =
      leftCell &&
      leftCell.fgIndex === fgIndex &&
      UPPER_BLOCK_MAP[leftCell.type] !== undefined;

    const stepCol = item.span || (chw && w > chw ? 2 : 1);
    const rightCol = c + stepCol;
    const rightCell =
      grid && rightCol < cols ? grid[r * cols + rightCol] : null;
    const isSameRight =
      rightCell &&
      rightCell.fgIndex === fgIndex &&
      UPPER_BLOCK_MAP[rightCell.type] !== undefined;

    const leftH = isSameLeft ? UPPER_BLOCK_MAP[leftCell.type] : null;
    const rightH = isSameRight ? UPPER_BLOCK_MAP[rightCell.type] : null;

    if (type === "\u2588" || type === "\u25a0") {
      const touchesUpperRamp =
        (leftH !== null && leftH < 1.0) || (rightH !== null && rightH < 1.0);
      if (!touchesUpperRamp) return false;
    }

    const leftW = isSameLeft ? leftCell.w : w;
    const rightW = isSameRight ? rightCell.w : w;

    let hL, hR;
    if (leftH !== null && rightH !== null) {
      hL = (leftH * w + curH * leftW) / (leftW + w);
      hR = (curH * rightW + rightH * w) / (w + rightW);
    } else if (leftH !== null) {
      hL = (leftH * w + curH * leftW) / (leftW + w);
      const delta = (curH - leftH) * (w / (leftW + w));
      hR = Math.min(1.0, Math.max(0.0, curH + delta));
      if (curH >= 0.95 && curH >= leftH) hR = 1.0;
    } else if (rightH !== null) {
      const delta = (rightH - curH) * (w / (w + rightW));
      hL = Math.min(1.0, Math.max(0.0, curH - delta));
      if (curH >= 0.95 && curH >= rightH) hL = 1.0;
      hR = (curH * rightW + rightH * w) / (w + rightW);
    } else {
      hL = curH;
      hR = curH;
    }

    const isPeak =
      leftH !== null && rightH !== null && curH > leftH && curH > rightH;
    const isValley =
      leftH !== null && rightH !== null && curH < leftH && curH < rightH;

    if (hL === hR && !isPeak && !isValley && h >= 4) {
      const bottomY = y + Math.round(hL * h);
      ctx.rect(x, y, w, bottomY - y);
      return true;
    }

    const xR = x + w;

    ctx.moveTo(x, y);
    ctx.lineTo(xR, y);
    ctx.lineTo(xR, y + hR * h);

    if (isPeak || isValley) {
      ctx.lineTo(x + w / 2, y + curH * h);
    }

    ctx.lineTo(x, y + hL * h);
    ctx.closePath();
    return true;
  }

  static drawLeftBlockRamp(ctx, item, grid, cols, rows, chw, chh) {
    const { x, y, w, h, r, c, fgIndex, bgIndex, type } = item;
    const curW = LEFT_BLOCK_MAP[type];
    if (curW === undefined) return false;

    const L = fgIndex;
    const R = bgIndex;
    const stepCol = item.span || (chw && w > chw ? 2 : 1);

    const topCell = r > 0 && grid ? grid[(r - 1) * cols + c] : null;
    const bottomCell = r + 1 < rows && grid ? grid[(r + 1) * cols + c] : null;
    const leftCell = c > 0 && grid ? grid[r * cols + c - 1] : null;
    const rightCell =
      c + stepCol < cols && grid ? grid[r * cols + c + stepCol] : null;

    let topW = this.getLeftBoundaryX(topCell, L, R);
    if (
      topW === null &&
      topCell &&
      topCell.fgIndex === L &&
      LEFT_BLOCK_MAP[topCell.type] !== undefined
    ) {
      topW = LEFT_BLOCK_MAP[topCell.type];
    }

    let bottomW = this.getLeftBoundaryX(bottomCell, L, R);
    if (
      bottomW === null &&
      bottomCell &&
      bottomCell.fgIndex === L &&
      LEFT_BLOCK_MAP[bottomCell.type] !== undefined
    ) {
      bottomW = LEFT_BLOCK_MAP[bottomCell.type];
    }

    if (type === "\u2588" || type === "\u25a0") {
      const touchesLeftRamp =
        (topW !== null && topW > 0.0 && topW < 1.0) ||
        (bottomW !== null && bottomW > 0.0 && bottomW < 1.0);
      if (!touchesLeftRamp) {
        if (this.isSolidColor(rightCell, R)) {
          const topLeftCell =
            r > 0 && c >= stepCol ? grid[(r - 1) * cols + c - stepCol] : null;
          const topRightCell =
            r > 0 && c + stepCol < cols
              ? grid[(r - 1) * cols + c + stepCol]
              : null;
          const bottomLeftCell =
            r + 1 < rows && c >= stepCol
              ? grid[(r + 1) * cols + c - stepCol]
              : null;
          const bottomRightCell =
            r + 1 < rows && c + stepCol < cols
              ? grid[(r + 1) * cols + c + stepCol]
              : null;

          // Down-left diagonal step (◤)
          if (
            (!bottomCell || this.isSolidColor(bottomCell, R)) &&
            topCell &&
            !this.isSolidColor(topCell, R) &&
            leftCell &&
            !this.isSolidColor(leftCell, R) &&
            (this.hasLRBoundary(topRightCell, grid, cols, chw, L, R) ||
              this.hasLRBoundary(bottomLeftCell, grid, cols, chw, L, R))
          ) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x, y + h);
            ctx.closePath();
            return true;
          }
          // Up-left diagonal step (◣)
          if (
            (!topCell || this.isSolidColor(topCell, R)) &&
            bottomCell &&
            !this.isSolidColor(bottomCell, R) &&
            leftCell &&
            !this.isSolidColor(leftCell, R) &&
            (this.hasLRBoundary(bottomRightCell, grid, cols, chw, L, R) ||
              this.hasLRBoundary(topLeftCell, grid, cols, chw, L, R))
          ) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.closePath();
            return true;
          }
        }
        return false;
      }
    }

    let pinnedWT = null;
    let pinnedWB = null;

    if (topW === 0.0) {
      const topLeftCell =
        r > 0 && c >= stepCol && grid
          ? grid[(r - 1) * cols + c - stepCol]
          : null;
      const topLeftX = this.getLeftBoundaryX(topLeftCell, L, R);
      if (
        topLeftX !== null &&
        topLeftX > 0.0 &&
        topLeftX < 1.0 &&
        this.isSolidColor(leftCell, L)
      ) {
        pinnedWT = 0.0;
      }
    } else if (topW === 1.0) {
      const topRightCell =
        r > 0 && c + stepCol < cols && grid
          ? grid[(r - 1) * cols + c + stepCol]
          : null;
      if (
        this.hasLRBoundary(topRightCell, grid, cols, chw, L, R) &&
        this.isSolidColor(rightCell, R)
      ) {
        pinnedWT = 1.0;
      }
    }

    if (bottomW === 1.0) {
      const bottomRightCell =
        r + 1 < rows && c + stepCol < cols && grid
          ? grid[(r + 1) * cols + c + stepCol]
          : null;
      if (
        this.hasLRBoundary(bottomRightCell, grid, cols, chw, L, R) &&
        rightCell &&
        !this.isSolidColor(rightCell, L)
      ) {
        pinnedWB = 1.0;
      }
    } else if (bottomW === 0.0) {
      const bottomLeftCell =
        r + 1 < rows && c >= stepCol && grid
          ? grid[(r + 1) * cols + c - stepCol]
          : null;
      const bottomLeftX = this.getLeftBoundaryX(bottomLeftCell, L, R);
      if (
        bottomLeftX !== null &&
        bottomLeftX > 0.0 &&
        bottomLeftX < 1.0 &&
        this.isSolidColor(leftCell, L)
      ) {
        pinnedWB = 0.0;
      }
    }

    let wT, wB;
    if (pinnedWT !== null && pinnedWB !== null) {
      wT = pinnedWT;
      wB = pinnedWB;
    } else if (pinnedWT !== null) {
      wT = pinnedWT;
      if (bottomW !== null) {
        wB = (curW + bottomW) / 2;
      } else {
        const delta = curW - wT;
        wB = Math.min(1.0, Math.max(0.0, curW + delta));
      }
    } else if (pinnedWB !== null) {
      wB = pinnedWB;
      if (topW !== null) {
        wT = (topW + curW) / 2;
      } else {
        const delta = wB - curW;
        wT = Math.min(1.0, Math.max(0.0, curW - delta));
      }
    } else if (topW !== null && bottomW !== null) {
      wT = (topW + curW) / 2;
      wB = (curW + bottomW) / 2;
    } else if (topW !== null) {
      wT = (topW + curW) / 2;
      const delta = (curW - topW) / 2;
      wB = Math.min(1.0, Math.max(0.0, curW + delta));
      if (curW >= 0.95 && curW >= topW) wB = 1.0;
    } else if (bottomW !== null) {
      const delta = (bottomW - curW) / 2;
      wT = Math.min(1.0, Math.max(0.0, curW - delta));
      if (curW >= 0.95 && curW >= bottomW) wT = 1.0;
      wB = (curW + bottomW) / 2;
    } else {
      wT = curW;
      wB = curW;
    }

    const isPeak =
      topW !== null &&
      bottomW !== null &&
      pinnedWT === null &&
      pinnedWB === null &&
      curW > topW &&
      curW > bottomW;
    const isValley =
      topW !== null &&
      bottomW !== null &&
      pinnedWT === null &&
      pinnedWB === null &&
      curW < topW &&
      curW < bottomW;

    if (wT === wB && !isPeak && !isValley && w >= 4) {
      const rightX = x + Math.round(wT * w);
      ctx.rect(x, y, rightX - x, h);
      return true;
    }

    ctx.moveTo(x, y);
    ctx.lineTo(x + wT * w, y);

    if (isPeak || isValley) {
      ctx.lineTo(x + curW * w, y + h / 2);
    }

    ctx.lineTo(x + wB * w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return true;
  }

  static drawRightBlockRamp(ctx, item, grid, cols, rows, chw, chh) {
    const { x, y, w, h, r, c, fgIndex, bgIndex, type } = item;
    const curRightW = RIGHT_BLOCK_MAP[type];
    if (curRightW === undefined) return false;

    const R = fgIndex;
    const L = bgIndex;
    const curX = 1.0 - curRightW;
    const stepCol = item.span || (chw && w > chw ? 2 : 1);

    const topCell = r > 0 && grid ? grid[(r - 1) * cols + c] : null;
    const bottomCell = r + 1 < rows && grid ? grid[(r + 1) * cols + c] : null;
    const leftCell = c > 0 && grid ? grid[r * cols + c - 1] : null;
    const rightCell =
      c + stepCol < cols && grid ? grid[r * cols + c + stepCol] : null;

    const topX = this.getLeftBoundaryX(topCell, L, R);
    const bottomX = this.getLeftBoundaryX(bottomCell, L, R);

    let pinnedXT = null;
    let pinnedXB = null;

    if (type === "\u2588" || type === "\u25a0") {
      if (!this.isSolidColor(leftCell, L)) {
        return false;
      }
      const touchesFractionalRamp =
        (topX !== null && topX > 0.0 && topX < 1.0) ||
        (bottomX !== null && bottomX > 0.0 && bottomX < 1.0);
      if (!touchesFractionalRamp) {
        const topLeftCell =
          r > 0 && c >= stepCol ? grid[(r - 1) * cols + c - stepCol] : null;
        const topRightCell =
          r > 0 && c + stepCol < cols
            ? grid[(r - 1) * cols + c + stepCol]
            : null;
        const bottomLeftCell =
          r + 1 < rows && c >= stepCol
            ? grid[(r + 1) * cols + c - stepCol]
            : null;
        const bottomRightCell =
          r + 1 < rows && c + stepCol < cols
            ? grid[(r + 1) * cols + c + stepCol]
            : null;

        // Down-right diagonal step (◥): left & bottom are solid L, top & right are shape
        if (
          (!bottomCell || this.isSolidColor(bottomCell, L)) &&
          topCell &&
          !this.isSolidColor(topCell, L) &&
          rightCell &&
          !this.isSolidColor(rightCell, L) &&
          (this.hasLRBoundary(topLeftCell, grid, cols, chw, L, R) ||
            this.hasLRBoundary(bottomRightCell, grid, cols, chw, L, R))
        ) {
          pinnedXT = 0.0;
          pinnedXB = 1.0;
        } else if (
          // Up-right diagonal step (◢): left & top are solid L, bottom & right are shape
          (!topCell || this.isSolidColor(topCell, L)) &&
          bottomCell &&
          !this.isSolidColor(bottomCell, L) &&
          rightCell &&
          !this.isSolidColor(rightCell, L) &&
          (this.hasLRBoundary(bottomLeftCell, grid, cols, chw, L, R) ||
            this.hasLRBoundary(topRightCell, grid, cols, chw, L, R))
        ) {
          pinnedXT = 1.0;
          pinnedXB = 0.0;
        } else {
          return false;
        }
      }
    }

    let xT, xB;
    if (pinnedXT !== null && pinnedXB !== null) {
      xT = pinnedXT;
      xB = pinnedXB;
    } else if (topX !== null && bottomX !== null) {
      xT = (topX + curX) / 2;
      xB = (curX + bottomX) / 2;
    } else if (topX !== null) {
      xT = (topX + curX) / 2;
      const delta = (curX - topX) / 2;
      xB = Math.min(1.0, Math.max(0.0, curX + delta));
    } else if (bottomX !== null) {
      const delta = (bottomX - curX) / 2;
      xT = Math.min(1.0, Math.max(0.0, curX - delta));
      xB = (curX + bottomX) / 2;
    } else {
      xT = curX;
      xB = curX;
    }

    if (xT === xB && w >= 4) {
      const leftX = x + Math.round(xT * w);
      ctx.rect(leftX, y, x + w - leftX, h);
      return true;
    }

    const xR = x + w;

    ctx.moveTo(x + xT * w, y);
    ctx.lineTo(xR, y);
    ctx.lineTo(xR, y + h);
    ctx.lineTo(x + xB * w, y + h);
    ctx.closePath();
    return true;
  }

  static getAdjustedRightX(item, grid, cols, chw) {
    return item.x + item.w;
  }

  static drawTriangle(ctx, item, grid, cols, chw, type = item.type) {
    const { x, y, w, h } = item;
    const xR = x + w;
    switch (type) {
      case "\u25e2": // ◢ lower right
        ctx.moveTo(xR, y);
        ctx.lineTo(xR, y + h);
        ctx.lineTo(x, y + h);
        break;
      case "\u25e3": // ◣ lower left
        ctx.moveTo(x, y);
        ctx.lineTo(xR, y + h);
        ctx.lineTo(x, y + h);
        break;
      case "\u25e5": // ◥ upper right
        ctx.moveTo(x, y);
        ctx.lineTo(xR, y);
        ctx.lineTo(xR, y + h);
        break;
      case "\u25e4": // ◤ upper left
        ctx.moveTo(x, y);
        ctx.lineTo(xR, y);
        ctx.lineTo(x, y + h);
        break;
      default:
        return;
    }
    ctx.closePath();
  }

  static drawTriangleLowerRight(ctx, item, grid, cols, rows, chw, chh) {
    this.drawTriangle(ctx, item, grid, cols, chw, "\u25e2");
  }

  static drawTriangleLowerLeft(ctx, item, grid, cols, rows, chw, chh) {
    this.drawTriangle(ctx, item, grid, cols, chw, "\u25e3");
  }

  static drawTriangleUpperRight(ctx, item, grid, cols, rows, chw, chh) {
    this.drawTriangle(ctx, item, grid, cols, chw, "\u25e5");
  }

  static drawTriangleUpperLeft(ctx, item, grid, cols, rows, chw, chh) {
    this.drawTriangle(ctx, item, grid, cols, chw, "\u25e4");
  }
}

export default SmoothAnsiArt;
