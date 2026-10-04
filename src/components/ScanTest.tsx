import { useCallback, useEffect, useRef, useState } from 'react';
import { decodePixels } from '../engines/verifier';
import { X, Camera, CameraOff, Check, TriangleAlert } from 'lucide-react';

interface Props {
  expected: string;
  onClose: () => void;
}

type Mode = 'off' | 'live' | 'blocked' | 'match' | 'other';

/**
 * Points the device camera at a printed code and decodes the live frame.
 * A browser can prove its own pixels; only this proves paper, ink and glare.
 */
export default function ScanTest({ expected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const busyRef = useRef(false);

  const [mode, setMode] = useState<Mode>('off');
  const [message, setMessage] = useState('Camera is off. Frames never leave this tab.');
  const [decoded, setDecoded] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const finish = useCallback(
    (next: Mode, text: string, note: string) => {
      stop();
      setDecoded(text);
      setMessage(note);
      setMode(next);
    },
    [stop]
  );

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    frameRef.current = requestAnimationFrame(loop);
    if (video.readyState !== video.HAVE_ENOUGH_DATA || busyRef.current) return;

    const side = 420;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const scale = Math.min(side / video.videoWidth, side / video.videoHeight);
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    busyRef.current = true;
    const frame = ctx.getImageData(0, 0, w, h);
    decodePixels(frame.data, w, h, null).then((response) => {
      busyRef.current = false;
      if (!response.decoded) return;
      if (response.decoded === expected) {
        finish('match', response.decoded, 'Payload matches. This print will scan.');
      } else {
        finish('other', response.decoded, 'This is a different code than the one on screen.');
      }
    });
  }, [expected, finish]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode('blocked');
      setMessage('This browser will not give a page camera access.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode('live');
      setMessage('Hold the printed code inside the frame.');
      frameRef.current = requestAnimationFrame(loop);
    } catch {
      setMode('blocked');
      setMessage('Camera blocked. Allow access in your browser, then retry.');
    }
  }, [loop]);

  const restart = () => {
    stop();
    setMode('off');
    setDecoded(null);
    setMessage('Camera is off. Frames never leave this tab.');
    start();
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Camera scan test">
      <div className="modal">
        <div className="modal-head">
          <h3>print test · live decode</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="modal-body">
          <div className="viewport">
            <video ref={videoRef} playsInline muted className={mode === 'live' ? '' : 'off'} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {mode !== 'live' && (
              <div className="ph">{mode === 'blocked' ? <CameraOff size={26} /> : <Camera size={26} />}</div>
            )}
            {mode === 'live' && <div className="reticle" />}
          </div>

          <div className={`status-line ${mode === 'match' ? 'ok' : mode === 'other' ? 'other' : ''}`}>
            {mode === 'match' && <Check size={12} />}
            {mode === 'other' && <TriangleAlert size={12} />}
            <span>{message}</span>
          </div>

          {decoded && <div className="raw-out">{decoded}</div>}

          <div className="modal-foot">
            {(mode === 'off' || mode === 'blocked') && (
              <button type="button" className="cmd primary" onClick={start}>
                <Camera size={12} /> start camera
              </button>
            )}
            {mode === 'match' && (
              <button type="button" className="cmd primary" onClick={restart}>
                scan another
              </button>
            )}
            <button type="button" className="cmd" onClick={onClose}>
              close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}