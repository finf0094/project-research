import type { MarkerKind, MarkerStatus } from '@exam/contracts'
import {
  CameraOff,
  ClipboardPaste,
  EyeOff,
  FileWarning,
  Headphones,
  RefreshCw,
  VideoOff,
  Copy,
  Focus,
  MicOff,
  Monitor,
  Link2Off,
  Moon,
  PanelTop,
  ScanFace,
  Smartphone,
  Users,
  Volume2,
  WifiOff,
} from 'lucide-vue-next'

/** One icon per marker kind, the same on the list, the stage caption and anywhere else markers show. */
export const MARKER_ICON: Record<MarkerKind, typeof ScanFace> = {
  face_missing: ScanFace,
  multiple_faces: Users,
  too_dark: Moon,
  noise: Volume2,
  tab_hidden: PanelTop,
  camera_off: CameraOff,
  paste: ClipboardPaste,
  looking_away: EyeOff,
  object_detected: Smartphone,
  off_center: Focus,
  copy: Copy,
  second_screen: Monitor,
  mic_off: MicOff,
  chain_broken: Link2Off,
  missing_fragment: FileWarning,
  offline: WifiOff,
  headphones: Headphones,
  virtual_camera: VideoOff,
  page_closed: RefreshCw,
}

/** The tile colour follows the examiner's judgement, not the kind: what still needs a look stands out. */
export const MARKER_TONE: Record<MarkerStatus, 'peach' | 'danger' | 'ok' | 'sky'> = {
  pending: 'peach',
  confirmed: 'danger',
  dismissed: 'ok',
  context: 'sky',
}
