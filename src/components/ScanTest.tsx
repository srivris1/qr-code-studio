import { useCallback, useEffect, useRef, useState } from 'react';
import { decodePixels } from '../engines/verifier';
import { X, Camera, CameraOff, Check, TriangleAlert } from 'lucide-react';

interface Props {
  expected: string;
  onClose: () => void;
}

/**
 * Points the device camera at a printed code and decodes it live. This is the
 * only honest way to confirm a physical print works — a browser can verify its
 * own pixels, but not the paper, the ink, or the glare.
 */
export default function ScanTest({ expected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const busyRef = useRef(false);

  const [state, setState] = useState<'starting' | 'live' | 'blocked' | 'found' | 'other'>('starting');
  const [message, setMessage] = useState('Camera is off. Nothing leaves your device.');
  const [decoded, setDecoded] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Never leave the camera indicator on if the modal goes away on its own.
  useEffect(() => stop, [stop]);

  const finish = useCallback(
    (next: 'found' | 'other', text: string | null, note: string) => {
      stop();
      setDecoded(text);
      setMessage(note);
      setState(next);
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
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    busyRef.current = true;
    const image = ctx.getImageData(0, 0, w, h);
    decodePixels(image.data, w, h, null).then((response) => {
      busyRef.current = false;
      if (!response.decoded) return;
      if (response.decoded === expected) {
        finish('found', response.decoded, 'Matches the code on screen. Your print will scan.');
      } else {
        finish('other', response.decoded, 'This is a different code than the one being designed.');
      }
    });
  }, [expected, finish]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('blocked');
      setMessage('This browser will not give a web page camera access.');
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
      setState('live');
      setMessage('Hold the printed code inside the frame.');
      frameRef.current = requestAnimationFrame(loop);
    } catch {
      setState('blocked');
      setMessage('Camera blocked. Allow camera access in your browser, then try again.');
    }
  }, [loop]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Camera scan test">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Print test</h3>
          <button className="modal-close" onClick={() => { stop(); onClose(); }} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="scanner-view">
          <video ref={videoRef} playsInline muted className={state === 'live' ? '' : 'hidden'} />
          <canvas ref={canvasRef} className="hidden" />
          {state !== 'live' && (
            <div className="scanner-placeholder">
              {state === 'blocked' ? <CameraOff size={28} /> : <Camera size={28} />}
            </div>
          )}
          {state === 'live' && <div className="scanner-reticle" />}
        </div>

        <div className={`scanner-status ${state}`}>
          {state === 'found' && <Check size={14} />}
          {state === 'other' && <TriangleAlert size={14} />}
          <span>{message}</span>
        </div>

        {decoded && (
          <div className="scanner-decoded">
            <code>{decoded}</code>
          </div>
        )}

        <div className="modal-actions">
          {(state === 'starting' || state === 'blocked') && (
            <button className="download-btn primary" onClick={start}>
              <Camera size={13} /> Start camera
            </button>
          )}
          {state === 'found' && (
            <button
              className="download-btn primary"
              onClick={() => {
                stop();
                setState('starting');
                setDecoded(null);
                setMessage('Camera is off. Nothing leaves your device.');
                start();
              }}
            >
              Scan another
            </button>
          )}
          <button className="download-btn" onClick={() => { stop(); onClose(); }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}