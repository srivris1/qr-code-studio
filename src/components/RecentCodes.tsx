import type { RecentQR, QRPayload, QRStyle } from '../types';
import { removeRecent, clearAllRecent } from '../utils/storage';
import { Clock, Trash2, X } from 'lucide-react';

interface Props {
  items: RecentQR[];
  onRestore: (payload: QRPayload, style: QRStyle) => void;
  onRefresh: () => void;
}

function ago(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function RecentCodes({ items, onRestore, onRefresh }: Props) {
  if (items.length === 0) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecent(id);
    onRefresh();
  };

  return (
    <div className="history">
      <div className="history-head">
        <h3>
          <Clock size={11} /> history <b>{items.length}</b>
        </h3>
        <button type="button" className="cmd sm" onClick={() => { clearAllRecent(); onRefresh(); }}>
          <Trash2 size={10} /> clear
        </button>
      </div>
      <div className="history-scroll">
        {items.map((item) => (
          <div key={item.id} className="hist" onClick={() => onRestore(item.payload, item.style)}>
            <img src={item.dataUrl} alt="Saved QR code" loading="lazy" />
            <div className="meta">
              <span>{item.payload.type}</span>
              <time>{ago(item.createdAt)}</time>
            </div>
            <button type="button" className="hist-x" onClick={(e) => handleDelete(item.id, e)} aria-label="Delete">
              <X size={9} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}