import { useState } from 'react';
import { CITIES } from '../constants';

function Icon({ name, fill = 0, size = 24, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

export default function AuctionController({ socket, room, myId, auctionState }) {
  const [customBid, setCustomBid] = useState('');

  if (!auctionState) return null;

  const amActive = auctionState.activePlayers?.includes(myId);
  const isWinning = auctionState.highestBidder === myId;
  const isLastPlayer = auctionState.activePlayers?.length <= 1;
  const currentBid = auctionState.currentBid || 0;
  const tile = CITIES[auctionState.propertyId];
  const bidLog = auctionState.bidLog || [];

  const placeBid = (amount) => {
    socket.emit('place_bid', { room, amount });
    if (navigator.vibrate) navigator.vibrate(60);
  };
  const withdraw = () => socket.emit('withdraw_auction', { room });

  // Folded
  if (!amActive) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-8"
        style={{ background: '#fcf9f8', height: '100dvh' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: '#f0eded' }}>
          <Icon name="flag" fill={1} size={32} className="text-[#88717a]" />
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>You Folded</h1>
        <p className="text-sm" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
          Waiting for the auction to end...
        </p>
        <div className="mt-8 w-10 h-10 rounded-full border-2 border-t-[#9e216d]"
          style={{ borderColor: '#dbbfc9', borderTopColor: '#9e216d', animation: 'spin 1.2s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: '#fcf9f8', height: '100dvh' }}>

      {/* App bar */}
      <header className="shrink-0 h-16 flex justify-between items-center px-4"
        style={{ background: '#fff', borderBottom: '1px solid #eae7e7', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <Icon name="gavel" fill={1} size={26} className="text-[#9e216d]" />
        <h1 className="text-lg font-black uppercase tracking-widest" style={{ fontFamily: 'Montserrat', color: '#9e216d' }}>
          Live Auction
        </h1>
        <Icon name="account_balance_wallet" size={26} className="text-[#9e216d]" />
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 flex flex-col gap-3">

        {/* Timer row */}
        <div className="flex justify-center items-center gap-1">
          <Icon name="timer" size={14} className="text-[#ba1a1a]" />
          <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#ba1a1a', fontFamily: 'Plus Jakarta Sans' }}>
            Time Remaining
          </span>
        </div>

        {/* Current bid display */}
        <div className="text-center">
          {isWinning && !isLastPlayer && (
            <div className="inline-flex items-center gap-1 mb-2 px-3 py-1 rounded-full"
              style={{ background: '#d3e4da', color: '#101e19' }}>
              <Icon name="emoji_events" fill={1} size={14} className="text-[#794e00]" />
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ fontFamily: 'Plus Jakarta Sans', color: '#101e19' }}>
                You&apos;re Winning!
              </span>
            </div>
          )}
          <div className="text-5xl font-black" style={{ fontFamily: 'Montserrat', color: '#9e216d' }}>
            ₹{currentBid.toLocaleString()}
          </div>
          <p className="text-xs font-semibold mt-1" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
            Current Highest Bid
          </p>
        </div>

        {/* Property card */}
        {tile && (
          <div className="rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid rgba(158,33,109,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
            {/* Color band */}
            <div className={`h-14 ${tile.color} flex items-center justify-between px-4 relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)' }} />
              <h2 className="text-base font-black uppercase tracking-widest text-white relative z-10"
                style={{ fontFamily: 'Montserrat' }}>{tile.name}</h2>
              <span className="text-sm font-bold px-2 py-0.5 rounded text-white relative z-10"
                style={{ background: 'rgba(0,0,0,0.2)' }}>₹{tile.price}</span>
            </div>
            {/* Rent table */}
            <div className="px-3 py-2 flex flex-col gap-1 relative">
              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <Icon name="location_city" fill={1} size={80} className="text-[#52625a]" />
              </div>
              {(tile.rent || []).slice(0, 4).map((r, i) => (
                <div key={i} className="flex justify-between py-0.5 relative z-10"
                  style={{ borderBottom: i < 3 ? '1px solid #eae7e7' : 'none' }}>
                  <span className="text-xs" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
                    {i === 0 ? 'Rent' : i < 5 ? `${i} House${i > 1 ? 's' : ''}` : 'Hotel'}
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#1b1c1c', fontFamily: 'Plus Jakarta Sans' }}>₹{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highest bidder chip */}
        {auctionState.highestBidder && (
          <div className="rounded-xl flex items-center justify-between p-3"
            style={{ background: '#f0eded', border: '1px solid #dbbfc9' }}>
            <div className="flex items-center gap-1">
              <Icon name="local_fire_department" fill={1} size={16} className="text-[#794e00]" />
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
                Highest Bid
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black" style={{ fontFamily: 'Montserrat', color: '#9e216d' }}>
                ₹{currentBid.toLocaleString()}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: '#ffddb4', color: '#291800', fontFamily: 'Plus Jakarta Sans' }}>
                {isWinning ? 'You' : (auctionState.highestBidderName || 'P?')}
              </span>
            </div>
          </div>
        )}

        {/* Bid log */}
        {bidLog.length > 0 && (
          <div className="rounded-xl overflow-hidden"
            style={{ background: '#f6f3f2', border: '1px solid #eae7e7', maxHeight: 140 }}>
            <div className="sticky top-0 px-3 py-1.5 text-center text-xs font-extrabold uppercase tracking-widest"
              style={{ background: '#f0eded', borderBottom: '1px solid #eae7e7', color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
              Recent Activity
            </div>
            <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 100 }}>
              {bidLog.slice(-4).reverse().map((entry, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2"
                  style={{ borderBottom: '1px solid #eae7e7', background: entry.id === myId ? 'rgba(158,33,109,0.06)' : '#f6f3f2' }}>
                  <span className="text-xs font-extrabold w-6 text-center"
                    style={{ color: '#9e216d', fontFamily: 'Plus Jakarta Sans' }}>
                    {entry.name?.charAt(0)}
                  </span>
                  <span className="flex-1 text-xs" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
                    {entry.name} bid
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#1b1c1c', fontFamily: 'Plus Jakarta Sans' }}>
                    ₹{entry.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bid buttons */}
        {(!isWinning || isLastPlayer) && (
          <div className="flex flex-col gap-2 mt-1">
            {/* +10 */}
            <button onClick={() => placeBid(10)}
              className="w-full py-4 rounded-xl btn-press flex flex-col items-center"
              style={{ background: '#d3e4da', border: '2px solid #bacac1', boxShadow: '0 3px 0 0 #bacac1' }}>
              <span className="text-2xl font-black" style={{ fontFamily: 'Montserrat', color: '#101e19' }}>+ ₹10</span>
              <span className="text-xs font-bold" style={{ color: '#52625a', fontFamily: 'Plus Jakarta Sans' }}>
                → Total: ₹{(currentBid + 10).toLocaleString()}
              </span>
            </button>
            {/* +50 */}
            <button onClick={() => placeBid(50)}
              className="w-full py-3.5 rounded-xl btn-press flex flex-col items-center"
              style={{ background: '#ffd8e7', border: '2px solid #ffafd4', boxShadow: '0 3px 0 0 #ffafd4' }}>
              <span className="text-xl font-black" style={{ fontFamily: 'Montserrat', color: '#3d0026' }}>+ ₹50</span>
              <span className="text-xs font-bold" style={{ color: '#88095c', fontFamily: 'Plus Jakarta Sans' }}>
                Aggressive → ₹{(currentBid + 50).toLocaleString()}
              </span>
            </button>
            {/* +100 */}
            <button onClick={() => placeBid(100)}
              className="w-full py-3 rounded-xl btn-press flex flex-col items-center"
              style={{ background: '#9e216d', border: 'none', boxShadow: '0 3px 0 0 #6c164a, 0 8px 20px rgba(158,33,109,0.25)' }}>
              <span className="text-lg font-black text-white" style={{ fontFamily: 'Montserrat' }}>+ ₹100</span>
              <span className="text-xs font-bold text-pink-200" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Dominate → ₹{(currentBid + 100).toLocaleString()}
              </span>
            </button>
            {/* Custom bid */}
            <div className="flex gap-2">
              <input type="number" min="10" step="10" placeholder="Custom ₹..."
                value={customBid} onChange={e => setCustomBid(e.target.value)}
                className="flex-1 rounded-xl px-4 py-3 text-base font-semibold outline-none"
                style={{ background: '#f0eded', border: '2px solid #dbbfc9', color: '#1b1c1c', fontFamily: 'Plus Jakarta Sans' }}
              />
              <button
                onClick={() => { if (Number(customBid) > 0) { placeBid(Number(customBid)); setCustomBid(''); } }}
                disabled={!customBid || Number(customBid) <= 0}
                className="px-5 rounded-xl font-black text-sm btn-press disabled:opacity-40"
                style={{ background: '#9e216d', color: '#fff', fontFamily: 'Montserrat', boxShadow: '0 3px 0 0 #6c164a' }}>
                BID
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Withdraw / Fold */}
      {!isLastPlayer && (
        <div className="shrink-0 px-4 pb-8 pt-2" style={{ background: '#fff', borderTop: '1px solid #eae7e7' }}>
          <button onClick={withdraw}
            className="w-full py-3.5 rounded-xl font-bold text-sm btn-press flex items-center justify-center gap-2"
            style={{ background: '#f6f3f2', color: '#55414a', fontFamily: 'Plus Jakarta Sans', border: '1px solid #dbbfc9' }}>
            <Icon name="flag" fill={1} size={18} className="text-[#88717a]" />
            Withdraw / Fold
          </button>
        </div>
      )}
    </div>
  );
}