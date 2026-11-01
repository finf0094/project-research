import type { SetSignal } from './signals'

/** Names of headphones and headsets (as systems label them, English and Russian). "Buds2" too. */
const HEADPHONES = /head(phone|set)|ear(phone|bud)|airpods|\bbuds|hands-?free|наушник|гарнитур/i
/** A laptop's built-in jack (Windows: "Speakers/Headphones (Realtek)") is named so with nothing plugged in. */
const SHARED_JACK = /speakers?\s*\/\s*headphones|динамики\s*\/\s*наушники/gi
const isHeadset = (label: string) => HEADPHONES.test(label.replace(SHARED_JACK, ''))
/** Names of cameras that are programs, not devices: they can show a recording or another person. */
const VIRTUAL =
  /virtual|\bobs\b|manycam|snap camera|xsplit|droidcam|epoccam|\bcamo\b|mmhmm|splitcam|youcam|e2esoft|vcam/i

export const isVirtualCamera = (stream: MediaStream) => VIRTUAL.test(stream.getVideoTracks()[0]?.label ?? '')

/**
 * Headphones and a virtual camera, by the names of the devices in use (the browser shows them once the
 * camera is allowed). Checked at the start and whenever a device is plugged in or out. Names are all a
 * browser gives, so a device with an unusual name goes unnoticed: that is a hint for the examiner, not a
 * proof. Returns a function that stops watching.
 */
export function watchDevices(stream: MediaStream, setSignal: SetSignal) {
  // Missing in some embedded browsers: then only the names of the tracks in use are checked.
  const media = navigator.mediaDevices as MediaDevices | undefined
  let stopped = false
  const check = async () => {
    const microphone = stream.getAudioTracks()[0]?.label ?? ''
    // The sound goes to the system's default output; its name says whether that is a headset. Chromium
    // lists it as 'default'; elsewhere the default comes first (Safari lists no outputs at all).
    const outputs = ((await media?.enumerateDevices().catch(() => [])) ?? []).filter(
      (d) => d.kind === 'audiooutput',
    )
    const output = (outputs.find((d) => d.deviceId === 'default') ?? outputs[0])?.label ?? ''
    if (stopped) return
    setSignal('virtual_camera', isVirtualCamera(stream))
    setSignal('headphones', isHeadset(microphone) || isHeadset(output))
  }
  void check()
  media?.addEventListener('devicechange', check)
  return () => {
    stopped = true
    media?.removeEventListener('devicechange', check)
  }
}

const TRACK_EVENTS = ['mute', 'unmute', 'ended']
/**
 * iOS Safari reports a microphone track muted for a moment at the start and around audio-session changes;
 * only a mute that lasts counts. An ended track counts at once.
 */
const MUTE_GRACE_MS = 2000

/**
 * Tracks of `kind`'s device muted for a while (or ended, when `ended` counts) turn `kind` on. A mute while
 * the page is hidden does not count: iPhone mutes camera and microphone of every page in the background
 * (that is "tab hidden" already), and the unmute may come only after the grace ran out on return.
 */
function watchMuted(
  tracks: MediaStreamTrack[],
  kind: 'mic_off' | 'camera_off',
  countEnded: boolean,
  setSignal: SetSignal,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const ended = () => countEnded && tracks.some((t) => t.readyState === 'ended')
  const muted = () => tracks.some((t) => t.muted)
  const hidden = () => document.visibilityState === 'hidden'
  const update = () => {
    clearTimeout(timer)
    if (ended()) return setSignal(kind, true)
    if (!muted() || hidden()) return setSignal(kind, false)
    timer = setTimeout(() => setSignal(kind, ended() || (muted() && !hidden())), MUTE_GRACE_MS)
  }
  for (const track of tracks) for (const type of TRACK_EVENTS) track.addEventListener(type, update)
  document.addEventListener('visibilitychange', update)
  update() // muted already when the exam starts
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', update)
    for (const track of tracks) for (const type of TRACK_EVENTS) track.removeEventListener(type, update)
  }
}

/** A muted or disconnected microphone (the system's mute, an unplugged headset) is a signal of its own. */
export const watchMicrophone = (stream: MediaStream, setSignal: SetSignal) =>
  watchMuted(stream.getAudioTracks(), 'mic_off', true, setSignal)

/**
 * A camera the system keeps from the page (another app took it, a privacy switch, iPad split view) mutes its
 * track: the picture freezes on the last frame, which would read as the student sitting still. An ended
 * camera is the store's (it restarts it), so only a lasting mute counts here.
 */
export const watchCameraMute = (stream: MediaStream, setSignal: SetSignal) =>
  watchMuted(stream.getVideoTracks(), 'camera_off', false, setSignal)
