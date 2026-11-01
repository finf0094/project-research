/** The value below which a share `q` (0..1) of `values` lies (nearest rank, no interpolation); 0 when empty. */
export function quantile(values: readonly number[], q: number): number {
  if (!values.length) return 0
  return values.toSorted((a, b) => a - b)[Math.floor(values.length * q)]!
}

/** The middle value: unlike the mean, one outlier (a slow frame, a key click) does not move it. */
export const median = (values: readonly number[]) => quantile(values, 0.5)
