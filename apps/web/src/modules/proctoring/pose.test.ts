import { describe, expect, it } from 'vitest'
import { headPose, isLookingAway } from './pose'

/** A face result with a head rotated by `yawDeg` around the vertical axis and eyes centred. */
function face(yawDeg: number, irisShift = 0) {
  const a = (yawDeg * Math.PI) / 180
  // Column-major rotation about Y: third column = (sin a, 0, cos a).
  const data = [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  landmarks[33] = { x: 0.3, y: 0.5, z: 0 }
  landmarks[133] = { x: 0.4, y: 0.5, z: 0 }
  landmarks[362] = { x: 0.6, y: 0.5, z: 0 }
  landmarks[263] = { x: 0.7, y: 0.5, z: 0 }
  landmarks[468] = { x: 0.35 + irisShift, y: 0.5, z: 0 }
  landmarks[473] = { x: 0.65 + irisShift, y: 0.5, z: 0 }
  return {
    faceLandmarks: [landmarks],
    facialTransformationMatrixes: [{ rows: 4, columns: 4, data }],
  } as never
}

const neutral = { yaw: 0, pitch: 0 }

describe('head pose and gaze', () => {
  it('reads yaw from the transformation matrix', () => {
    expect(headPose(face(40))!.yaw).toBeCloseTo(40)
  })

  it('flags a head turned away, but not relative to a calibrated side camera', () => {
    expect(isLookingAway(face(40), neutral)).toBe(true)
    expect(isLookingAway(face(40), { yaw: 35, pitch: 0 })).toBe(false)
    expect(isLookingAway(face(10), neutral)).toBe(false)
  })

  it('flags eyes turned to the side even with the head straight', () => {
    expect(isLookingAway(face(0, 0.045), neutral)).toBe(true)
    expect(isLookingAway(face(0, 0.01), neutral)).toBe(false)
  })
})
