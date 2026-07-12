import { useMemo, useState } from 'react';
import { CITIES } from '../constants';
import TokenIcon from '../components/TokenIcon';

const TILE_COLOR_HEX = {
  'bg-amber-900': '#78350f',
  'bg-sky-400': '#38bdf8',
  'bg-pink-500': '#ec4899',
  'bg-orange-400': '#fb923c',
  'bg-red-600': '#dc2626',
  'bg-yellow-500': '#eab308',
  'bg-green-600': '#16a34a',
  'bg-blue-800': '#1e40af',
  'bg-gray-800': '#1f2937',
  'bg-yellow-400': '#facc15',
  'bg-blue-400': '#60a5fa',
};

const headingFont = { fontFamily: "'Montserrat', sans-serif" };
const bodyFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

function Icon({ name, size = 18, fill = 0, className = '' }) {
  return (
    <span className={`material-symbols-outlined select-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}` }}>
      {name}
    </span>
  );
}

function tileHex(tile) {
  if (!tile?.color) return '#4b5563';
  for (const [cls, hex] of Object.entries(TILE_COLOR_HEX)) {
    if (tile.color.includes(cls)) return hex;
  }
  return '#4b5563';
}

// ── Tap-to-toggle property chip grid ─────────────────────────────────────────
function PropertyChipGrid({ propertyIds, gameState, selectedIds, onToggle, emptyText }) {
  if (!propertyIds || propertyIds.length === 0) {
    return <p className="text-xs italic py-2" style={{ color: '#88717a', ...bodyFont }}>{emptyText}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {propertyIds.map(id => {
        const tile = CITIES[id];
        if (!tile) return null;
        const state = gameState?.boardState?.[id] || {};
        const houses = state.houses || 0;
        const mortgaged = !!state.mortgaged;
        const locked = houses > 0; // official rule: sell buildings before trading
        const selected = selectedIds.includes(id);
        return (
          <button key={id} disabled={locked} onClick={() => onToggle(id)}
            className="chip-toggle relative rounded-xl overflow-hidden text-left"
            style={{
              background: selected ? '#ffeff6' : '#fff',
              border: selected ? '2px solid #9e216d' : '2px solid #eae7e7',
              opacity: locked ? 0.45 : 1,
              boxShadow: selected ? '0 0 12px rgba(158,33,109,0.25)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}>
            <div className="h-1.5 w-full" style={{ background: tileHex(tile) }} />
            <div className="px-2 pt-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold leading-tight truncate" style={{ color: '#1b1c1c', ...bodyFont }}>
                {tile.name}
              </span>
              {selected && <Icon name="check_circle" fill={1} size={14} className="text-[#9e216d] shrink-0" />}
            </div>
            <div className="px-2 pb-1.5 pt-0.5 flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-bold" style={{ color: '#88717a', ...bodyFont }}>₹{tile.price}</span>
              {mortgaged && (
                <span className="text-[8px] px-1 rounded font-extrabold" style={{ background: '#ffdad6', color: '#ba1a1a' }}>MORTGAGED</span>
              )}
              {locked && (
                <span className="text-[8px] px-1 rounded font-extrabold" style={{ background: '#ffddb4', color: '#78350f' }}>
                  {houses === 5 ? 'HOTEL' : `${houses} HOUSE${houses > 1 ? 'S' : ''}`}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Cash input with quick-add steppers ───────────────────────────────────────
function CashRow({ value, max, onChange }) {
  const clamp = v => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return (
    <div className="flex items-center gap-1.5">
      <input type="number" min="0" max={max} inputMode="numeric" value={value}
        onChange={e => onChange(clamp(e.target.value))}
        className="flex-1 min-w-0 rounded-xl p-2.5 border font-mono font-bold text-sm"
        style={{ background: '#f0eded', borderColor: '#dbbfc9', color: '#1b1c1c' }} />
      {[50, 100, 500].map(step => (
        <button key={step} onClick={() => onChange(clamp(Number(value) + step))}
          className="chip-toggle px-2 py-2.5 rounded-xl text-[10px] font-extrabold shrink-0"
          style={{ background: '#fff', border: '1px solid #dbbfc9', color: '#55414a', ...bodyFont }}>
          +{step}
        </button>
      ))}
    </div>
  );
}

// ── Get Out of Jail Free card stepper ────────────────────────────────────────
function JailCardStepper({ label, value, max, onChange }) {
  if (max <= 0) return null;
  const btnStyle = {
    background: '#fff', border: '1px solid #ffddb4', color: '#78350f',
    ...headingFont,
  };
  return (
    <div className="flex items-center justify-between mt-3 px-3 py-2 rounded-xl"
      style={{ background: '#fff7e6', border: '1px solid #ffddb4' }}>
      <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1"
        style={{ color: '#78350f', ...bodyFont }}>
        <Icon name="key" fill={1} size={14} className="text-[#a15c07]" />
        {label} ({max})
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(0, value - 1))}
          className="chip-toggle w-7 h-7 rounded-full font-black text-sm" style={btnStyle}>−</button>
        <span className="w-4 text-center font-black text-sm" style={{ color: '#1b1c1c', ...headingFont }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          className="chip-toggle w-7 h-7 rounded-full font-black text-sm" style={btnStyle}>+</button>
      </div>
    </div>
  );
}

// ── Main Trade Interface ─────────────────────────────────────────────────────
export default function TradeInterface({ socket, gameState, me, room = 'ABCD' }) {
  const [targetId, setTargetId] = useState('');
  const [offerPropertyIds, setOfferPropertyIds] = useState([]);
  const [requestPropertyIds, setRequestPropertyIds] = useState([]);
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerJailCards, setOfferJailCards] = useState(0);
  const [requestJailCards, setRequestJailCards] = useState(0);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const otherPlayers = gameState?.players.filter(p => p.id !== me.id && !p.bankrupt) || [];
  const targetPlayer = otherPlayers.find(p => p.id === targetId);

  const toggleIn = (setList) => (id) =>
    setList(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));

  const selectTarget = (id) => {
    setTargetId(id);
    setRequestPropertyIds([]);
    setRequestCash(0);
    setRequestJailCards(0);
    setError(null);
  };

  // Deal value estimate: face price (½ if mortgaged) + cash + ₹50 per jail card
  const sideValue = (propIds, cash, jailCards) =>
    propIds.reduce((sum, id) => {
      const tile = CITIES[id];
      if (!tile) return sum;
      const mortgaged = gameState?.boardState?.[id]?.mortgaged;
      return sum + (mortgaged ? Math.floor(tile.price / 2) : tile.price);
    }, 0) + Number(cash || 0) + jailCards * 50;

  const offerValue = useMemo(
    () => sideValue(offerPropertyIds, offerCash, offerJailCards),
    [offerPropertyIds, offerCash, offerJailCards, gameState]);
  const requestValue = useMemo(
    () => sideValue(requestPropertyIds, requestCash, requestJailCards),
    [requestPropertyIds, requestCash, requestJailCards, gameState]);

  const isEmpty = offerPropertyIds.length === 0 && requestPropertyIds.length === 0 &&
    !Number(offerCash) && !Number(requestCash) && !offerJailCards && !requestJailCards;

  const handleSendOffer = () => {
    if (!targetPlayer) return setError('Select a player to trade with.');
    if (isEmpty) return setError('Add at least one item to the trade.');
    if (Number(offerCash) > me.cash) return setError("You don't have that much cash.");
    if (Number(requestCash) > (targetPlayer.cash || 0)) return setError(`${targetPlayer.name} doesn't have that much cash.`);

    socket.emit('initiate_trade', {
      room,
      targetId,
      offerCash: Number(offerCash),
      requestCash: Number(requestCash),
      offerPropertyIds: offerPropertyIds.map(Number),
      requestPropertyIds: requestPropertyIds.map(Number),
      offerJailCards,
      requestJailCards,
    });

    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
    setError(null);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setTargetId('');
      setOfferPropertyIds([]); setRequestPropertyIds([]);
      setOfferCash(0); setRequestCash(0);
      setOfferJailCards(0); setRequestJailCards(0);
    }, 2200);
  };

  const labelStyle = { color: '#55414a', ...bodyFont };

  return (
    <div className="flex flex-col gap-4" style={{ color: '#1b1c1c', ...bodyFont }}>
      {/* ── Title ──────────────────────────────────────────── */}
      <h3 className="text-xl font-black uppercase text-center flex items-center justify-center gap-2"
        style={{ color: '#9e216d', ...headingFont }}>
        <Icon name="handshake" size={24} />
        Trade
      </h3>

      {/* ── Target player chips ───────────────────────────── */}
      <div>
        <label className="block text-xs font-bold uppercase mb-1.5" style={labelStyle}>Trade With</label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {otherPlayers.map(p => {
            const active = p.id === targetId;
            return (
              <button key={p.id} onClick={() => selectTarget(p.id)}
                className="chip-toggle flex items-center gap-2 px-3 py-2 rounded-xl shrink-0"
                style={{
                  background: active ? '#ffeff6' : '#fff',
                  border: active ? '2px solid #9e216d' : '2px solid #eae7e7',
                  boxShadow: active ? '0 0 12px rgba(158,33,109,0.2)' : 'none',
                }}>
                <TokenIcon color={p.color} size={20} />
                <div className="text-left">
                  <p className="text-[11px] font-black leading-none" style={{ color: '#1b1c1c', ...headingFont }}>{p.name}</p>
                  <p className="text-[10px] font-bold leading-none mt-0.5" style={{ color: '#9e216d' }}>₹{p.cash.toLocaleString()}</p>
                </div>
              </button>
            );
          })}
          {otherPlayers.length === 0 && (
            <p className="text-xs italic py-2" style={{ color: '#88717a' }}>No other players to trade with.</p>
          )}
        </div>
      </div>

      {targetPlayer && (
        <>
          {/* ── YOU OFFER ────────────────────────────────────── */}
          <div className="p-4 rounded-2xl border animate-slide-down"
            style={{ backgroundColor: '#d3e4da', borderColor: '#a3c4ad' }}>
            <h4 className="font-black uppercase text-sm mb-3 flex items-center gap-1.5"
              style={{ color: '#2e5e3f', ...headingFont }}>
              <Icon name="upload" size={18} className="text-[#2e5e3f]" />
              You Offer
            </h4>

            <label className="block text-xs font-bold uppercase mb-1.5" style={labelStyle}>
              Your Properties — tap to add
            </label>
            <PropertyChipGrid
              propertyIds={me.properties}
              gameState={gameState}
              selectedIds={offerPropertyIds}
              onToggle={toggleIn(setOfferPropertyIds)}
              emptyText="You don't own any properties yet."
            />

            <label className="block text-xs font-bold uppercase mb-1.5 mt-3" style={labelStyle}>
              Your Cash — you have ₹{me.cash.toLocaleString()}
            </label>
            <CashRow value={offerCash} max={me.cash} onChange={setOfferCash} />

            <JailCardStepper
              label="Your Jail Cards"
              value={offerJailCards}
              max={me.getOutOfJailCards || 0}
              onChange={setOfferJailCards}
            />
          </div>

          {/* ── YOU REQUEST ──────────────────────────────────── */}
          <div className="p-4 rounded-2xl border animate-slide-down"
            style={{ backgroundColor: '#ffd8e7', borderColor: '#e8a8c0' }}>
            <h4 className="font-black uppercase text-sm mb-3 flex items-center gap-1.5"
              style={{ color: '#9e216d', ...headingFont }}>
              <Icon name="download" size={18} className="text-[#9e216d]" />
              You Request
            </h4>

            <label className="block text-xs font-bold uppercase mb-1.5" style={labelStyle}>
              {targetPlayer.name}&apos;s Properties — tap to add
            </label>
            <PropertyChipGrid
              propertyIds={targetPlayer.properties}
              gameState={gameState}
              selectedIds={requestPropertyIds}
              onToggle={toggleIn(setRequestPropertyIds)}
              emptyText={`${targetPlayer.name} doesn't own any properties yet.`}
            />

            <label className="block text-xs font-bold uppercase mb-1.5 mt-3" style={labelStyle}>
              Their Cash — they have ₹{targetPlayer.cash.toLocaleString()}
            </label>
            <CashRow value={requestCash} max={targetPlayer.cash} onChange={setRequestCash} />

            <JailCardStepper
              label={`${targetPlayer.name}'s Jail Cards`}
              value={requestJailCards}
              max={targetPlayer.getOutOfJailCards || 0}
              onChange={setRequestJailCards}
            />
          </div>

          {/* ── Deal summary bar ─────────────────────────────── */}
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between animate-slide-down"
            style={{ background: '#fff', border: '1px solid #eae7e7', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div className="text-center">
              <p className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: '#2e5e3f' }}>You Give</p>
              <p className="text-base font-black" style={{ color: '#1b1c1c', ...headingFont }}>≈ ₹{offerValue.toLocaleString()}</p>
            </div>
            <Icon name="swap_horiz" size={22} className="text-[#88717a]" />
            <div className="text-center">
              <p className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: '#9e216d' }}>You Get</p>
              <p className="text-base font-black" style={{ color: '#1b1c1c', ...headingFont }}>≈ ₹{requestValue.toLocaleString()}</p>
            </div>
          </div>

          {/* ── Inline error ─────────────────────────────────── */}
          {error && (
            <p className="text-[11px] font-bold text-center px-3 py-2 rounded-xl animate-slide-down"
              style={{ background: '#ffdad6', color: '#ba1a1a' }}>
              {error}
            </p>
          )}

          {/* ── SEND OFFER ───────────────────────────────────── */}
          <button
            onClick={handleSendOffer}
            disabled={isEmpty || sent}
            className="w-full p-4 rounded-2xl font-black uppercase tracking-widest text-lg flex items-center justify-center gap-2 btn-press disabled:opacity-50"
            style={{
              backgroundColor: sent ? '#2e7d32' : '#9e216d',
              color: '#ffffff',
              boxShadow: sent ? '0 3px 0 0 #1b5e20' : '0 3px 0 0 #6c164a',
              ...headingFont,
            }}>
            {sent ? (<>Offer Sent <Icon name="check_circle" fill={1} size={22} /></>)
              : (<>Send Offer <Icon name="send" size={22} /></>)}
          </button>
        </>
      )}
    </div>
  );
}
