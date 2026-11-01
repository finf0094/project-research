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
  const media = navigator.mediaDevices
  let stopped = false
  const check = async () => {
    const microphone = stream.getAudioTracks()[0]?.label ?? ''
    // The sound goes to the system's default output; its name says whether that is a headset. Chromium
    // lists it as 'default'; elsewhere the default comes first (Safari lists no outputs at all).
    const outputs = (await media.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'audiooutput')
    const output = (outputs.find((d) => d.deviceId === 'default') ?? outputs[0])?.label ?? ''
    if (stopped) return
    setSignal('virtual_camera', isVirtualCamera(stream))
    setSignal('headphones', isHeadset(microphone) || isHeadset(output))
  }
  void check()
  media.addEventListener('devicechange', check)
  return () => {
    stopped = true
    media.removeEventListener('devicechange', check)
  }
}

const TRACK_EVENTS = ['mute', 'unmute', 'ended']

/** A muted or disconnected microphone (the system's mute, an unplugged headset) is a signal of its own. */
export function watchMicrophone(stream: MediaStream, setSignal: SetSignal) {
  const tracks = stream.getAudioTracks()
  const update = () =>
    setSignal(
      'mic_off',
      tracks.some((t) => t.muted || t.readyState === 'ended'),
    )
  for (const track of tracks) for (const type of TRACK_EVENTS) track.addEventListener(type, update)
  update() // muted already when the exam starts
  return () => {
    for (const track of tracks) for (const type of TRACK_EVENTS) track.removeEventListener(type, update)
  }
}
