import { describe, expect, it } from 'vitest'
import { countFaces, headPose, isFramed, isInOval, isLookingAway } from './pose'

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

describe('a face in the picture', () => {
  const outline = (chinY: number) => {
    const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
    points[10] = { x: 0.5, y: 0.2 }
    points[152] = { x: 0.5, y: chinY }
    points[234] = { x: 0.3, y: 0.5 }
    points[454] = { x: 0.7, y: 0.5 }
    return points
  }

  it('counts only a face wholly in the picture', () => {
    expect(isFramed(outline(0.8))).toBe(true)
    expect(isFramed(outline(1.25))).toBe(false) // the chin below the picture: only the forehead is seen
    expect(countFaces([outline(1.25)])).toBe(0)
    expect(countFaces([outline(0.8)])).toBe(1)
  })

  it('still counts a second person even when cut off', () => {
    expect(countFaces([outline(0.8), outline(1.25)])).toBe(2)
  })

  it('knows whether the face sits in the oval, close enough to the camera', () => {
    const at = (cx: number, top: number, chin: number) => {
      const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
      points[10] = { x: cx, y: top }
      points[152] = { x: cx, y: chin }
      points[234] = { x: cx - 0.12, y: (top + chin) / 2 }
      points[454] = { x: cx + 0.12, y: (top + chin) / 2 }
      return points
    }
    const view = 4 / 3
    expect(isInOval(at(0.5, 0.2, 0.75), view)).toBe(true) // centred, near
    expect(isInOval(at(0.85, 0.2, 0.75), view)).toBe(false) // moved to the side
    expect(isInOval(at(0.5, 0.4, 0.55), view)).toBe(false) // sat far back: a small face
  })

  it('judges the oval in what the student sees, whatever the camera frame is shaped like', () => {
    const at = (cx: number, top: number, chin: number) => {
      const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
      points[10] = { x: cx, y: top }
      points[152] = { x: cx, y: chin }
      points[234] = { x: cx - 0.1, y: (top + chin) / 2 }
      points[454] = { x: cx + 0.1, y: (top + chin) / 2 }
      return points
    }
    // A phone held upright (360×640): the view shows the middle 42% of the height, so a face of 22% of
    // the raw frame fills the oval.
    expect(isInOval(at(0.5, 0.39, 0.61), 360 / 640)).toBe(true)
    expect(isInOval(at(0.5, 0.15, 0.37), 360 / 640)).toBe(false) // at the top edge of what is shown
    // A 16:9 laptop camera: the view drops the sides, so a face at x 0.69 of the raw frame is at its edge.
    expect(isInOval(at(0.69, 0.2, 0.75), 16 / 9)).toBe(false)
  })
})
