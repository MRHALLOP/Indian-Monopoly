import { useState, useEffect, useRef } from 'react';
import AuctionController from './AuctionController';
import PropertyManager from './PropertyManager';
import TradeInterface from './TradeInterface';
import PropertyViewer from './PropertyViewer';
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
};

// ── Icon helper (Material Symbols) ──────────────────────────────────────────
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

// ── Room code generator (unambiguous chars: no O/0, I/1) ───────────────────
function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ── Mode Select (mobile controller landing screen) ──────────────────────
function ModeSelectScreen({ onStartNew, onJoin }) {
  const [step, setStep] = useState('menu'); // 'menu' | 'join'
  const [subtitle, setSubtitle] = useState('');
  const [code, setCode] = useState('');
  if (step === 'join') {
    return (
      <div className="flex flex-col justify-center px-6 gap-4" style={{ background: '#fcf9f8', height: '100dvh' }}>
        <button onClick={() => { setStep('menu'); setCode(''); }}
          className="self-start text-sm font-bold flex items-center gap-1"
          style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
          <Icon name="arrow_back" size={18} /> Back
        </button>
        <h1 className="text-2xl font-black uppercase tracking-widest" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
          {subtitle || 'Join a Game'}
        </h1>
        <p className="text-sm" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
          Enter the 4-character room code shown on the host's screen.
        </p>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
          placeholder="CODE"
          maxLength={4}
          className="w-full py-4 rounded-2xl border-2 text-center text-3xl font-black uppercase outline-none"
          style={{ borderColor: '#dbbfc9', background: '#fff', color: '#1b1c1c', fontFamily: 'Montserrat', letterSpacing: '0.4em' }}
        />
        <button
          disabled={code.length < 4}
          onClick={() => onJoin(code)}
          className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-white btn-press disabled:opacity-40"
          style={{ background: '#9e216d', fontFamily: 'Montserrat', boxShadow: '0 4px 0 0 #6c164a' }}>
          Continue
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-center px-6 gap-4" style={{ background: '#fcf9f8', height: '100dvh' }}>
      <div className="flex flex-col items-center mb-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: '#9e216d', boxShadow: '0 8px 24px rgba(158,33,109,0.3)' }}>
          <Icon name="casino" fill={1} size={36} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-center" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>Indian Monopoly</h1>
        <p className="text-sm text-center mt-1" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>Choose how to play</p>
      </div>
      <button onClick={onStartNew}
        className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-white btn-press flex items-center justify-center gap-2"
        style={{ background: '#9e216d', fontFamily: 'Montserrat', boxShadow: '0 4px 0 0 #6c164a, 0 8px 24px rgba(158,33,109,0.3)' }}>
        <Icon name="add_circle" fill={1} size={22} className="text-white" /> Start New Game
      </button>
      <button onClick={() => { setSubtitle('Join a Game'); setStep('join'); }}
        className="w-full py-5 rounded-2xl font-black uppercase tracking-widest btn-press flex items-center justify-center gap-2"
        style={{ background: '#fff', border: '2px solid #eae7e7', color: '#1b1c1c', fontFamily: 'Montserrat', boxShadow: '0 4px 0 0 #dbbfc9' }}>
        <Icon name="group_add" size={22} className="text-[#52625a]" /> Join a Game
      </button>
      <button onClick={() => { setSubtitle('Join Previous Game'); setStep('join'); }}
        className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest btn-press flex items-center justify-center gap-2"
        style={{ background: 'transparent', border: '2px dashed #dbbfc9', color: '#55414a', fontFamily: 'Montserrat' }}>
        <Icon name="history" size={20} className="text-[#88717a]" /> Join Previous Game
      </button>
      <p className="text-center text-xs mt-2" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
        "Previous" lets you rejoin an in-progress game and pick your old player from the reclaim list.
      </p>
    </div>
  );
}

// ── Raise Money Screen ───────────────────────────────────────────────────────
function RaiseMoneyScreen({ socket, gameState, me, room = 'ABCD' }) {
  const debt = Math.abs(me?.cash < 0 ? me.cash : 0);
  return (
    <div className="flex flex-col overflow-hidden" style={{ background: '#fff', height: '100dvh' }}>
      {/* Header */}
      <header className="px-4 pt-4 pb-3" style={{ background: '#ffdad6', borderBottom: '1px solid #ffdad6' }}>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="warning" fill={1} size={20} className="text-[#ba1a1a]" />
          <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#ba1a1a', fontFamily: 'Plus Jakarta Sans' }}>
            Payment Due
          </span>
        </div>
        <div className="text-5xl font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
          ₹{Math.abs(me?.cash || 0).toLocaleString()}
        </div>
        <p className="text-sm mt-1" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
          Raise funds to continue playing.
        </p>
      </header>

      {/* Cash status */}
      <div className="flex justify-between items-center px-4 py-3" style={{ background: '#f6f3f2', borderBottom: '1px solid #eae7e7' }}>
        <div className="flex items-center gap-2">
          <Icon name="account_balance_wallet" size={18} className="text-[#52625a]" />
          <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#52625a', fontFamily: 'Plus Jakarta Sans' }}>Your Cash</span>
        </div>
        <span className="text-lg font-bold" style={{ fontFamily: 'Montserrat', color: me?.cash < 0 ? '#ba1a1a' : '#1b1c1c' }}>
          ₹{(me?.cash || 0).toLocaleString()}
        </span>
      </div>

      {/* Property list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
        <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
          <Icon name="handyman" size={14} className="mr-1" />
          Sell Houses &amp; Mortgage
        </p>
        {(me?.properties || []).map(propId => {
          const tile = CITIES[propId];
          if (!tile) return null;
          const state = gameState?.boardState[propId] || {};
          const houses = state.houses || 0;
          const isMortgaged = state.mortgaged;
          const houseCost = tile.houseCost || Math.floor(tile.price / 2);
          const sellValue = Math.floor(houseCost / 2);
          const mortgageValue = Math.floor(tile.price / 2);
          return (
            <div key={propId} className="mb-3 rounded-xl overflow-hidden" style={{
              background: '#fff', border: '1px solid #eae7e7',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', opacity: isMortgaged ? 0.6 : 1
            }}>
              <div className={`h-2 w-full ${tile.color}`} />
              <div className="p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm uppercase tracking-wide" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>{tile.name}</span>
                  <div className="flex gap-1">
                    {[...Array(Math.min(houses, 4))].map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-sm bg-green-500" />)}
                    {houses === 5 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: '#ba1a1a' }}>H</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {houses > 0 && (
                    <button onClick={() => socket.emit('manage_property', { room: room, action: 'SELL_HOUSE', propertyId: propId })}
                      className="flex-1 py-2.5 rounded-lg font-bold text-sm btn-press"
                      style={{ background: '#ffddb4', color: '#291800', fontFamily: 'Plus Jakarta Sans' }}>
                      Sell House +₹{sellValue}
                    </button>
                  )}
                  {!isMortgaged && houses === 0 && (
                    <button onClick={() => socket.emit('manage_property', { room: room, action: 'MORTGAGE', propertyId: propId })}
                      className="flex-1 py-2.5 rounded-lg font-bold text-sm btn-press"
                      style={{ background: '#d3e4da', color: '#101e19', fontFamily: 'Plus Jakarta Sans' }}>
                      Mortgage +₹{mortgageValue}
                    </button>
                  )}
                  {isMortgaged && (
                    <div className="flex-1 py-2.5 rounded-lg text-sm text-center" style={{ background: '#f0eded', color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
                      Already Mortgaged
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {(me?.properties || []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: '#88717a' }}>
            <Icon name="do_not_disturb" size={40} className="mb-2 opacity-40" />
            <p className="text-sm font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>No properties to sell</p>
          </div>
        )}
      </div>

      {/* Give up */}
      <div className="px-4 pb-8 pt-3" style={{ background: '#fff', borderTop: '1px solid #eae7e7' }}>
        <button onClick={() => socket.emit('declare_bankruptcy', { room })}
          className="w-full py-3.5 rounded-xl font-bold uppercase tracking-widest btn-press flex items-center justify-center gap-2"
          style={{ background: '#ffdad6', color: '#ba1a1a', fontFamily: 'Montserrat', fontSize: 14, border: '2px solid #ffdad6', boxShadow: '0 4px 0 0 #f4b8b8' }}>
          <Icon name="skull" fill={1} size={20} />
          Declare Bankruptcy
        </button>
      </div>
    </div>
  );
}

// ── Helper: Calculate Player Asset Value ─────────────────────────────────────
function getPlayerAssetValue(player, gameState) {
  if (!player || !gameState) return 0;
  let total = 0;
  for (const propId of player.properties) {
    const tile = CITIES[propId];
    const state = gameState.boardState[propId];
    if (!tile || !state) continue;
    const houses = state.houses || 0;
    if (houses > 0) {
      const houseCost = tile.houseCost || (tile.price / 2);
      total += houses * Math.floor(houseCost / 2);
    }
    if (!state.mortgaged && houses === 0) {
      total += Math.floor(tile.price / 2);
    }
  }
  return total;
}

// ── Bankruptcy Resolve Screen ────────────────────────────────────────────────
function BankruptcyResolveScreen({ socket, gameState, me, room = 'ABCD', activeResolution }) {
  const { propertyId, bankruptPlayerName } = activeResolution;
  const tile = CITIES[propertyId];
  if (!tile) return null;

  const mortgageValue = Math.floor(tile.price / 2);
  const unmortgageCost = Math.floor(mortgageValue * 1.1);
  const keepMortgagedFee = Math.floor(mortgageValue * 0.1);

  const canAffordUnmortgage = me?.cash >= unmortgageCost;
  const canAffordKeep = me?.cash >= keepMortgagedFee;

  const assets = getPlayerAssetValue(me, gameState);
  const totalCash = (me?.cash || 0) + assets;
  const needFunds = me?.cash < Math.min(unmortgageCost, keepMortgagedFee);

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: '#fff', height: '100dvh' }}>
      {/* Header */}
      <header className="px-4 pt-4 pb-3 bg-[#e8f5e9]" style={{ borderBottom: '1px solid #c8e6c9' }}>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="assignment" fill={1} size={20} className="text-[#2e7d32]" />
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#2e7d32]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Bankruptcy Transfer
          </span>
        </div>
        <h2 className="text-xl font-black text-zinc-900" style={{ fontFamily: 'Montserrat' }}>
          Resolve Transferred Property
        </h2>
        <p className="text-xs mt-1 text-[#424242]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Decide whether to unmortgage or keep mortgaged for {tile.name} transferred from {bankruptPlayerName}.
        </p>
      </header>

      {/* Cash status */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#f6f3f2] border-b border-[#eae7e7]">
        <div className="flex items-center gap-2">
          <Icon name="account_balance_wallet" size={18} className="text-[#52625a]" />
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#52625a]" style={{ fontFamily: 'Plus Jakarta Sans' }}>Your Cash</span>
        </div>
        <span className="text-lg font-bold text-zinc-900" style={{ fontFamily: 'Montserrat' }}>
          ₹{(me?.cash || 0).toLocaleString()}
        </span>
      </div>

      {/* Resolution choices */}
      <div className="p-4 flex flex-col gap-3 bg-white border-b border-[#eae7e7]">
        <div className="flex gap-2">
          {/* Unmortgage Option */}
          <button
            disabled={!canAffordUnmortgage}
            onClick={() => socket.emit('resolve_transferred_mortgage', { room, action: 'UNMORTGAGE' })}
            className="flex-1 py-3.5 px-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 disabled:opacity-40"
            style={{
              background: '#e8f5e9',
              color: '#2e7d32',
              border: '2px solid #a5d6a7',
            }}
          >
            <span className="font-extrabold text-sm uppercase text-center block w-full truncate">Unmortgage</span>
            <span>Cost: ₹{unmortgageCost}</span>
          </button>

          {/* Keep Mortgaged Option */}
          <button
            disabled={!canAffordKeep}
            onClick={() => socket.emit('resolve_transferred_mortgage', { room, action: 'KEEP_MORTGAGED' })}
            className="flex-1 py-3.5 px-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 disabled:opacity-40"
            style={{
              background: '#ffebee',
              color: '#c62828',
              border: '2px solid #ef9a9a',
            }}
          >
            <span className="font-extrabold text-sm uppercase text-center block w-full truncate">Keep Mortgaged</span>
            <span>Fee: ₹{keepMortgagedFee}</span>
          </button>
        </div>

        {needFunds && (
          <p className="text-[11px] text-red-600 font-bold bg-red-50 p-2 rounded-lg text-center" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            ⚠️ Insufficient cash. Mortgage other properties below to raise the funds needed.
          </p>
        )}
      </div>

      {/* Property list for raising money if needed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
        <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
          <Icon name="handyman" size={14} className="mr-1" />
          Raise Funds (Mortgage / Sell other assets)
        </p>
        {(me?.properties || [])
          .filter(propId => propId !== propertyId) // don't manage the one being resolved
          .map(propId => {
            const prop = CITIES[propId];
            if (!prop) return null;
            const state = gameState?.boardState[propId] || {};
            const houses = state.houses || 0;
            const isMortgaged = state.mortgaged;
            const houseCost = prop.houseCost || Math.floor(prop.price / 2);
            const sellValue = Math.floor(houseCost / 2);
            const mortgageValue = Math.floor(prop.price / 2);
            return (
              <div key={propId} className="mb-3 rounded-xl overflow-hidden" style={{
                background: '#fff', border: '1px solid #eae7e7',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)', opacity: isMortgaged ? 0.6 : 1
              }}>
                <div className={`h-2 w-full ${prop.color}`} />
                <div className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm uppercase tracking-wide" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>{prop.name}</span>
                    <div className="flex gap-1">
                      {[...Array(Math.min(houses, 4))].map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-sm bg-green-500" />)}
                      {houses === 5 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: '#ba1a1a' }}>H</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {houses > 0 && (
                      <button onClick={() => socket.emit('manage_property', { room: room, action: 'SELL_HOUSE', propertyId: propId })}
                        className="flex-1 py-2 rounded-lg font-bold text-xs"
                        style={{ background: '#ffddb4', color: '#291800', fontFamily: 'Plus Jakarta Sans' }}>
                        Sell House +₹{sellValue}
                      </button>
                    )}
                    {!isMortgaged && houses === 0 && (
                      <button onClick={() => socket.emit('manage_property', { room: room, action: 'MORTGAGE', propertyId: propId })}
                        className="flex-1 py-2 rounded-lg font-bold text-xs"
                        style={{ background: '#d3e4da', color: '#101e19', fontFamily: 'Plus Jakarta Sans' }}>
                        Mortgage +₹{mortgageValue}
                      </button>
                    )}
                    {isMortgaged && (
                      <div className="flex-1 py-2 rounded-lg text-xs text-center" style={{ background: '#f0eded', color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
                        Already Mortgaged
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        {(me?.properties || []).filter(propId => propId !== propertyId).length === 0 && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: '#88717a' }}>
            <Icon name="do_not_disturb" size={40} className="mb-2 opacity-40" />
            <p className="text-sm font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>No other properties to sell</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Client ID generation ─────────────────────────────────────────────────────
function getOrCreateClientId() {
  let clientId = localStorage.getItem('monopoly_client_id');
  if (!clientId) {
    clientId = 'c_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('monopoly_client_id', clientId);
  }
  return clientId;
}

// ── Bankrupt Screen ──────────────────────────────────────────────────────────
function BankruptScreen() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none"
      style={{ background: '#1b1c1c', height: '100dvh', color: '#fff' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg bg-[#ffdad6] text-[#ba1a1a]">
        <Icon name="sentiment_very_dissatisfied" fill={1} size={48} />
      </div>
      <h1 className="text-3xl font-black mb-2 tracking-wide text-[#ffdad6]" style={{ fontFamily: 'Montserrat' }}>
        Bankrupt!
      </h1>
      <p className="text-zinc-400 text-sm max-w-xs mb-8" style={{ fontFamily: 'Plus Jakarta Sans' }}>
        You have run out of funds and all your properties have been liquidated.
      </p>
      <div className="w-full max-w-xs p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 mb-8">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#dbbfc9] mb-1 font-sans">
          Spectator Mode
        </p>
        <p className="text-zinc-400 text-xs leading-relaxed" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          You can continue watching the game board on the main screen to see who wins!
        </p>
      </div>
    </div>
  );
}

// ── Lobby Screen ─────────────────────────────────────────────────────────────
function LobbyScreen({ socket, room = 'ABCD', gameState }) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  const takenColors = gameState?.players?.map(p => p.color) || [];

  const AVAILABLE_TOKENS = [
    { color: '#ef4444', label: 'Car' },
    { color: '#3b82f6', label: 'Hat' },
    { color: '#10b981', label: 'Dog' },
    { color: '#f59e0b', label: 'Ship' },
    { color: '#8b5cf6', label: 'Boot' },
    { color: '#ec4899', label: 'Ring' }
  ];

  // Pre-select first untaken color
  useEffect(() => {
    if (!selectedColor) {
      if (gameState && gameState.players) {
        const untaken = AVAILABLE_TOKENS.find(t => !takenColors.includes(t.color));
        if (untaken) {
          setSelectedColor(untaken.color);
        }
      } else {
        setSelectedColor(AVAILABLE_TOKENS[0].color);
      }
    }
  }, [takenColors, selectedColor, gameState]);

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: '#fcf9f8', height: '100dvh' }}>
      {/* Top decorative area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-2 overflow-y-auto no-scrollbar pt-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-ambient shrink-0"
          style={{ background: '#9e216d' }}>
          <Icon name="casino" fill={1} size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-center mb-1 shrink-0" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
          Join Game
        </h1>
        <div className="flex items-center gap-2 mb-6 shrink-0 px-3 py-1.5 rounded-full" style={{ background: '#ffeff6', border: '1px solid #f0c8dd' }}>
          <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>Room</span>
          <span className="text-sm font-black" style={{ color: '#9e216d', fontFamily: 'Montserrat', letterSpacing: '0.2em' }}>{room}</span>
        </div>

        {/* Name input */}
        <div className="w-full mb-5 shrink-0">
          <label className="block text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
            Your Name
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl text-base font-semibold outline-none transition-all"
            style={{
              background: '#f0eded', border: '2px solid #dbbfc9', color: '#1b1c1c',
              fontFamily: 'Plus Jakarta Sans',
            }}
            placeholder="e.g. Arjun, Priya..."
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={12}
            onFocus={e => e.target.style.borderColor = '#9e216d'}
            onBlur={e => e.target.style.borderColor = '#dbbfc9'}
          />
        </div>

        {/* Token Selector */}
        <div className="w-full flex-1 min-h-[180px] flex flex-col justify-start">
          <label className="block text-xs font-extrabold uppercase tracking-widest mb-2 shrink-0" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
            Choose your Token
          </label>
          <div className="grid grid-cols-3 gap-3">
            {AVAILABLE_TOKENS.map(token => {
              const isTaken = takenColors.includes(token.color);
              const isSelected = selectedColor === token.color;
              return (
                <div
                  key={token.color}
                  onClick={() => !isTaken && setSelectedColor(token.color)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all relative overflow-hidden h-20 ${!isTaken ? 'cursor-pointer' : ''}`}
                  style={{
                    background: isSelected ? '#ffeff6' : '#fff',
                    borderColor: isSelected ? '#9e216d' : isTaken ? '#f0eded' : '#eae7e7',
                    opacity: isTaken ? 0.4 : 1,
                  }}
                >
                  <TokenIcon color={token.color} size={30} />
                  <span className="text-[10px] font-bold mt-1 text-zinc-600 font-sans">{token.label}</span>
                  {isTaken && (
                    <span className="absolute bottom-1 right-1 text-[8px] bg-red-100 text-red-700 px-1 rounded font-extrabold">TAKEN</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reclaim Disconnected Player */}
        {(() => {
          const disconnectedPlayers = gameState?.players?.filter(p => !p.connected && !p.bankrupt) || [];
          if (disconnectedPlayers.length === 0) return null;
          return (
            <div className="w-full mt-6 shrink-0 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm mb-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#9e216d] mb-3 font-sans flex items-center gap-1.5">
                <Icon name="device_reset" size={14} className="text-[#9e216d]" />
                Reclaim Disconnected Player
              </p>
              <div className="flex flex-col gap-2">
                {disconnectedPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const clientId = getOrCreateClientId();
                      localStorage.setItem(`monopoly_name_${room}`, p.name);
                      localStorage.setItem(`monopoly_color_${room}`, p.color);
                      socket.emit('join_game', { room, name: p.name, color: p.color, clientId });
                    }}
                    className="w-full py-3 px-4 rounded-xl flex items-center justify-between border border-dashed border-[#dbbfc9] bg-zinc-50 hover:bg-[#ffeff6] transition-all text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white border">
                        <TokenIcon color={p.color} size={14} />
                      </div>
                      <span className="font-bold text-sm text-[#1b1c1c]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                        {p.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase text-[#9e216d] flex items-center gap-0.5">
                      Rejoin <Icon name="chevron_right" size={12} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Connect button */}
      <div className="px-6 pb-8 pt-3 bg-white border-t border-[#eae7e7]">
        <button
          onClick={() => {
            if (name.trim() && selectedColor) {
              const clientId = getOrCreateClientId();
              localStorage.setItem(`monopoly_name_${room}`, name.trim());
              localStorage.setItem(`monopoly_color_${room}`, selectedColor);
              socket.emit('join_game', { room, name: name.trim(), color: selectedColor, clientId });
            }
          }}
          disabled={!name.trim() || !selectedColor}
          className="w-full py-3.5 rounded-xl font-black text-lg uppercase tracking-widest btn-press flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            background: '#9e216d', color: '#fff', fontFamily: 'Montserrat',
            boxShadow: '0 4px 0 0 #6c164a, 0 8px 24px rgba(158,33,109,0.3)',
          }}>
          <Icon name="arrow_forward" fill={1} size={22} className="text-white" />
          Connect
        </button>
        <p className="text-center text-[10px] mt-3 leading-relaxed" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
          Open <strong>http://{window.location.hostname}:5173/?mode=host&amp;room={room}</strong> on your TV/Laptop to show the board.
        </p>
      </div>
    </div>
  );
}

// ── Main Controller ──────────────────────────────────────────────────────────
export default function ControllerComponent({ socket }) {
  // FIX: room is controller-owned state now, not a fixed prop. Honor a ?room= code
  // from a shared/QR link; otherwise start at the mode-select screen.
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  const [room, setRoom] = useState(urlRoom || null);
  const [view, setView] = useState(urlRoom ? 'LOBBY' : 'MODE_SELECT');
  const [gameState, setGameState] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('action'); // action | portfolio | trade | guide
  const [tradeOffer, setTradeOffer] = useState(null);
  const [auctionData, setAuctionData] = useState(null);
  const [raisingMoney, setRaisingMoney] = useState(false);

  const me = gameState?.players.find(p => p.id === socket.id);
  const isMyTurn = gameState && gameState.players[gameState.currentTurn]?.id === socket.id;
  const nextPlayer = gameState?.players[(gameState.currentTurn + 1) % (gameState?.players.length || 1)]?.name;

  const lastRollSumRef = useRef(0);
  const gameStateRef = useRef(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!room) return; // nothing to join until a room is chosen
    const handleConnect = () => {
      socket.emit('join_room', room); // receive state only; NEVER auto-join as an old player
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();
    return () => socket.off('connect', handleConnect);
  }, [room, socket]);

  const committedSeqRef = useRef(0);
  const latestSeqRef = useRef(0);

  useEffect(() => {
    const onGameUpdate = (state) => {
      // Each game_update gets a unique monotonically increasing sequence number
      latestSeqRef.current += 1;
      const mySeq = latestSeqRef.current;

      let delayTime = 0;
      const prevGameState = gameStateRef.current;
      if (prevGameState && prevGameState.players && state.players) {
        const activePlayerBefore = prevGameState.players[prevGameState.currentTurn];
        const activePlayerAfter = state.players[state.currentTurn];
        if (activePlayerBefore && activePlayerAfter && activePlayerBefore.id === activePlayerAfter.id) {
          const oldPos = activePlayerBefore.position;
          const finalPos = activePlayerAfter.position;
          if (oldPos !== finalPos) {
            const roll = lastRollSumRef.current || ((finalPos - oldPos + 40) % 40);
            const rolledPos = (oldPos + roll) % 40;
            delayTime = 2200 + (roll * 250);
            if (rolledPos !== finalPos) {
              delayTime += 900;
            }
          }
        }
      }

      const applyUpdate = () => {
        // Bug fix: A delayed movement update (e.g. seq 5) must not overwrite an
        // already-committed instant update (e.g. end_turn seq 6 committed at seq 6).
        // We allow the delayed update only if no newer update has been committed after us.
        if (mySeq < committedSeqRef.current) {
          return; // stale — a newer instant update already committed
        }
        committedSeqRef.current = mySeq;

        // Haptic feedback on significant events
        if (navigator.vibrate) {
          const prev = gameStateRef.current;
          const myStatePrev = prev?.players?.find(p => p.id === socket.id);
          const myStateNext = state?.players?.find(p => p.id === socket.id);
          if (myStatePrev && myStateNext) {
            const cashDiff = myStateNext.cash - myStatePrev.cash;
            if (cashDiff > 0) navigator.vibrate([60, 30, 60]); // money received
            else if (cashDiff < -200) navigator.vibrate([200, 80, 200]); // big payment
            if (myStateNext.inJail && !myStatePrev.inJail) navigator.vibrate([400, 100, 400, 100, 400]); // sent to jail
          }
          // Vibrate when it becomes your turn
          const prevTurnPlayer = prev?.players?.[prev?.currentTurn];
          const nextTurnPlayer = state?.players?.[state?.currentTurn];
          if (prevTurnPlayer?.id !== nextTurnPlayer?.id && nextTurnPlayer?.id === socket.id) {
            navigator.vibrate([100, 50, 100, 50, 100]);
          }
        }

        setGameState(state);
        setView(v => {
          if (v === 'LOBBY' && state.players.some(p => p.id === socket.id)) return 'GAME';
          if (state.auction?.status && v !== 'AUCTION') return 'AUCTION';
          if (!state.auction?.status && v === 'AUCTION') return 'GAME';
          return v;
        });
        const myState = state.players.find(p => p.id === socket.id);
        if (myState && !myState.needsToRaiseMoney) setRaisingMoney(false);
        if (state.auction?.status) setAuctionData(state.auction);
        else if (!state.auction?.status) setAuctionData(prev => prev ? null : prev);
        
        lastRollSumRef.current = 0;
      };

      if (delayTime > 0) {
        setTimeout(applyUpdate, delayTime);
      } else {
        // Non-delayed (instant) updates commit immediately — this advances committedSeqRef
        // so any in-flight delayed updates (with smaller seq) will be dropped when they fire
        committedSeqRef.current = mySeq;
        applyUpdate();
      }
    };
    const onAuctionStart = (data) => { setAuctionData(data); setModal(null); setView('AUCTION'); };
    const onAuctionUpdate = (data) => setAuctionData(prev => ({ ...prev, ...data }));
    const onAuctionEnd = () => { setAuctionData(null); setView('GAME'); };
    const onPromptBuy = (tile) => {
      const currentMe = gameStateRef.current?.players.find(p => p.id === socket.id);
      const currentPos = currentMe ? currentMe.position : 0;
      const roll = lastRollSumRef.current || ((tile.id - currentPos + 40) % 40);
      const delayTime = 2200 + (roll * 250);
      setTimeout(() => {
        setModal({ type: 'BUY', tile });
      }, delayTime);
    };
    const onTradeOffer = (offer) => setTradeOffer(offer);
    const onTriggerVisual = (data) => {
      if (data.type === 'TRADE_ACCEPTED') {
        showToast('Trade accepted! ✅');
        setTradeOffer(null);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
      if (data.type === 'TRADE_DECLINED') {
        showToast('Trade declined ❌');
        setTradeOffer(null);
        if (navigator.vibrate) navigator.vibrate([300]);
      }
      if (data.type === 'DICE_ROLL') {
        lastRollSumRef.current = data.dice[0] + data.dice[1];
      }
    };
    const onActionError = (msg) => showToast(msg);
    const onRaiseMoney = () => { setRaisingMoney(true); if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]); };
    const onRaiseMoneyResolved = () => { setRaisingMoney(false); showToast('Debt cleared! 💰'); };
    const onGameOver = () => {
      localStorage.removeItem(`monopoly_name_${room}`);
      localStorage.removeItem(`monopoly_color_${room}`);
    };

    socket.on('game_update', onGameUpdate);
    socket.on('auction_start', onAuctionStart);
    socket.on('auction_update', onAuctionUpdate);
    socket.on('auction_end', onAuctionEnd);
    socket.on('prompt_buy', onPromptBuy);
    socket.on('trade_offer', onTradeOffer);
    socket.on('trigger_visual', onTriggerVisual);
    socket.on('action_error', onActionError);
    socket.on('raise_money', onRaiseMoney);
    socket.on('raise_money_resolved', onRaiseMoneyResolved);
    socket.on('game_over', onGameOver);
    return () => {
      socket.off('game_update', onGameUpdate); socket.off('auction_start', onAuctionStart);
      socket.off('auction_update', onAuctionUpdate); socket.off('auction_end', onAuctionEnd);
      socket.off('prompt_buy', onPromptBuy); socket.off('trade_offer', onTradeOffer);
      socket.off('trigger_visual', onTriggerVisual); socket.off('action_error', onActionError);
      socket.off('raise_money', onRaiseMoney); socket.off('raise_money_resolved', onRaiseMoneyResolved);
      socket.off('game_over', onGameOver);
    };
  }, [socket, room]);

  const showToast = (msg) => {
    setToast(msg);
    if (navigator.vibrate) navigator.vibrate(200);
    setTimeout(() => setToast(null), 3000);
  };

  // ── State routing ──────────────────────────────────────────────────────────
  const resolveQueue = gameState?.bankruptcyResolveQueue;
  const activeResolution = resolveQueue && resolveQueue.length > 0 ? resolveQueue[0] : null;
  const isResolvingBankruptcy = activeResolution && activeResolution.creditorId === socket.id;

  const startNewGame = () => {
    const code = makeRoomCode();
    socket.emit('create_room', code); // create a fresh server room so join_game won't error
    setRoom(code); // triggers the effect above to join_room(code)
    setView('LOBBY');
  };
  const joinExistingGame = (code) => {
    setRoom(code); // triggers join_room(code); Lobby shows reclaim list if any
    setView('LOBBY');
  };

  if (view === 'MODE_SELECT' || !room) {
    return <ModeSelectScreen onStartNew={startNewGame} onJoin={joinExistingGame} />;
  }
  if (view === 'LOBBY') return <LobbyScreen socket={socket} room={room} gameState={gameState} />;
  if (view === 'AUCTION' && auctionData) return <AuctionController socket={socket} room={room} myId={socket.id} auctionState={auctionData} />;
  if (me?.bankrupt) return <BankruptScreen />;
  if (isResolvingBankruptcy) return <BankruptcyResolveScreen socket={socket} gameState={gameState} me={me} room={room} activeResolution={activeResolution} />;
  if (raisingMoney || me?.needsToRaiseMoney) return <RaiseMoneyScreen socket={socket} gameState={gameState} me={me} room={room} />;

  // ── Main Game View ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden select-none" style={{ background: '#fcf9f8', height: '100dvh' }}>

      {/* Header / Dashboard */}
      <header className="shrink-0 flex justify-between items-center px-4 py-3"
        style={{ background: '#fff', borderBottom: '1px solid #eae7e7', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3">
          {/* Player token (color from server) */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-ambient bg-[#f0eded]"
            style={{ boxShadow: `0 0 12px ${me?.color || '#9e216d'}40` }}>
            {me?.color ? <TokenIcon color={me.color} size={28} /> : <span className="text-[#88717a] font-black">?</span>}
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest mb-0.5" style={{ color: isMyTurn ? '#16a34a' : '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
              {isMyTurn ? '● Your Turn' : '○ Waiting...'}
            </p>
            <h1 className="text-xl font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>{me?.name}</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Balance</p>
          <p className="text-xl font-black" style={{ fontFamily: 'Montserrat', color: '#9e216d' }}>
            ₹{(me?.cash || 0).toLocaleString()}
          </p>
        </div>
      </header>

      {/* Player scoreboard strip */}
      {gameState?.players?.length > 1 && (
        <div className="shrink-0 px-4 py-2 flex gap-3 overflow-x-auto no-scrollbar"
          style={{ background: '#f6f3f2', borderBottom: '1px solid #eae7e7' }}>
          {gameState.players.map((p, idx) => {
            const isCurrent = idx === gameState.currentTurn;
            const isMe2 = p.id === socket.id;
            return (
              <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg flex-shrink-0"
                style={{
                  background: isCurrent ? `${p.color}15` : 'transparent',
                  border: isCurrent ? `2px solid ${p.color}` : '2px solid transparent',
                  opacity: p.bankrupt ? 0.4 : 1,
                }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white"
                  style={{ boxShadow: isCurrent ? `0 0 6px ${p.color}` : 'none' }}>
                  <TokenIcon color={p.color} size={14} />
                </div>
                <div>
                  <p className="text-[9px] font-bold leading-none" style={{ color: '#1b1c1c', fontFamily: 'Plus Jakarta Sans' }}>
                    {isMe2 ? 'You' : p.name}
                  </p>
                  <p className="text-[9px] font-bold leading-none" style={{ color: '#9e216d', fontFamily: 'Plus Jakarta Sans' }}>
                    ₹{p.cash?.toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Property mini-bar (owned properties quick view) */}
      {(me?.properties?.length > 0) && (
        <div className="shrink-0 px-4 py-1.5 flex gap-2 overflow-x-auto no-scrollbar"
          style={{ background: '#fff', borderBottom: '1px solid #eae7e7' }}>
          {me.properties.map(propId => {
            const tile = CITIES[propId];
            if (!tile) return null;
            const state = gameState?.boardState[propId] || {};
            const houses = state.houses || 0;
            return (
              <div key={propId} className="flex items-center gap-1 px-1.5 py-1 rounded-md flex-shrink-0"
                style={{ background: '#f6f3f2', border: '1px solid #eae7e7' }}>
                <div className={`w-3 h-3 rounded-sm ${tile.color}`} />
                <span className="text-[9px] font-bold whitespace-nowrap" style={{ color: '#1b1c1c', fontFamily: 'Plus Jakarta Sans' }}>
                  {tile.name.split(' ')[0]}
                </span>
                {houses > 0 && houses < 5 && <span className="text-[8px] font-bold" style={{ color: '#52625a' }}>{houses}H</span>}
                {houses === 5 && <span className="text-[8px] font-black px-1 rounded" style={{ background: '#ba1a1a', color: '#fff' }}>H</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Main Action Canvas */}
      <main className="flex-1 relative overflow-hidden">
        {/* ROLL phase */}
        {isMyTurn && !modal && !gameState.hasRolled && (
          <div className="h-full flex flex-col items-center justify-center px-6 gap-6">
            <div className="text-center mb-2">
              <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: '#52625a', fontFamily: 'Plus Jakarta Sans' }}>
                <Icon name="casino" size={14} className="mr-1" />
                It&apos;s your turn!
              </p>
              <p className="text-sm" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
                Tap the button to roll the dice
              </p>
            </div>
            <button
              onClick={() => { socket.emit('roll_dice', { room }); if (navigator.vibrate) navigator.vibrate([80, 40, 80]); }}
              className="w-full btn-press"
              style={{
                background: '#9e216d', color: '#fff', borderRadius: 16, padding: '20px 24px',
                fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: '0 4px 0 0 #6c164a, 0 8px 24px rgba(158,33,109,0.3)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
              <Icon name="casino" fill={1} size={28} className="text-white" />
              Roll Dice
            </button>
            {/* Jail controls */}
            {me?.inJail && (() => {
              const assetsVal = getPlayerAssetValue(me, gameState);
              const canAffordBail = (me?.cash || 0) + assetsVal >= 50;
              return (
                <div className="w-full flex flex-col gap-2 font-sans shrink-0">
                  {canAffordBail && (
                    <button onClick={() => socket.emit('pay_bail', { room })}
                      className="w-full py-3.5 rounded-xl font-bold text-sm btn-press"
                      style={{ background: '#d3e4da', color: '#101e19', fontFamily: 'Plus Jakarta Sans', border: '1px solid #bacac1' }}>
                      <Icon name="lock_open" size={16} className="mr-1" />
                      {me.cash >= 50 ? 'Pay ₹50 Bail' : 'Pay Bail on Credit'}
                    </button>
                  )}
                  {me.getOutOfJailCards > 0 && (
                    <button onClick={() => socket.emit('use_jail_card', { room })}
                      className="w-full py-3.5 rounded-xl font-bold text-sm btn-press"
                      style={{ background: '#ffddb4', color: '#291800', fontFamily: 'Plus Jakarta Sans', border: '1px solid #ffb955' }}>
                      <Icon name="card_giftcard" fill={1} size={16} className="mr-1" />
                      Use Jail Card ({me.getOutOfJailCards})
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* END TURN phase */}
        {isMyTurn && !modal && gameState.hasRolled && (() => {
          const currentTile = CITIES[me?.position] || {};
          return (
          <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
            {/* Turn summary */}
            <div className="px-4 pt-4 pb-2">
              <div className="rounded-xl p-4 relative overflow-hidden"
                style={{ background: '#fff', border: '1px solid rgba(158,33,109,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full" style={{ background: 'rgba(158,33,109,0.05)', filter: 'blur(20px)' }} />
                <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>You landed on</p>
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Montserrat', color: '#9e216d' }}>
                  {currentTile.name}
                </h2>
                <p className="text-sm mt-1" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
                  End your turn when ready.
                </p>
              </div>
            </div>

            {/* Enhanced Activity Log */}
            {gameState?.logs?.length > 0 && (
              <div className="px-4 pb-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>Activity Log</p>
                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #eae7e7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  {gameState.logs.slice(0, 8).map((log, i) => {
                    const text = log.replace(/^> /, '');
                    let icon = 'arrow_right';
                    let iconColor = '#88717a';
                    let bgColor = 'transparent';
                    if (text.includes('Jail') || text.includes('jail')) { icon = 'gavel'; iconColor = '#ba1a1a'; bgColor = i === 0 ? '#fff5f5' : 'transparent'; }
                    else if (text.includes('collected') || text.includes('Collect') || text.includes('funded') || text.includes('Lottery') || text.includes('Free Parking')) { icon = 'payments'; iconColor = '#16a34a'; bgColor = i === 0 ? '#f0fdf4' : 'transparent'; }
                    else if (text.includes('paid') || text.includes('tax') || text.includes('bail') || text.includes('challan')) { icon = 'receipt'; iconColor = '#d97706'; bgColor = i === 0 ? '#fffbeb' : 'transparent'; }
                    else if (text.includes('bought') || text.includes('purchased') || text.includes('Built')) { icon = 'storefront'; iconColor = '#7c3aed'; bgColor = i === 0 ? '#f5f3ff' : 'transparent'; }
                    else if (text.includes('Trade') || text.includes('trade')) { icon = 'swap_horiz'; iconColor = '#0891b2'; bgColor = i === 0 ? '#f0f9ff' : 'transparent'; }
                    else if (text.includes('GO') || text.includes('passed')) { icon = 'start'; iconColor = '#dc2626'; bgColor = i === 0 ? '#fff5f5' : 'transparent'; }
                    else if (i === 0) { icon = 'casino'; iconColor = '#9e216d'; bgColor = '#fdf4fb'; }
                    return (
                      <div key={i} className="px-3 py-2 flex items-start gap-2.5 transition-colors"
                        style={{ borderBottom: i < Math.min(gameState.logs.length - 1, 7) ? '1px solid #f0eded' : 'none', background: bgColor }}>
                        <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ fontSize: '14px', color: iconColor, fontVariationSettings: '"FILL" 1' }}>{icon}</span>
                        <span className="text-xs leading-relaxed" style={{ color: i === 0 ? '#1b1c1c' : '#55414a', fontFamily: 'Plus Jakarta Sans', fontWeight: i === 0 ? 600 : 400 }}>
                          {text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status grid */}
            <div className="px-4 pb-2 grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 flex flex-col items-center"
                style={{ background: '#fff', border: '1px solid #eae7e7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Icon name="account_balance_wallet" size={22} className="text-[#52625a] mb-1" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>Balance</span>
                <span className="text-base font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>₹{(me?.cash || 0).toLocaleString()}</span>
              </div>
              <div className="rounded-xl p-3 flex flex-col items-center"
                style={{ background: '#fff', border: '1px solid #eae7e7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Icon name="location_city" fill={1} size={22} className="text-[#9e216d] mb-1" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>Properties</span>
                <span className="text-base font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>{me?.properties?.length || 0}</span>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />
          </div>
          );
        })()}

        {/* WAITING phase */}
        {!isMyTurn && (() => {
          const currentPlayer = gameState?.players[gameState.currentTurn];
          const landedTile = gameState?.landedTile;
          const tileHex = landedTile?.tileColor ? (TILE_COLOR_HEX[landedTile.tileColor] || '#88717a') : '#88717a';
          const contextBadge = {
            for_sale: { label: 'FOR SALE', bg: '#d3e4da', color: '#16a34a' },
            rent_due: { label: 'RENT PAID', bg: '#ffdad6', color: '#ba1a1a' },
            tax: { label: 'TAX', bg: '#ffddb4', color: '#78350f' },
            jail: { label: 'JAIL', bg: '#ffdad6', color: '#ba1a1a' },
          };
          const badge = landedTile?.context ? contextBadge[landedTile.context] : null;
          const hasRentTable = landedTile?.tileRent && landedTile.tileRent.length > 0 && landedTile.tileType === 'property';
          return (
            <div className="h-full flex flex-col items-center px-6 pt-8 gap-4 overflow-y-auto no-scrollbar">
              {/* Current player avatar + waiting text */}
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 shrink-0 bg-white"
                style={{ borderColor: `${currentPlayer?.color || '#dbbfc9'}60` }}>
                {currentPlayer?.color ? <TokenIcon color={currentPlayer.color} size={40} /> : <span className="text-[#88717a] font-black">?</span>}
              </div>
              <div className="text-center shrink-0">
                <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>Waiting</p>
                <p className="text-lg font-bold" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
                  {currentPlayer?.name}&apos;s turn
                </p>
                <p className="text-xs mt-1" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
                  Sit tight while they play...
                </p>
              </div>

              {/* Landed Tile Notification */}
              {landedTile && (
                <div className="w-full max-w-sm rounded-2xl overflow-hidden shrink-0 mb-6"
                  style={{
                    background: '#fff',
                    border: '1px solid #eae7e7',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  }}>
                  {/* Color accent bar */}
                  <div style={{ height: 6, background: tileHex }} />

                  <div className="px-4 pt-3 pb-4">
                    {/* Context badge */}
                    <div className="flex items-center gap-2 mb-2">
                      {badge ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: badge.bg, color: badge.color, fontFamily: 'Plus Jakarta Sans' }}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: '#f0eded', color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
                          LANDED
                        </span>
                      )}
                      {/* Player who landed */}
                      <div className="flex items-center gap-1 ml-auto">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center bg-white">
                          <TokenIcon color={landedTile.playerColor || '#88717a'} size={12} />
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
                          {landedTile.playerName}
                        </span>
                      </div>
                    </div>

                    {/* Tile name */}
                    <h3 className="text-base font-black uppercase tracking-wide mb-1"
                      style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
                      {landedTile.tileName}
                    </h3>

                    {/* Rent mini-table for properties */}
                    {hasRentTable && (
                      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid #eae7e7' }}>
                        <div className="flex justify-between items-center px-3 py-1.5"
                          style={{ background: '#f6f3f2', borderBottom: '1px solid #eae7e7' }}>
                          <span className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Purchase Price</span>
                          <span className="text-xs font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
                            ₹{landedTile.tilePrice}
                          </span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-1.5"
                          style={{ background: `${tileHex}10`, borderBottom: '1px solid #eae7e7' }}>
                          <span className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: tileHex, fontFamily: 'Plus Jakarta Sans' }}>Rent</span>
                          <span className="text-xs font-black" style={{ fontFamily: 'Montserrat', color: tileHex }}>
                            ₹{landedTile.tileRent[0]}
                          </span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-1.5"
                          style={{ background: '#fff' }}>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold"
                              style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Rent w/ colour set</span>
                            <div className="flex gap-0.5">
                              <div style={{ width: 6, height: 6, borderRadius: 1, background: tileHex }} />
                              <div style={{ width: 6, height: 6, borderRadius: 1, background: tileHex }} />
                            </div>
                          </div>
                          <span className="text-xs font-bold" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
                            ₹{landedTile.tileRent[0] * 2}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Context info */}
                    {landedTile.context === 'for_sale' && (
                      <p className="text-xs font-semibold" style={{ color: '#16a34a', fontFamily: 'Plus Jakarta Sans' }}>
                        ₹{landedTile.tilePrice} — waiting to decide...
                      </p>
                    )}
                    {landedTile.context === 'rent_due' && (
                      <p className="text-xs font-semibold" style={{ color: '#ba1a1a', fontFamily: 'Plus Jakarta Sans' }}>
                        {landedTile.playerName} paid ₹{landedTile.amount?.toLocaleString()} to{' '}
                        <span style={{ color: landedTile.ownerColor || '#1b1c1c' }}>{landedTile.ownerName}</span>
                      </p>
                    )}
                    {landedTile.context === 'tax' && (
                      <p className="text-xs font-semibold" style={{ color: '#78350f', fontFamily: 'Plus Jakarta Sans' }}>
                        {landedTile.playerName} paid ₹{landedTile.amount?.toLocaleString()}
                      </p>
                    )}
                    {landedTile.context === 'jail' && (
                      <p className="text-xs font-semibold" style={{ color: '#ba1a1a', fontFamily: 'Plus Jakarta Sans' }}>
                        {landedTile.playerName} is in Jail!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Trade Offer Modal */}
        {tradeOffer && (
          <div className="absolute inset-0 modal-backdrop flex items-center justify-center p-4 z-40"
            style={{ background: 'rgba(27,28,28,0.5)' }}>
            <div className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: '#fff', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
              <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid #eae7e7' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="swap_horiz" fill={1} size={22} className="text-[#9e216d]" />
                  <h2 className="text-lg font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>Trade Offer!</h2>
                </div>
                <p className="text-sm" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
                  {tradeOffer.initiatorName} wants to trade with you
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {(() => {
                  const renderSide = (label, cash, propIds, jailCards, bg, accent) => {
                    if (!(cash > 0) && !(propIds?.length > 0) && !(jailCards > 0)) return null;
                    return (
                      <div className="p-3 rounded-xl animate-slide-down" style={{ background: bg }}>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: accent }}>{label}</p>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {cash > 0 && (
                            <span className="px-2 py-1 rounded-lg text-sm font-black"
                              style={{ background: '#fff', color: '#1b1c1c', fontFamily: 'Montserrat' }}>
                              ₹{Number(cash).toLocaleString()}
                            </span>
                          )}
                          {(propIds || []).map(id => {
                            const tile = CITIES[id];
                            if (!tile) return null;
                            return (
                              <span key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold"
                                style={{ background: '#fff', color: '#1b1c1c', fontFamily: 'Plus Jakarta Sans' }}>
                                <span className="w-2.5 h-2.5 rounded-sm inline-block"
                                  style={{ background: TILE_COLOR_HEX[tile.color] || '#4b5563' }} />
                                {tile.name}
                              </span>
                            );
                          })}
                          {jailCards > 0 && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                              style={{ background: '#fff7e6', color: '#a15c07', fontFamily: 'Plus Jakarta Sans' }}>
                              <Icon name="key" fill={1} size={12} className="text-[#a15c07]" />
                              Jail Card ×{jailCards}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  };
                  return (
                    <>
                      {renderSide('They Give', tradeOffer.offerCash, tradeOffer.offerPropertyIds, tradeOffer.offerJailCards, '#eaf6ef', '#16a34a')}
                      {renderSide('They Want', tradeOffer.requestCash, tradeOffer.requestPropertyIds, tradeOffer.requestJailCards, '#ffdad6', '#ba1a1a')}
                    </>
                  );
                })()}
              </div>
              <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                <button onClick={() => { socket.emit('decline_trade', { room, initiatorId: tradeOffer.initiatorId }); setTradeOffer(null); }}
                  className="py-3 rounded-xl font-bold text-sm btn-press"
                  style={{ background: '#f0eded', color: '#55414a', fontFamily: 'Plus Jakarta Sans', border: '1px solid #dbbfc9' }}>
                  Decline
                </button>
                <button onClick={() => { socket.emit('accept_trade', { room, ...tradeOffer }); setTradeOffer(null); }}
                  className="py-3 rounded-xl font-bold text-sm btn-press"
                  style={{ background: '#9e216d', color: '#fff', fontFamily: 'Montserrat', boxShadow: '0 3px 0 0 #6c164a' }}>
                  Accept ✓
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Buy Property Modal */}
        {modal?.type === 'BUY' && (
          <div className="absolute inset-0 modal-backdrop flex items-center justify-center p-4 z-30"
            style={{ background: 'rgba(27,28,28,0.5)' }}>
            <div className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: '#fff', boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
              {/* Color header */}
              <div className={`h-24 ${modal.tile.color} flex flex-col items-center justify-center relative`}>
                <h2 className="text-xl font-black uppercase tracking-wider text-white drop-shadow-md"
                  style={{ fontFamily: 'Montserrat' }}>{modal.tile.name}</h2>
              </div>
              {/* Body */}
              <div className="p-5">
                {/* Price info */}
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Purchase Price</span>
                  <span className="text-sm font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>₹{modal.tile.price}</span>
                </div>
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Mortgage Value</span>
                  <span className="text-sm font-black" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>₹{Math.floor(modal.tile.price * 0.5)}</span>
                </div>

                {/* Full rent table (only for standard properties) */}
                {modal.tile.rent && modal.tile.rent.length === 6 && (
                  <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #eae7e7' }}>
                    {/* Base rent — highlighted */}
                    <div className="flex justify-between items-center px-3 py-2" style={{ background: '#fce4ec', borderBottom: '1px solid #eae7e7' }}>
                      <span className="text-xs font-bold" style={{ color: '#9e216d', fontFamily: 'Plus Jakarta Sans' }}>Rent</span>
                      <span className="text-sm font-black" style={{ color: '#9e216d', fontFamily: 'Montserrat' }}>₹{modal.tile.rent[0]}</span>
                    </div>
                    {/* Rent with colour set */}
                    <div className="flex justify-between items-center px-3 py-2" style={{ background: '#fff', borderBottom: '1px solid #eae7e7' }}>
                      <span className="text-xs font-semibold" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Rent with colour set</span>
                      <span className="text-sm font-bold" style={{ color: '#1b1c1c', fontFamily: 'Montserrat' }}>₹{modal.tile.rent[0] * 2}</span>
                    </div>
                    {/* Rent with houses */}
                    {[1,2,3,4].map(n => (
                      <div key={n} className="flex justify-between items-center px-3 py-2" style={{ background: n % 2 === 0 ? '#fff' : '#f6f3f2', borderBottom: '1px solid #eae7e7' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Rent with</span>
                          {[...Array(n)].map((_, i) => (
                            <span key={i} style={{ display: 'inline-block', width: 8, height: 8, background: '#16a34a', borderRadius: 1 }} />
                          ))}
                        </div>
                        <span className="text-sm font-bold" style={{ color: '#1b1c1c', fontFamily: 'Montserrat' }}>₹{modal.tile.rent[n]}</span>
                      </div>
                    ))}
                    {/* Rent with hotel */}
                    <div className="flex justify-between items-center px-3 py-2" style={{ background: '#f6f3f2' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Rent with</span>
                        <span style={{ display: 'inline-block', width: 10, height: 8, background: '#dc2626', borderRadius: 1 }} />
                      </div>
                      <span className="text-sm font-bold" style={{ color: '#1b1c1c', fontFamily: 'Montserrat' }}>₹{modal.tile.rent[5]}</span>
                    </div>
                  </div>
                )}
                
                {/* Simplified rent for Stations */}
                {modal.tile.type === 'station' && (
                  <div className="rounded-xl overflow-hidden mb-4 p-3" style={{ border: '1px solid #eae7e7', background: '#f6f3f2' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>Base Rent</span>
                      <span className="text-sm font-black" style={{ color: '#1b1c1c', fontFamily: 'Montserrat' }}>₹{modal.tile.rent[0]}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { socket.emit('start_auction', { room, propertyId: modal.tile.id }); setModal(null); }}
                    className="flex-1 py-3 rounded-xl font-bold text-sm btn-press"
                    style={{ background: '#f0eded', color: '#52625a', fontFamily: 'Plus Jakarta Sans', border: '2px solid #dbbfc9' }}>
                    Auction
                  </button>
                  {(() => {
                    const assetsVal = getPlayerAssetValue(me, gameState);
                    const canAffordBuy = (me?.cash || 0) + assetsVal >= modal.tile.price;
                    return (
                      <button 
                        disabled={!canAffordBuy}
                        onClick={() => { socket.emit('buy_property', { room, propertyId: modal.tile.id }); setModal(null); }}
                        className="flex-1 py-3 rounded-xl font-bold text-sm btn-press disabled:opacity-40"
                        style={{ background: '#9e216d', color: '#fff', fontFamily: 'Montserrat', boxShadow: '0 3px 0 0 #6c164a' }}>
                        {!canAffordBuy ? 'Cannot Afford' : me.cash >= modal.tile.price ? 'Buy Now' : 'Buy on Credit'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* End Turn fixed footer (only when hasRolled) */}
      {isMyTurn && gameState.hasRolled && !modal && (
        <div className="shrink-0 px-4 pt-3 pb-3" style={{ background: '#fff', borderTop: '1px solid #eae7e7', boxShadow: '0 -8px 24px rgba(0,0,0,0.08)' }}>
          <button
            onClick={() => { socket.emit('end_turn', { room }); if (navigator.vibrate) navigator.vibrate(80); }}
            className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest btn-press flex items-center justify-center gap-2"
            style={{
              background: '#9e216d', color: '#fff', fontFamily: 'Montserrat',
              boxShadow: '0 4px 0 0 #6c164a, 0 8px 24px rgba(158,33,109,0.25)',
            }}>
            End Turn
            <Icon name="arrow_forward" fill={1} size={22} className="text-white" />
          </button>
          {nextPlayer && (
            <p className="text-center text-xs mt-2" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
              Next up: {nextPlayer}
            </p>
          )}
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="shrink-0 flex justify-around items-center px-2 py-2"
        style={{ background: '#fff', borderTop: '1px solid #eae7e7', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
        {[
          { id: 'action', icon: 'casino', label: 'Board' },
          { id: 'portfolio', icon: 'account_balance_wallet', label: 'Portfolio' },
          { id: 'trade', icon: 'swap_horiz', label: 'Trade' },
          { id: 'guide', icon: 'menu_book', label: 'Guide' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center px-3 py-1.5 rounded-full transition-all"
              style={{
                background: isActive ? 'rgba(158,33,109,0.12)' : 'transparent',
                color: isActive ? '#9e216d' : '#52625a',
                minWidth: 64,
              }}>
              <Icon name={tab.icon} fill={isActive ? 1 : 0} size={22}
                className={isActive ? 'text-[#9e216d]' : 'text-[#52625a]'} />
              <span className="text-[10px] font-extrabold uppercase tracking-widest mt-0.5"
                style={{ fontFamily: 'Plus Jakarta Sans' }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Drawer (portfolio / trade / guide) */}
      {activeTab !== 'action' && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end"
          style={{ background: 'rgba(27,28,28,0.4)' }}
          onClick={() => setActiveTab('action')}>
          <div className="rounded-t-2xl overflow-hidden"
            style={{ background: '#fcf9f8', maxHeight: '70vh', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: '#dbbfc9' }} />
            </div>

            {/* Tab header */}
            <div className="px-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid #eae7e7' }}>
              <h3 className="font-black text-base uppercase tracking-widest"
                style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
                {activeTab === 'portfolio' && `Portfolio (${me?.properties?.length || 0})`}
                {activeTab === 'trade' && 'Trade'}
                {activeTab === 'guide' && 'Property Guide'}
              </h3>
              <button onClick={() => setActiveTab('action')} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#f0eded' }}>
                <Icon name="close" size={18} className="text-[#55414a]" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 'calc(70vh - 80px)' }}>
              {activeTab === 'portfolio' && (
                <div className="p-4 flex flex-col gap-3">
                  {/* My properties - with management */}
                  {me?.properties?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: me.color }} />
                        <span className="text-xs font-extrabold uppercase tracking-widest"
                          style={{ color: '#9e216d', fontFamily: 'Plus Jakarta Sans' }}>
                          Your Properties ({me.properties.length})
                        </span>
                      </div>
                      {me.properties.map(propId => (
                        <PropertyManager key={propId} propertyId={propId} socket={socket} room={room} gameState={gameState} />
                      ))}
                    </div>
                  )}
                  {(!me?.properties?.length) && (
                    <div className="flex flex-col items-center py-8" style={{ color: '#88717a' }}>
                      <Icon name="location_city" size={40} className="opacity-30 mb-2" />
                      <p className="text-sm font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>No properties yet</p>
                    </div>
                  )}
                  {/* Other players' properties */}
                  {gameState?.players?.filter(p => p.id !== socket.id && !p.bankrupt && p.properties?.length > 0).map(player => (
                    <div key={player.id} className="mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: player.color }} />
                        <span className="text-xs font-extrabold uppercase tracking-widest"
                          style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
                          {player.name} ({player.properties.length})
                        </span>
                      </div>
                      {player.properties.map(propId => {
                        const tile = CITIES[propId];
                        if (!tile) return null;
                        const state = gameState.boardState[propId] || {};
                        return (
                          <div key={propId} className="rounded-lg overflow-hidden mb-1.5"
                            style={{ background: '#fff', border: '1px solid #eae7e7', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                            <div className={`h-1 w-full ${tile.color}`} />
                            <div className="px-3 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold" style={{ fontFamily: 'Plus Jakarta Sans', color: '#1b1c1c' }}>
                                  {tile.name}
                                </span>
                                {state.mortgaged && (
                                  <span className="text-[8px] px-1 py-0.5 rounded font-extrabold uppercase"
                                    style={{ background: '#ffdad6', color: '#ba1a1a' }}>M</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {(state.houses || 0) > 0 && (state.houses || 0) < 5 && (
                                  <span className="text-[9px] font-bold" style={{ color: '#52625a' }}>{state.houses}H</span>
                                )}
                                {state.houses === 5 && (
                                  <span className="text-[8px] font-black px-1 rounded" style={{ background: '#ba1a1a', color: '#fff' }}>H</span>
                                )}
                                <span className="text-[9px] font-bold" style={{ color: '#9e216d' }}>₹{tile.price}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'trade' && (
                <div className="p-4">
                  <TradeInterface socket={socket} gameState={gameState} me={me} room={room} />
                </div>
              )}
              {activeTab === 'guide' && (
                <div className="p-4">
                  <PropertyViewer />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full font-bold text-sm shadow-ambient-md"
          style={{ background: '#9e216d', color: '#fff', fontFamily: 'Plus Jakarta Sans' }}>
          {toast}
        </div>
      )}
    </div>
  );
}