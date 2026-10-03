import type { RecentQR, QRPayload, QRStyle } from '../types';
import { removeRecent, clearAllRecent } from '../utils/storage';
import { Clock, Trash2, X } from 'lucide-react';

interface Props {
  items: RecentQR[];
  onRestore: (payload: QRPayload, style: QRStyle) => void;
  onRefresh: () => void;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RecentCodes({ items, onRestore, onRefresh }: Props) {
  if (items.length === 0) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecent(id);
    onRefresh();
  };

  const handleClearAll = () => {
    clearAllRecent();
    onRefresh();
  };

  return (
    <div className="recent-section">
      <div className="recent-card-outer">
        <div className="recent-header">
          <div className="recent-title">
            <Clock size={13} />
            Recent codes
            <span className="recent-count">{items.length}</span>
          </div>
          <button className="recent-clear-btn" onClick={handleClearAll}>
            <Trash2 size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            Clear
          </button>
        </div>
        <div className="recent-scroll">
          {items.map(item => (
            <div key={item.id} className="recent-card" onClick={() => onRestore(item.payload, item.style)}>
              <img src={item.dataUrl} alt="QR Code" loading="lazy" />
              <div className="recent-card-type">{item.payload.type}</div>
              <div className="recent-card-time">{formatTime(item.createdAt)}</div>
              <button className="recent-card-delete" onClick={e => handleDelete(item.id, e)}>
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
