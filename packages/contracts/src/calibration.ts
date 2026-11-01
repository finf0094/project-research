import { z } from 'zod'
import { MarkerKind } from './review.ts'

/** Below this many decisions a kind keeps its usual weight: a few judgements say little. */
export const CALIBRATION_MIN_DECISIONS = 5

/**
 * How often the examiner agreed with markers of one kind (section 25.4): confirmed vs dismissed, and the
 * factor that kind's weight in the review priority gets from it (1 until there are enough decisions).
 */
export const CalibrationRow = z.object({
  kind: MarkerKind,
  confirmed: z.number().int().nonnegative(),
  dismissed: z.number().int().nonnegative(),
  factor: z.number(),
})
export type CalibrationRow = z.infer<typeof CalibrationRow>

/**
 * The calibration page: decisions per kind, and the control sample — reviewed attempts that had no
 * markers, and how many of them the examiner still found to be a violation (what the markers missed).
 */
export const Calibration = z.object({
  kinds: z.array(CalibrationRow),
  control: z.object({ unmarked: z.number().int().nonnegative(), missed: z.number().int().nonnegative() }),
})
export type Calibration = z.infer<typeof Calibration>
