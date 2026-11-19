/**
 * Operaciones matriciales de precisión para Mínimos Cuadrados Ordinarios (OLS).
 * Implementa resolución lineal con pivoteo parcial e inversión de Gauss-Jordan.
 */

export function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0]?.length ?? 0;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

export function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const p = B[0]?.length ?? 0;
  const C: number[][] = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < p; j++) {
        C[i][j] += aik * B[k][j];
      }
    }
  }
  return C;
}

export function matVecMul(A: number[][], v: number[]): number[] {
  const m = A.length;
  const n = v.length;
  const res = new Array<number>(m).fill(0);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += A[i][j] * v[j];
    }
    res[i] = sum;
  }
  return res;
}

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Inversión de matriz cuadrada simétrica/general mediante Gauss-Jordan con pivoteo parcial.
 * Devuelve null si la matriz es singular o numéricamente colineal.
 */
export function invertMatrix(M: number[][], tol = 1e-11): number[][] | null {
  const n = M.length;
  if (n === 0) return [];
  const aug: number[][] = M.map((row, i) => {
    const invRow = new Array<number>(n).fill(0);
    invRow[i] = 1;
    return [...row, ...invRow];
  });

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(aug[r][col]);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = r;
      }
    }

    if (maxVal < tol) {
      return null;
    }

    if (pivotRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivotRow];
      aug[pivotRow] = tmp;
    }

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

/**
 * Calcula X^T X y X^T y de manera directa y eficiente.
 */
export function normalEquations(
  X: number[][],
  y: number[]
): { xtx: number[][]; xty: number[] } {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const xtx: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const xty = new Array<number>(p).fill(0);

  for (let i = 0; i < n; i++) {
    const row = X[i];
    const yi = y[i];
    for (let j = 0; j < p; j++) {
      const xij = row[j];
      xty[j] += xij * yi;
      for (let k = j; k < p; k++) {
        xtx[j][k] += xij * row[k];
      }
    }
  }

  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) {
      xtx[j][k] = xtx[k][j];
    }
  }

  return { xtx, xty };
}

export function quadForm(v: number[], M: number[][]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    let rowSum = 0;
    for (let j = 0; j < v.length; j++) {
      rowSum += M[i][j] * v[j];
    }
    sum += v[i] * rowSum;
  }
  return sum;
}
