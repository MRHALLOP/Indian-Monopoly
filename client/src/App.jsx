import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import BoardComponent from './host/BoardComponent';
import ControllerComponent from './mobile/ControllerComponent';

const socket = io.connect(`http://${window.location.hostname}:3001`);

function Icon({ name, fill = 0, size = 24, className = '' }) {
  return (
    <span className={`material-symbols-outlined select-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}` }}>
      {name}
    </span>
  );
}

// Unambiguous characters only (no O/0, I/1)
function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function App() {
  const [mode, setMode] = useState(null);
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room') || 'ABCD';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'host') {
      setMode('host');
    } else if (params.get('mode') === 'client') {
      setMode('client');
    } else {
      // Auto-detect mobile
      if (window.innerWidth < 768) setMode('client');
    }
  }, []);

  if (!mode) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-6"
        style={{ background: '#fcf9f8' }}>
        {/* Logo area */}
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: '#9e216d', boxShadow: '0 8px 24px rgba(158,33,109,0.3)' }}>
          <Icon name="casino" fill={1} size={44} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-center mb-2"
          style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>Indian Monopoly</h1>
        <p className="text-sm text-center mb-10" style={{ color: '#55414a', fontFamily: 'Plus Jakarta Sans' }}>
          Select how you&apos;re joining this session
        </p>

        {/* Host button — generates a fresh room code unless the URL already carries one */}
        <button onClick={() => { const code = params.get('room') || makeRoomCode(); window.location.href = `?mode=host&room=${code}`; }}
          className="w-full max-w-xs mb-3 p-5 rounded-2xl btn-press flex items-center gap-4 text-left"
          style={{
            background: '#fff', border: '2px solid #eae7e7',
            boxShadow: '0 4px 0 0 #dbbfc9, 0 8px 20px rgba(0,0,0,0.06)',
          }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#f0eded' }}>
            <Icon name="tv" fill={1} size={26} className="text-[#52625a]" />
          </div>
          <div>
            <p className="font-black text-base uppercase tracking-widest" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>TV / Laptop</p>
            <p className="text-xs mt-0.5" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>Host — Show the board</p>
          </div>
          <Icon name="chevron_right" size={22} className="text-[#88717a] ml-auto" />
        </button>

        {/* Controller button */}
        <button onClick={() => window.location.href = `?mode=client`}
          className="w-full max-w-xs p-5 rounded-2xl btn-press flex items-center gap-4 text-left"
          style={{
            background: '#9e216d',
            boxShadow: '0 4px 0 0 #6c164a, 0 8px 24px rgba(158,33,109,0.3)',
          }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Icon name="smartphone" fill={1} size={26} className="text-white" />
          </div>
          <div>
            <p className="font-black text-base uppercase tracking-widest text-white" style={{ fontFamily: 'Montserrat' }}>Phone</p>
            <p className="text-xs mt-0.5 text-pink-200" style={{ fontFamily: 'Plus Jakarta Sans' }}>Controller — Play the game</p>
          </div>
          <Icon name="chevron_right" size={22} className="text-pink-200 ml-auto" />
        </button>

        <p className="text-xs text-center mt-8" style={{ color: '#88717a', fontFamily: 'Plus Jakarta Sans' }}>
          All devices must be on the same Wi-Fi
        </p>
      </div>
    );
  }

  return mode === 'host' ? <BoardComponent socket={socket} room={room} /> : <ControllerComponent socket={socket} />;
}

export default App;