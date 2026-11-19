/**
 * Funciones matemáticas y distribuciones estadísticas de alta precisión.
 * Implementación numérica pura en TypeScript (Gamma, Beta incompleta, Normal, t-Student, F, Chi-cuadrado, Shapiro-Wilk AS R94).
 */

const LANCZOS_COEFFS = [
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7,
];

export function lgamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  const zm1 = z - 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < LANCZOS_COEFFS.length; i++) {
    x += LANCZOS_COEFFS[i] / (zm1 + i + 1);
  }
  const t = zm1 + LANCZOS_COEFFS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zm1 + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-14;
  const FPMIN = 1e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b) */
export function betainc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Regularized lower incomplete gamma P(a, x) */
export function gammaincP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (a <= 0) return 1;
  const gln = lgamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 3e-14) {
        return sum * Math.exp(-x + a * Math.log(x) - gln);
      }
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  } else {
    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 3e-14) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
  }
}

export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function normCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Acklam inverse normal CDF */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

export function tCdf(t: number, df: number): number {
  if (df <= 0) return NaN;
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const x = df / (df + t * t);
  const ib = betainc(x, df / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

export function tTwoTailedPValue(tStat: number, df: number): number {
  if (!Number.isFinite(tStat) || df <= 0) return NaN;
  const x = df / (df + tStat * tStat);
  return Math.min(1, Math.max(0, betainc(x, df / 2, 0.5)));
}

export function tInv(p: number, df: number): number {
  if (p <= 0 || p >= 1 || df <= 0) return NaN;
  if (p === 0.5) return 0;
  if (df > 1e6) return normInv(p);
  const sign = p > 0.5 ? 1 : -1;
  const target = p > 0.5 ? p : 1 - p;
  let lo = 0;
  let hi = Math.max(10, Math.abs(normInv(target)) * 3);
  while (tCdf(hi, df) < target && hi < 1e6) {
    hi *= 2;
  }
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (tCdf(mid, df) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return sign * 0.5 * (lo + hi);
}

export function fPValue(fStat: number, df1: number, df2: number): number {
  if (!Number.isFinite(fStat) || fStat < 0 || df1 <= 0 || df2 <= 0) return NaN;
  if (fStat === 0) return 1;
  const x = df2 / (df2 + df1 * fStat);
  return Math.min(1, Math.max(0, betainc(x, df2 / 2, df1 / 2)));
}

export function chiSqPValue(chiSq: number, df: number): number {
  if (!Number.isFinite(chiSq) || chiSq < 0 || df <= 0) return NaN;
  if (chiSq === 0) return 1;
  return Math.min(1, Math.max(0, 1 - gammaincP(df / 2, chiSq / 2)));
}

function polyEval(coeffs: number[], x: number): number {
  let res = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    res = res * x + coeffs[i];
  }
  return res;
}

/**
 * Shapiro-Wilk Normality Test (Royston AS R94 algorithm, 1995)
 * Válido para 3 <= n <= 5000.
 */
export function shapiroWilkTest(values: number[]): { w: number; pValue: number } {
  const n = values.length;
  if (n < 3) return { w: NaN, pValue: NaN };

  const sorted = [...values].sort((a, b) => a - b);
  const range = sorted[n - 1] - sorted[0];
  if (range === 0) return { w: 1, pValue: 1 };

  // Subsample uniformly if n > 5000 (Royston limit)
  const x = n > 5000
    ? Array.from({ length: 5000 }, (_, i) => sorted[Math.floor((i * (n - 1)) / 4999)])
    : sorted;
  const mCount = x.length;
  const nn2 = Math.floor(mCount / 2);

  const a = new Array<number>(mCount).fill(0);
  const m = new Array<number>(mCount).fill(0);
  for (let i = 0; i < mCount; i++) {
    m[i] = normInv((i + 1 - 0.375) / (mCount + 0.25));
  }
  const mSumSq = m.reduce((acc, v) => acc + v * v, 0);

  if (mCount === 3) {
    const sq2 = Math.SQRT1_2;
    a[0] = -sq2;
    a[2] = sq2;
  } else {
    const u = 1 / Math.sqrt(mCount);
    const c1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
    const c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];

    a[mCount - 1] = m[mCount - 1] / Math.sqrt(mSumSq) + polyEval(c1, u);
    a[0] = -a[mCount - 1];

    let phi: number;
    let iStart: number;
    if (mCount <= 5) {
      phi = (mSumSq - 2 * m[mCount - 1] * m[mCount - 1]) / (1 - 2 * a[mCount - 1] * a[mCount - 1]);
      iStart = 1;
    } else {
      a[mCount - 2] = m[mCount - 2] / Math.sqrt(mSumSq) + polyEval(c2, u);
      a[1] = -a[mCount - 2];
      phi =
        (mSumSq - 2 * m[mCount - 1] * m[mCount - 1] - 2 * m[mCount - 2] * m[mCount - 2]) /
        (1 - 2 * a[mCount - 1] * a[mCount - 1] - 2 * a[mCount - 2] * a[mCount - 2]);
      iStart = 2;
    }
    const sqrtPhi = Math.sqrt(phi);
    for (let i = iStart; i < mCount - iStart; i++) {
      a[i] = m[i] / sqrtPhi;
    }
  }

  const mean = x.reduce((s, v) => s + v, 0) / mCount;
  const ss = x.reduce((s, v) => s + (v - mean) * (v - mean), 0);
  let num = 0;
  for (let i = 0; i < nn2; i++) {
    num += a[mCount - 1 - i] * (x[mCount - 1 - i] - x[i]);
  }
  const w = Math.min(1, Math.max(0, (num * num) / ss));

  // Compute p-value via Royston transformation
  let pValue = 1;
  if (mCount === 3) {
    const pi6 = 1.90985931710274;
    const stqr = 1.0471975511966;
    pValue = pi6 * (Math.asin(Math.sqrt(w)) - stqr);
    pValue = Math.min(1, Math.max(0, pValue));
  } else if (mCount <= 11) {
    const gamma = 0.459 * mCount - 2.273;
    const y = -Math.log(gamma - Math.log(1 - w));
    const mu = -0.0006714 * mCount ** 3 + 0.025054 * mCount ** 2 - 0.39978 * mCount + 0.544;
    const sigma = Math.exp(-0.0020322 * mCount ** 3 + 0.062767 * mCount ** 2 - 0.77857 * mCount + 1.3822);
    const z = (y - mu) / sigma;
    pValue = 1 - normCdf(z);
  } else {
    const lnN = Math.log(mCount);
    const y = Math.log(1 - w);
    const mu = 0.0038915 * lnN ** 3 - 0.083751 * lnN ** 2 - 0.31082 * lnN - 1.5861;
    const sigma = Math.exp(0.0030302 * lnN ** 2 - 0.082676 * lnN - 0.4803);
    const z = (y - mu) / sigma;
    pValue = 1 - normCdf(z);
  }

  return { w, pValue: Math.min(1, Math.max(0, pValue)) };
}
