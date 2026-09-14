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

  static getCellEdgeColors(cell, edge) {
    if (!cell) return null;
    const type = cell.type;
    if (type === "\u2588" || type === "\u25a0") {
      return { type: "solid", color: cell.fgIndex };
    }
    if (LOWER_BLOCK_MAP[type] !== undefined) {
      const h = LOWER_BLOCK_MAP[type];
      return {
        type: "solid",
        color: edge === "bottom" || h >= 1.0 ? cell.fgIndex : cell.bgIndex,
      };
    }
    if (UPPER_BLOCK_MAP[type] !== undefined) {
      const h = UPPER_BLOCK_MAP[type];
      return {
        type: "solid",
        color: edge === "top" || h >= 1.0 ? cell.fgIndex : cell.bgIndex,
      };
    }
    if (LEFT_BLOCK_MAP[type] !== undefined) {
      const frac = LEFT_BLOCK_MAP[type];
      const span = cell.span || 1;
      return {
        type: "split",
        leftColor: cell.fgIndex,
        rightColor: cell.bgIndex,
        splitCol: cell.c + frac * span,
      };
    }
    if (RIGHT_BLOCK_MAP[type] !== undefined) {
      const frac = RIGHT_BLOCK_MAP[type];
      const span = cell.span || 1;
      return {
        type: "split",
        leftColor: cell.bgIndex,
        rightColor: cell.fgIndex,
        splitCol: cell.c + (1 - frac) * span,
      };
    }
    if (type === "\u25e2" || type === "\u25e3") {
      if (edge === "bottom") return { type: "solid", color: cell.fgIndex };
      const span = cell.span || 1;
      return type === "\u25e2"
        ? {
            type: "split",
            leftColor: cell.bgIndex,
            rightColor: cell.fgIndex,
            splitCol: cell.c + span,
          }
        : {
            type: "split",
            leftColor: cell.fgIndex,
            rightColor: cell.bgIndex,
            splitCol: cell.c,
          };
    }
    if (type === "\u25e5" || type === "\u25e4") {
      if (edge === "top") return { type: "solid", color: cell.fgIndex };
      const span = cell.span || 1;
      return type === "\u25e5"
        ? {
            type: "split",
            leftColor: cell.bgIndex,
            rightColor: cell.fgIndex,
            splitCol: cell.c + span,
          }
        : {
            type: "split",
            leftColor: cell.fgIndex,
            rightColor: cell.bgIndex,
            splitCol: cell.c,
          };
    }
    return { type: "solid", color: cell.fgIndex };
  }

  static getRowBoundaryX(
    grid,
    cols,
    targetRow,
    cStart,
    span,
    leftColor,
    rightColor,
    edge
  ) {
    if (!grid || targetRow < 0) return null;
    const rows = Math.floor(grid.length / cols);
    if (targetRow >= rows) return null;

    for (let k = cStart; k < cStart + span && k < cols; k++) {
      const cell = grid[targetRow * cols + k];
      if (!cell) continue;
      const info = this.getCellEdgeColors(cell, edge);
      if (
        info &&
        info.type === "split" &&
        info.leftColor === leftColor &&
        (rightColor === undefined ||
          info.rightColor === rightColor ||
          rightColor === leftColor) &&
        info.splitCol >= cStart &&
        info.splitCol <= cStart + span
      ) {
        return (info.splitCol - cStart) / span;
      }
    }

    const getColorAtColEdge = (colIdx, side) => {
      if (colIdx < 0 || colIdx >= cols) return null;
      const cell = grid[targetRow * cols + colIdx];
      if (!cell) return null;
      const info = this.getCellEdgeColors(cell, edge);
      if (!info) return null;
      if (info.type === "solid") return info.color;
      if (side === "left") {
        return colIdx < info.splitCol ? info.leftColor : info.rightColor;
      }
      return colIdx + 1 <= info.splitCol ? info.leftColor : info.rightColor;
    };

    for (let k = cStart + 1; k < cStart + span; k++) {
      const cL = getColorAtColEdge(k - 1, "right");
      const cR = getColorAtColEdge(k, "left");
      if (cL === leftColor && (rightColor === undefined || cR === rightColor)) {
        return (k - cStart) / span;
      }
    }

    let allLeft = true;
    for (let k = cStart; k < cStart + span; k++) {
      if (
        getColorAtColEdge(k, "left") !== leftColor ||
        getColorAtColEdge(k, "right") !== leftColor
      ) {
        allLeft = false;
        break;
      }
    }
    if (allLeft) {
      const rightCol = cStart + span;
      if (rightCol < cols) {
        const cR = getColorAtColEdge(rightCol, "left");
        const rightCell = grid[targetRow * cols + rightCol];
        const rightInfo = this.getCellEdgeColors(rightCell, edge);
        if (
          cR === rightColor ||
          (rightInfo &&
            rightInfo.type === "split" &&
            rightInfo.leftColor === leftColor &&
            (rightColor === undefined || rightInfo.rightColor === rightColor)) ||
          this.hasLRBoundary(rightCell, grid, cols, 1, leftColor, rightColor)
        ) {
          return 1.0;
        }
      }
    }

    let allRight = true;
    for (let k = cStart; k < cStart + span; k++) {
      if (
        getColorAtColEdge(k, "left") !== rightColor ||
        getColorAtColEdge(k, "right") !== rightColor
      ) {
        allRight = false;
        break;
      }
    }
    if (allRight) {
      const leftCol = cStart - 1;
      if (leftCol >= 0) {
        const cL = getColorAtColEdge(leftCol, "right");
        const leftCell = grid[targetRow * cols + leftCol];
        const leftInfo = this.getCellEdgeColors(leftCell, edge);
        if (
          cL === leftColor ||
          (leftInfo &&
            leftInfo.type === "split" &&
            leftInfo.leftColor === leftColor &&
            (rightColor === undefined || leftInfo.rightColor === rightColor)) ||
          this.hasLRBoundary(leftCell, grid, cols, 1, leftColor, rightColor)
        ) {
          return 0.0;
        }
      }
    }

    return null;
  }

  static collectSolidRampWedges(
    grid,
    cols,
    rows,
    ansiBlockBuckets,
    createBlockItem
  ) {
    if (!grid) return;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r * cols + c];
        if (!cell || cell.c !== c) continue;
        if (
          (cell.type !== "\u2588" && cell.type !== "\u25a0") ||
          cell.fgIndex !== cell.bgIndex
        ) {
          continue;
        }
        const C = cell.fgIndex;
        const span = cell.span || 1;

        if (c > 0) {
          const leftCell = grid[r * cols + c - 1];
          const leftInfo = this.getCellEdgeColors(leftCell, "top");
          const L =
            leftInfo && leftInfo.type === "solid" ? leftInfo.color : null;
          if (L !== null && L !== C) {
            const topX = this.getRowBoundaryX(
              grid,
              cols,
              r - 1,
              c,
              span,
              L,
              C,
              "bottom"
            );
            const botX = this.getRowBoundaryX(
              grid,
              cols,
              r + 1,
              c,
              span,
              L,
              C,
              "top"
            );
            if (
              (topX !== null && topX > 0.0 && topX < 1.0) ||
              (botX !== null && botX > 0.0 && botX < 1.0)
            ) {
              const item = createBlockItem(
                "\u2588",
                r,
                c,
                cell.x,
                cell.y,
                cell.w,
                cell.h,
                L,
                C,
                cell.clip,
                span
              );
              item.isSolidWedge = "left";
              ansiBlockBuckets[L].push(item);
            }
          }
        }

        if (c + span < cols) {
          const rightCell = grid[r * cols + c + span];
          const rightInfo = this.getCellEdgeColors(rightCell, "top");
          const R =
            rightInfo && rightInfo.type === "solid" ? rightInfo.color : null;
          if (R !== null && R !== C) {
            const topX = this.getRowBoundaryX(
              grid,
              cols,
              r - 1,
              c,
              span,
              C,
              R,
              "bottom"
            );
            const botX = this.getRowBoundaryX(
              grid,
              cols,
              r + 1,
              c,
              span,
              C,
              R,
              "top"
            );
            if (
              (topX !== null && topX > 0.0 && topX < 1.0) ||
              (botX !== null && botX > 0.0 && botX < 1.0)
            ) {
              const item = createBlockItem(
                "\u2588",
                r,
                c,
                cell.x,
                cell.y,
                cell.w,
                cell.h,
                R,
                C,
                cell.clip,
                span
              );
              item.isSolidWedge = "right";
              ansiBlockBuckets[R].push(item);
            }
          }
        }
      }
    }
  }

  static drawBlock(ctx, item, grid, cols, rows, chw, chh) {
    const { type, x, y, w, h } = item;

    if (item.isSolidWedge === "left") {
      const stepCol = item.span || (chw && w > chw ? 2 : 1);
      const topW = this.getRowBoundaryX(
        grid,
        cols,
        item.r - 1,
        item.c,
        stepCol,
        item.fgIndex,
        item.bgIndex,
        "bottom"
      );
      const bottomW = this.getRowBoundaryX(
        grid,
        cols,
        item.r + 1,
        item.c,
        stepCol,
        item.fgIndex,
        item.bgIndex,
        "top"
      );
      const wT = topW !== null && topW > 0.0 && topW < 1.0 ? topW / 2 : 0.0;
      const wB =
        bottomW !== null && bottomW > 0.0 && bottomW < 1.0
          ? bottomW / 2
          : 0.0;
      if (wT === 0.0 && wB === 0.0) return;
      ctx.moveTo(x, y);
      ctx.lineTo(x + wT * w, y);
      ctx.lineTo(x + wB * w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      return;
    }

    if (item.isSolidWedge === "right") {
      const stepCol = item.span || (chw && w > chw ? 2 : 1);
      const topX = this.getRowBoundaryX(
        grid,
        cols,
        item.r - 1,
        item.c,
        stepCol,
        item.bgIndex,
        item.fgIndex,
        "bottom"
      );
      const bottomX = this.getRowBoundaryX(
        grid,
        cols,
        item.r + 1,
        item.c,
        stepCol,
        item.bgIndex,
        item.fgIndex,
        "top"
      );
      const xT =
        topX !== null && topX > 0.0 && topX < 1.0 ? (1.0 + topX) / 2 : 1.0;
      const xB =
        bottomX !== null && bottomX > 0.0 && bottomX < 1.0
          ? (1.0 + bottomX) / 2
          : 1.0;
      if (xT === 1.0 && xB === 1.0) return;
      const xR = x + w;
      ctx.moveTo(x + xT * w, y);
      ctx.lineTo(xR, y);
      ctx.lineTo(xR, y + h);
      ctx.lineTo(x + xB * w, y + h);
      ctx.closePath();
      return;
    }

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

    let leftH = isSameLeft ? LOWER_BLOCK_MAP[leftCell.type] : null;
    let rightH = isSameRight ? LOWER_BLOCK_MAP[rightCell.type] : null;

    if (curH < 1.0) {
      if (
        leftH === 1.0 &&
        ((rightH !== null && Math.abs(rightH - curH) < 1e-6) || curH < 0.5)
      ) {
        leftH = null;
      }
      if (
        rightH === 1.0 &&
        ((leftH !== null && Math.abs(leftH - curH) < 1e-6) || curH < 0.5)
      ) {
        rightH = null;
      }
    }

    if (type === "\u2588" || type === "\u25a0") {
      if (leftH !== null && leftH < 1.0) {
        const leftStep = leftCell.span || 1;
        const leftLeftCell =
          leftCell.c - 1 >= 0 ? grid[r * cols + leftCell.c - 1] : null;
        const leftLeftH =
          leftLeftCell &&
          leftLeftCell.fgIndex === fgIndex &&
          LOWER_BLOCK_MAP[leftLeftCell.type] !== undefined
            ? LOWER_BLOCK_MAP[leftLeftCell.type]
            : null;
        if (leftH < 0.5 || (leftLeftH !== null && Math.abs(leftLeftH - leftH) < 1e-6)) {
          leftH = null;
        }
      }
      if (rightH !== null && rightH < 1.0) {
        const rightStep = rightCell.span || 1;
        const rightRightCell =
          rightCell.c + rightStep < cols
            ? grid[r * cols + rightCell.c + rightStep]
            : null;
        const rightRightH =
          rightRightCell &&
          rightRightCell.fgIndex === fgIndex &&
          LOWER_BLOCK_MAP[rightRightCell.type] !== undefined
            ? LOWER_BLOCK_MAP[rightRightCell.type]
            : null;
        if (
          rightH < 0.5 ||
          (rightRightH !== null && Math.abs(rightRightH - rightH) < 1e-6)
        ) {
          rightH = null;
        }
      }
      const touchesLowerRamp =
        (leftH !== null && leftH < 1.0) || (rightH !== null && rightH < 1.0);
      if (!touchesLowerRamp) return false;
    }

    const leftW = leftH !== null && leftCell ? leftCell.w : w;
    const rightW = rightH !== null && rightCell ? rightCell.w : w;

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

    let leftH = isSameLeft ? UPPER_BLOCK_MAP[leftCell.type] : null;
    let rightH = isSameRight ? UPPER_BLOCK_MAP[rightCell.type] : null;

    if (curH < 1.0) {
      if (
        leftH === 1.0 &&
        ((rightH !== null && Math.abs(rightH - curH) < 1e-6) || curH < 0.5)
      ) {
        leftH = null;
      }
      if (
        rightH === 1.0 &&
        ((leftH !== null && Math.abs(leftH - curH) < 1e-6) || curH < 0.5)
      ) {
        rightH = null;
      }
    }

    if (type === "\u2588" || type === "\u25a0") {
      if (leftH !== null && leftH < 1.0) {
        const leftLeftCell =
          leftCell.c - 1 >= 0 ? grid[r * cols + leftCell.c - 1] : null;
        const leftLeftH =
          leftLeftCell &&
          leftLeftCell.fgIndex === fgIndex &&
          UPPER_BLOCK_MAP[leftLeftCell.type] !== undefined
            ? UPPER_BLOCK_MAP[leftLeftCell.type]
            : null;
        if (leftH < 0.5 || (leftLeftH !== null && Math.abs(leftLeftH - leftH) < 1e-6)) {
          leftH = null;
        }
      }
      if (rightH !== null && rightH < 1.0) {
        const rightStep = rightCell.span || 1;
        const rightRightCell =
          rightCell.c + rightStep < cols
            ? grid[r * cols + rightCell.c + rightStep]
            : null;
        const rightRightH =
          rightRightCell &&
          rightRightCell.fgIndex === fgIndex &&
          UPPER_BLOCK_MAP[rightRightCell.type] !== undefined
            ? UPPER_BLOCK_MAP[rightRightCell.type]
            : null;
        if (
          rightH < 0.5 ||
          (rightRightH !== null && Math.abs(rightRightH - rightH) < 1e-6)
        ) {
          rightH = null;
        }
      }
      const touchesUpperRamp =
        (leftH !== null && leftH < 1.0) || (rightH !== null && rightH < 1.0);
      if (!touchesUpperRamp) return false;
    }

    const leftW = leftH !== null && leftCell ? leftCell.w : w;
    const rightW = rightH !== null && rightCell ? rightCell.w : w;

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

    let topW = this.getRowBoundaryX(
      grid,
      cols,
      r - 1,
      c,
      stepCol,
      L,
      R,
      "bottom"
    );
    let bottomW = this.getRowBoundaryX(
      grid,
      cols,
      r + 1,
      c,
      stepCol,
      L,
      R,
      "top"
    );

    if (curW < 1.0) {
      if (
        bottomW !== null &&
        Math.abs(bottomW - curW) < 1e-6 &&
        (topW === 0.0 || topW === 1.0)
      ) {
        topW = null;
      }
      if (
        topW !== null &&
        Math.abs(topW - curW) < 1e-6 &&
        (bottomW === 0.0 || bottomW === 1.0)
      ) {
        bottomW = null;
      }
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

    let topX = this.getRowBoundaryX(
      grid,
      cols,
      r - 1,
      c,
      stepCol,
      L,
      R,
      "bottom"
    );
    let bottomX = this.getRowBoundaryX(
      grid,
      cols,
      r + 1,
      c,
      stepCol,
      L,
      R,
      "top"
    );

    if (curRightW < 1.0) {
      if (
        bottomX !== null &&
        Math.abs(bottomX - curX) < 1e-6 &&
        (topX === 0.0 || topX === 1.0)
      ) {
        topX = null;
      }
      if (
        topX !== null &&
        Math.abs(topX - curX) < 1e-6 &&
        (bottomX === 0.0 || bottomX === 1.0)
      ) {
        bottomX = null;
      }
    }

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
