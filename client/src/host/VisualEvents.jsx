import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { CITIES } from '../constants';
import soundEngine from './AudioEngine';
import ExactTradeOverlay from './ExactTradeOverlay';

const PDF_COLORS = {
  'bg-amber-900': '#955436', // Brown
  'bg-sky-400': '#aae0fa',   // Light Blue
  'bg-pink-500': '#d93a96',  // Pink
  'bg-orange-400': '#f7941d', // Orange
  'bg-red-600': '#ed1b24',    // Red
  'bg-yellow-500': '#fef200', // Yellow
  'bg-yellow-400': '#fbbf24', // Yellow (Utility)
  'bg-green-600': '#1fb25a',  // Green
  'bg-blue-800': '#0072bb',   // Dark Blue
  'bg-blue-400': '#60a5fa',   // Blue (Water Works)
  'bg-gray-800': '#404040',   // Gray (Stations)
};

function getColorHex(tileColor) {
  if (!tileColor) return 'transparent';
  for (const [cls, hex] of Object.entries(PDF_COLORS)) {
    if (tileColor.includes(cls)) return hex;
  }
  return 'transparent';
}

// eslint-disable-next-line no-unused-vars
export default function VisualEvents({ socket, activeEvent, setActiveEvent, boardState, players }) {
  const [activeTrade, setActiveTrade] = useState(null);
  const event = activeEvent;

  const pendingTradeTimerRef = useRef(null);
  const resultTradeTimerRef = useRef(null);

  const clearTradeTimers = () => {
    if (pendingTradeTimerRef.current) clearTimeout(pendingTradeTimerRef.current);
    if (resultTradeTimerRef.current) clearTimeout(resultTradeTimerRef.current);
    pendingTradeTimerRef.current = null;
    resultTradeTimerRef.current = null;
  };

  useEffect(() => {
    if (activeEvent) {
      try {
        const soundByEvent = {
          BUY: () => soundEngine.playPurchase(),
          RENT: () => soundEngine.playRent(),
          BUILD: () => soundEngine.playBuild(),
          CARD_DRAW: () => soundEngine.playCardDraw(),
          JAIL: () => soundEngine.playJail(),
          BANKRUPT: () => soundEngine.playBankrupt(),
          GAME_OVER: () => soundEngine.playGameOver(),
        };
        soundByEvent[activeEvent.type]?.();
      } catch (e) {
        console.error('Error playing event sound:', e);
      }
    }
  }, [activeEvent]);

  useEffect(() => {
    const handleTriggerVisual = (data) => {
      if (data.type === 'TRADE_OFFER') {
        clearTradeTimers();
        setActiveTrade({ ...data, status: 'pending' });
        try {
          soundEngine.playTradeProposed();
        } catch (e) {
          console.error('Error playing trade proposed sound:', e);
        }

        // UI fails safe even if a response packet is lost.
        pendingTradeTimerRef.current = setTimeout(() => {
          setActiveTrade(current => current?.status === 'pending' ? null : current);
          pendingTradeTimerRef.current = null;
        }, 61_000);
        return;
      }

      if (data.type === 'TRADE_ACCEPTED' || data.type === 'TRADE_DECLINED') {
        if (pendingTradeTimerRef.current) clearTimeout(pendingTradeTimerRef.current);
        pendingTradeTimerRef.current = null;

        const status = data.type === 'TRADE_ACCEPTED' ? 'accepted' : 'declined';
        setActiveTrade(current => current ? { ...current, ...data, status } : null);
        try {
          if (status === 'accepted') soundEngine.playTradeAccepted();
          else soundEngine.playTradeDeclined();
        } catch (e) {
          console.error('Error playing trade result sound:', e);
        }

        resultTradeTimerRef.current = setTimeout(() => {
          setActiveTrade(null);
          resultTradeTimerRef.current = null;
        }, 4_000);
      }
    };

    socket.on('trigger_visual', handleTriggerVisual);
    if (import.meta.env.DEV) {
      window.__testTriggerVisual = handleTriggerVisual;
    }
    return () => {
      socket.off('trigger_visual', handleTriggerVisual);
      if (import.meta.env.DEV) {
        delete window.__testTriggerVisual;
      }
      clearTradeTimers();
    };
  }, [socket]);



  return (
    <AnimatePresence>
      {/* Standard Events (Rent, Buy, Draw) */}
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[200] flex items-center justify-center pointer-events-none ${(event.type === 'CARD_DRAW' || event.type === 'BUILD' || event.type === 'GAME_OVER') ? '' : 'bg-black/60 backdrop-blur-sm'}`}
        >

          {event.type === 'RENT' && (() => {
            const colorHex = getColorHex(event.tileColor) || '#1f2937';
            const isProperty = event.tileType === 'property' || (!event.tileType && event.tileRent && event.tileRent.length > 1);
            const isStation = event.tileType === 'station';
            const isUtility = event.tileType === 'utility';
            const rentIndex = event.houses || 0;

            return (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.35 }}
              className="relative flex items-center gap-[4vh] pointer-events-auto"
            >
              {/* Left: Full Property Card */}
              <motion.div
                initial={{ x: -100, rotate: -5 }}
                animate={{ x: 0, rotate: -3 }}
                transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.1 }}
                className="flex-shrink-0 z-20"
              >
                <div className="w-[24vh] bg-white border-[2px] border-black p-[0.375rem] shadow-2xl">
                  <div className="border-[1px] border-black flex flex-col overflow-hidden" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {/* Color header with city name */}
                    <div className="flex items-center justify-center py-[0.75rem] border-b border-black" style={{ backgroundColor: colorHex }}>
                      <h3 className="text-black font-black text-[1.25rem] uppercase tracking-wider text-center px-2">{event.city}</h3>
                    </div>

                    <div className="flex flex-col bg-white text-[0.875rem]">
                      {isProperty && event.tileRent && event.tileRent.length === 6 && (
                        <>
                          {/* Purchase Price */}
                          <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-[#cee8f5]">
                            <span className="text-[#1a6fa8] font-semibold">Purchase Price</span>
                            <span className="text-[#1a6fa8] font-bold">₹{event.tilePrice}</span>
                          </div>
                          {/* Mortgage Value */}
                          <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-white">
                            <span className="font-bold text-black text-[0.93rem]">Mortgage Value</span>
                            <span className="font-bold text-black text-[0.93rem]">₹{Math.floor(event.tilePrice / 2)}</span>
                          </div>
                          <div className="border-t-[2px] border-black mx-0"></div>

                          {/* Rent rows */}
                          <div className="flex flex-col px-[0.75rem] pt-[0.5rem] pb-[0.25rem]">
                            {/* Base rent */}
                            <div className={`flex justify-between items-center py-[0.25rem] ${rentIndex === 0 ? 'bg-pink-100 -mx-[0.75rem] px-[0.75rem] border-l-[0.25rem] border-pink-500 font-bold' : ''}`}>
                              <span className={rentIndex === 0 ? 'text-pink-700' : ''}>Rent</span>
                              <span className={rentIndex === 0 ? 'text-pink-700 font-black' : 'font-semibold'}>₹{event.tileRent[0]}</span>
                            </div>
                            {/* Rent with color set */}
                            <div className="flex justify-between items-center py-[0.25rem]">
                              <span>Rent with color set</span>
                              <span className="font-semibold">₹{event.tileRent[0] * 2}</span>
                            </div>
                            {/* Rent with 1-4 houses */}
                            {[1, 2, 3, 4].map(n => (
                              <div key={n} className={`flex justify-between items-center py-[0.25rem] ${rentIndex === n ? 'bg-pink-100 -mx-[0.75rem] px-[0.75rem] border-l-[0.25rem] border-pink-500 font-bold' : ''}`}>
                                <div className="flex items-center gap-[0.375rem]">
                                  <span className={rentIndex === n ? 'text-pink-700' : ''}>Rent with</span>
                                  <div className="relative w-[1.125rem] h-[1.125rem] bg-[#4caf50] flex items-center justify-center flex-shrink-0"
                                    style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}>
                                    <span className="text-white text-[0.55rem] font-black leading-none mt-[0.18rem]">{n}</span>
                                  </div>
                                </div>
                                <span className={rentIndex === n ? 'text-pink-700 font-black' : 'font-semibold'}>₹{event.tileRent[n]}</span>
                              </div>
                            ))}
                            {/* Rent with hotel */}
                            <div className={`flex justify-between items-center py-[0.25rem] ${rentIndex === 5 ? 'bg-pink-100 -mx-[0.75rem] px-[0.75rem] border-l-[0.25rem] border-pink-500 font-bold' : ''}`}>
                              <div className="flex items-center gap-[0.375rem]">
                                <span className={rentIndex === 5 ? 'text-pink-700' : ''}>Rent with</span>
                                <div className="w-[1.125rem] h-[1.125rem] bg-[#e53935] flex-shrink-0"
                                  style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                              </div>
                              <span className={rentIndex === 5 ? 'text-pink-700 font-black' : 'font-semibold'}>₹{event.tileRent[5]}</span>
                            </div>
                          </div>

                          <div className="border-t-[2px] border-black mx-0 mt-[0.25rem]"></div>

                          {/* House & Hotel costs */}
                          <div className="flex flex-col px-[0.75rem] pt-[0.5rem] pb-[0.75rem] gap-[0.25rem]">
                            <div className="flex justify-between items-center text-[0.8rem]">
                              <div className="flex items-center gap-[0.3rem]">
                                <div className="w-[0.75rem] h-[0.75rem] bg-[#4caf50] flex-shrink-0"
                                  style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                                <span>Houses cost</span>
                              </div>
                              <span className="font-semibold">₹{event.houseCost}</span>
                            </div>
                            <div className="flex justify-between items-center text-[0.8rem]">
                              <div className="flex items-center gap-[0.3rem]">
                                <div className="w-[0.75rem] h-[0.75rem] bg-[#e53935] flex-shrink-0"
                                  style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                                <span>Hotels cost</span>
                              </div>
                              <span className="font-semibold flex items-center gap-[2px]">
                                ₹{event.houseCost}(+4
                                <div className="w-[0.625rem] h-[0.625rem] bg-[#4caf50] inline-block"
                                  style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                                )
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {isStation && (
                        <div className="flex flex-col items-center py-[1rem] px-[0.75rem] text-[0.875rem]">
                          <img src="/monopoly_train.png" alt="Station" className="w-[4rem] h-[4rem] object-contain mb-[0.5rem]" />
                          <p className="font-bold mb-[0.5rem]">Rent based on stations owned:</p>
                          {[1, 2, 3, 4].map(n => (
                            <div key={n} className="flex justify-between w-full py-[0.25rem]">
                              <span>{n} Station{n > 1 ? 's' : ''}</span>
                              <span className="font-semibold">₹{[25, 50, 100, 200][n - 1]}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isUtility && (
                        <div className="flex flex-col items-center py-[1rem] px-[0.75rem] text-[0.875rem]">
                          <svg className="w-[3.5rem] h-[3.5rem] mb-[0.5rem]" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="28" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
                            <path d="M32 14 L38 28 L48 30 L40 38 L42 50 L32 44 L22 50 L24 38 L16 30 L26 28 Z" fill="#b45309" />
                          </svg>
                          <p className="font-bold mb-[0.25rem]">If one utility owned:</p>
                          <p className="mb-[0.5rem]">4 × dice roll</p>
                          <p className="font-bold mb-[0.25rem]">If both utilities owned:</p>
                          <p className="mb-[0.5rem]">10 × dice roll</p>
                          <div className="border-t border-gray-300 w-full mt-[0.5rem] pt-[0.5rem]">
                            <div className="flex justify-between text-[0.8rem]">
                              <span>Purchase Price</span>
                              <span className="font-bold">₹{event.tilePrice}</span>
                            </div>
                            <div className="flex justify-between text-[0.8rem]">
                              <span>Mortgage Value</span>
                              <span className="font-bold">₹{Math.floor(event.tilePrice / 2)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {!isProperty && !isStation && !isUtility && (
                        <div className="flex flex-col items-center py-[1.5rem] px-[0.75rem]">
                          <p className="text-[2rem] font-black text-[#d93a96] font-mono">₹{event.amount}</p>
                          <p className="text-[0.8rem] text-gray-500 mt-[0.25rem]">Rent Due</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right: Monopoly Man + Speech Bubble + Rent Due Banner */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 15, delay: 0.2 }}
                className="relative flex flex-col items-center z-20"
              >
                {/* Rent Due Banner */}
                <motion.div
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-pink-600 px-[2.5rem] py-[0.5rem] rounded-lg shadow-md mb-[1rem] text-center min-w-[15.6rem]"
                >
                  <h2 className="text-white font-bold text-[2.25rem] drop-shadow-md" style={{ fontFamily: 'Plus Jakarta Sans' }}>Rent Due</h2>
                </motion.div>

                {/* Speech bubble */}
                <div className="relative bg-white border-[3px] border-gray-300 rounded-2xl px-[1.5rem] py-[1rem] shadow-2xl mb-[0.5rem] min-w-[15rem]">
                  <div className="absolute bottom-[-1.1rem] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[0.75rem] border-l-transparent border-t-[1.1rem] border-t-gray-300 border-r-[0.75rem] border-r-transparent"></div>
                  <div className="absolute bottom-[-0.8rem] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[0.625rem] border-l-transparent border-t-[0.85rem] border-t-white border-r-[0.625rem] border-r-transparent z-10"></div>
                  <p className="text-[1.25rem] font-black text-zinc-900 text-center" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    <span className="text-red-500">{event.payer}</span> paid<br/>
                    <span className="text-[#d93a96] text-[1.5rem]">₹{event.amount}</span> to <span className="text-blue-600">{event.receiver}</span>
                  </p>
                </div>

                {/* Monopoly Man */}
                <img
                  src="/monopoly_man.png"
                  alt="Monopoly Man"
                  className="w-[18vh] h-auto object-contain drop-shadow-2xl"
                />
              </motion.div>
            </motion.div>
            );
          })()}

          {event.type === 'BUY' && (() => {
            const city = CITIES.find(c => c.name === event.card);
            const colorHex = city ? getColorHex(city.color) : '#1fb25a';
            const isProperty = city && city.rent && city.rent.length === 6;
            const isStation = city && city.type === 'station';
            const isUtility = city && city.type === 'utility';
            const mortgageValue = city ? Math.floor(city.price / 2) : 0;

            // Sparkle particles that burst outward
            const sparkles = Array.from({ length: 20 }, (_, i) => {
              const angle = (i / 20) * 360;
              const rad = (angle * Math.PI) / 180;
              const dist = 120 + Math.random() * 100;
              return {
                x: Math.cos(rad) * dist,
                y: Math.sin(rad) * dist,
                size: 5 + Math.random() * 8,
                color: [colorHex, '#fef200', '#ffffff', '#fbbf24', '#f472b6'][i % 5],
                delay: 0.5 + Math.random() * 0.3,
                duration: 0.8 + Math.random() * 0.4,
              };
            });

            // Sunray lines behind the card
            const rays = Array.from({ length: 16 }, (_, i) => ({ angle: (i / 16) * 360 }));

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 flex flex-col items-center justify-center z-50"
                style={{ background: `radial-gradient(ellipse at center, #0f1a0f 0%, #060b06 100%)` }}
              >
                {/* Blueprint grid overlay */}
                <div className="absolute inset-0 opacity-[0.05]" style={{
                  backgroundImage: `linear-gradient(${colorHex}55 1px, transparent 1px), linear-gradient(90deg, ${colorHex}55 1px, transparent 1px)`,
                  backgroundSize: '48px 48px',
                }} />

                {/* Rotating sunrays behind card */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute"
                  style={{ width: 600, height: 600 }}
                >
                  {rays.map((r, i) => (
                    <div
                      key={i}
                      className="absolute left-1/2 top-1/2 origin-left"
                      style={{
                        width: 300,
                        height: 2,
                        background: `linear-gradient(90deg, ${colorHex}00, ${colorHex}33, ${colorHex}00)`,
                        transform: `rotate(${r.angle}deg) translateY(-50%)`,
                      }}
                    />
                  ))}
                </motion.div>

                {/* Sparkle particles */}
                {sparkles.map((s, i) => (
                  <motion.div
                    key={`spark-${i}`}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{ x: s.x, y: s.y, opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                    transition={{ duration: s.duration, delay: s.delay, ease: 'easeOut' }}
                    className="absolute rounded-full pointer-events-none"
                    style={{ width: s.size, height: s.size, background: s.color, boxShadow: `0 0 ${s.size * 2}px ${s.color}` }}
                  />
                ))}

                {/* Card + Stamp container */}
                <div className="relative flex items-center justify-center">
                  {/* The bouncing property card */}
                  <motion.div
                    initial={{ y: -500, rotate: -15, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, rotate: [-8, 5, -3, 2, 0], opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 180, damping: 14, mass: 1.2, delay: 0.1 }}
                    className="relative"
                    style={{ filter: `drop-shadow(0 24px 48px ${colorHex}88)`, transform: 'scale(1.15)', transformOrigin: 'center top' }}
                  >
                    {/* Floating glow pulse under card */}
                    <motion.div
                      animate={{ scaleX: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: 200, height: 18, background: `radial-gradient(ellipse, ${colorHex}99 0%, transparent 70%)` }}
                    />

                    {/* The actual property card */}
                    <div className="bg-white shadow-2xl" style={{ width: 240, border: '3px solid black', fontFamily: "'Nunito', 'Plus Jakarta Sans', sans-serif" }}>
                    <div style={{ border: '1.5px solid black' }}>

                      {/* ── Color header ─────────────────────────────── */}
                      {isProperty && (
                        <div className="flex items-center justify-center" style={{ backgroundColor: colorHex, borderBottom: '2px solid black', padding: '11px 8px' }}>
                          <h3 style={{ color:'#fff', fontWeight:900, fontSize:15, letterSpacing:'0.12em', textTransform:'uppercase', textAlign:'center', textShadow:'0 1px 2px rgba(0,0,0,0.35)', margin:0 }}>{city.name}</h3>
                        </div>
                      )}
                      {isStation && (
                        <div className="flex items-center justify-center" style={{ backgroundColor:'#111', borderBottom:'2px solid black', padding:'10px 8px' }}>
                          <h3 style={{ color:'#fff', fontWeight:900, fontSize:14, letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center', margin:0 }}>🚂 {city.name}</h3>
                        </div>
                      )}
                      {isUtility && (
                        <div className="flex items-center justify-center" style={{ backgroundColor:'#555', borderBottom:'2px solid black', padding:'10px 8px' }}>
                          <h3 style={{ color:'#fff', fontWeight:900, fontSize:14, letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center', margin:0 }}>⚡ {city.name}</h3>
                        </div>
                      )}

                      {/* ── Purchase price (blue tinted) ─────────────── */}
                      <div className="flex justify-between items-center" style={{ backgroundColor:'#d6ecf8', borderBottom:'1.5px solid black', padding:'5px 10px' }}>
                        <span style={{ color:'#1a6fa8', fontWeight:700, fontSize:12 }}>Purchase Price</span>
                        <span style={{ color:'#1a6fa8', fontWeight:900, fontSize:12 }}>₹{city ? city.price : event.cost}</span>
                      </div>

                      {/* ── Mortgage value (white, bold) ─────────────── */}
                      <div className="flex justify-between items-center" style={{ backgroundColor:'#fff', borderBottom:'2px solid black', padding:'5px 10px' }}>
                        <span style={{ color:'#000', fontWeight:700, fontSize:12 }}>Mortgage Value</span>
                        <span style={{ color:'#000', fontWeight:900, fontSize:12 }}>₹{mortgageValue}</span>
                      </div>

                      {/* ── Rent rows — standard property ────────────── */}
                      {isProperty && city.rent && (
                        <div style={{ backgroundColor:'#fff', padding:'4px 10px 4px' }}>
                          <div className="flex justify-between items-center" style={{ padding:'3px 0', borderBottom:'0.75px solid #ccc' }}>
                            <span style={{ fontSize:11.5, color:'#222' }}>Rent</span>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'#111' }}>₹{city.rent[0]}</span>
                          </div>
                          <div className="flex justify-between items-center" style={{ padding:'3px 0', borderBottom:'0.75px solid #ccc' }}>
                            <span style={{ fontSize:11.5, color:'#222' }}>Rent with color set</span>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'#111' }}>₹{city.rent[0] * 2}</span>
                          </div>
                          {[1,2,3,4].map(n => (
                            <div key={n} className="flex justify-between items-center" style={{ padding:'3px 0', borderBottom:'0.75px solid #ccc' }}>
                              <div className="flex items-center" style={{ gap:4 }}>
                                <span style={{ fontSize:11.5, color:'#222' }}>Rent with</span>
                                <span className="inline-flex items-center justify-center text-white font-black" style={{ width:16, height:16, backgroundColor:'#3aaa35', clipPath:'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', fontSize:8, paddingTop:3, flexShrink:0 }}>{n}</span>
                              </div>
                              <span style={{ fontSize:11.5, fontWeight:700, color:'#111' }}>₹{city.rent[n]}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center" style={{ padding:'3px 0' }}>
                            <div className="flex items-center" style={{ gap:4 }}>
                              <span style={{ fontSize:11.5, color:'#222' }}>Rent with</span>
                              <span style={{ display:'inline-block', width:16, height:16, backgroundColor:'#e53935', clipPath:'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', flexShrink:0 }} />
                            </div>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'#111' }}>₹{city.rent[5]}</span>
                          </div>
                        </div>
                      )}

                      {/* ── Station rent rows ─────────────────────────── */}
                      {isStation && (
                        <div style={{ backgroundColor:'#fff', padding:'4px 10px' }}>
                          {[['Rent',25],['If 2 stations owned',50],['If 3 stations owned',100],['If 4 stations owned',200]].map(([label, rent], i, arr) => (
                            <div key={i} className="flex justify-between items-center" style={{ padding:'3px 0', borderBottom: i<arr.length-1 ? '0.75px solid #ccc' : 'none' }}>
                              <span style={{ fontSize:11.5, color:'#222' }}>{label}</span>
                              <span style={{ fontSize:11.5, fontWeight:700, color:'#111' }}>₹{rent}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── Utility rows ──────────────────────────────── */}
                      {isUtility && (
                        <div style={{ backgroundColor:'#fff', padding:'6px 10px' }}>
                          <div className="flex justify-between items-center" style={{ padding:'3px 0', borderBottom:'0.75px solid #ccc' }}>
                            <span style={{ fontSize:11.5, color:'#222' }}>If 1 utility owned</span>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'#111' }}>4× dice</span>
                          </div>
                          <div className="flex justify-between items-center" style={{ padding:'3px 0' }}>
                            <span style={{ fontSize:11.5, color:'#222' }}>If both owned</span>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'#111' }}>10× dice</span>
                          </div>
                        </div>
                      )}

                      {/* ── Footer: house + hotel cost ───────────────── */}
                      {isProperty && city.houseCost && (
                        <div style={{ borderTop:'2px solid black', backgroundColor:'#fff', padding:'4px 10px 6px' }}>
                          <div className="flex justify-between items-center" style={{ padding:'2px 0', borderBottom:'0.75px solid #ccc' }}>
                            <div className="flex items-center" style={{ gap:4 }}>
                              <span style={{ display:'inline-block', width:13, height:13, backgroundColor:'#3aaa35', clipPath:'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', flexShrink:0 }} />
                              <span style={{ fontSize:11, color:'#222' }}>Houses cost</span>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:'#111' }}>₹{city.houseCost}</span>
                          </div>
                          <div className="flex justify-between items-center" style={{ padding:'2px 0' }}>
                            <div className="flex items-center" style={{ gap:4 }}>
                              <span style={{ display:'inline-block', width:13, height:13, backgroundColor:'#e53935', clipPath:'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', flexShrink:0 }} />
                              <span style={{ fontSize:11, color:'#222' }}>Hotels cost</span>
                            </div>
                            <div className="flex items-center" style={{ gap:2 }}>
                              <span style={{ fontSize:11, fontWeight:700, color:'#111' }}>₹{city.houseCost}(+4</span>
                              <span style={{ display:'inline-block', width:10, height:10, backgroundColor:'#3aaa35', clipPath:'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', flexShrink:0 }} />
                              <span style={{ fontSize:11, fontWeight:700, color:'#111' }}>)</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>{/* /inner border */}
                    </div>{/* /card */}


                    {/* SOLD stamp — slams onto the card */}
                    <motion.div
                      initial={{ scale: 4, opacity: 0, rotate: -25 }}
                      animate={{ scale: 1, opacity: 1, rotate: -18 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.75 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div
                        className="border-[5px] px-6 py-3 rounded-lg"
                        style={{
                          borderColor: colorHex,
                          color: colorHex,
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 900,
                          fontSize: '2.8rem',
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          opacity: 0.92,
                          background: 'rgba(255,255,255,0.75)',
                          textShadow: `0 0 12px ${colorHex}`,
                          boxShadow: `0 0 20px ${colorHex}66, inset 0 0 10px ${colorHex}22`,
                        }}
                      >
                        SOLD
                      </div>
                    </motion.div>
                  </motion.div>
                </div>

                {/* Bottom banner */}
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 16, delay: 0.9 }}
                  className="mt-10 text-center"
                >
                  {/* Color accent bar */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, delay: 1.1 }}
                    className="h-[3px] rounded-full mb-4 mx-auto origin-center"
                    style={{ width: 320, background: `linear-gradient(90deg, transparent, ${colorHex}, transparent)` }}
                  />
                  <h1 className="text-4xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    <span title={event.player}>{event.player && event.player.length > 12 ? event.player.slice(0, 12) + '...' : event.player}</span> <span style={{ color: colorHex }}>ACQUIRED</span>
                  </h1>
                  <h2 className="text-2xl font-bold mt-1 uppercase tracking-widest" style={{ color: '#a1a1aa', fontFamily: 'Plus Jakarta Sans' }}>{event.card}</h2>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 250, delay: 1.2 }}
                    className="inline-block mt-3 px-8 py-2 rounded-2xl font-black text-3xl"
                    style={{
                      background: `linear-gradient(135deg, ${colorHex}22, ${colorHex}44)`,
                      border: `2px solid ${colorHex}`,
                      color: colorHex,
                      fontFamily: 'Montserrat, sans-serif',
                      boxShadow: `0 0 24px ${colorHex}55`,
                    }}
                  >
                    ₹{event.cost.toLocaleString()}
                  </motion.div>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, delay: 1.15 }}
                    className="h-[3px] rounded-full mt-4 mx-auto origin-center"
                    style={{ width: 320, background: `linear-gradient(90deg, transparent, ${colorHex}, transparent)` }}
                  />
                </motion.div>
              </motion.div>
            );
          })()}

          {event.type === 'BUILD' && (() => {
            const isHotel = event.houses === 5;
            const accentHex = getColorHex(event.color) || '#22c55e';
            const dustParticles = Array.from({ length: 14 }, (_, i) => {
              const angle = (i / 14) * 360;
              const rad = (angle * Math.PI) / 180;
              const dist = 80 + Math.random() * 60;
              return { x: Math.cos(rad) * dist, y: Math.sin(rad) * dist * 0.6, size: 4 + Math.random() * 6, delay: 0.9 + Math.random() * 0.15 };
            });
            const confettiParticles = isHotel ? Array.from({ length: 24 }, (_, i) => ({
              x: (Math.random() - 0.5) * 400,
              y: -(100 + Math.random() * 200),
              rotate: Math.random() * 720,
              color: ['#fef200', '#ed1b24', '#0072bb', '#1fb25a', '#d93a96', '#f7941d'][i % 6],
              delay: 1.2 + Math.random() * 0.5,
              size: 6 + Math.random() * 8,
            })) : [];

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 flex flex-col items-center justify-center z-50"
                style={{ background: 'radial-gradient(ellipse at center, #0f1729 0%, #060b16 100%)' }}
              >
                {/* Blueprint grid overlay */}
                <div className="absolute inset-0 opacity-[0.07]" style={{
                  backgroundImage: 'linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }} />
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: 'linear-gradient(rgba(56,189,248,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.4) 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                }} />

                {/* Chain / rope line from top to building */}
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-1 origin-top"
                  style={{ height: 'calc(50% - 70px)', background: 'repeating-linear-gradient(180deg, #94a3b8 0px, #94a3b8 8px, transparent 8px, transparent 16px)' }}
                />

                {/* Falling building container */}
                <motion.div
                  initial={{ y: -400, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 10, mass: 1.5, delay: 0.3 }}
                  className="relative"
                >
                  {/* Dust burst particles */}
                  {dustParticles.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                      animate={{ x: p.x, y: p.y + 30, opacity: [0, 0.8, 0], scale: [0, 1.2, 0.3] }}
                      transition={{ duration: 0.7, delay: p.delay, ease: 'easeOut' }}
                      className="absolute left-1/2 top-full rounded-full"
                      style={{ width: p.size, height: p.size, background: 'rgba(200, 180, 150, 0.7)', marginLeft: -p.size / 2 }}
                    />
                  ))}

                  {/* Impact flash ring */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 2.5, 3], opacity: [0, 0.5, 0] }}
                    transition={{ duration: 0.6, delay: 0.95 }}
                    className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 120, height: 40, border: `3px solid ${accentHex}`, filter: `drop-shadow(0 0 12px ${accentHex})` }}
                  />

                  {/* The SVG building */}
                  {isHotel ? (
                    <motion.svg
                      width="140" height="140" viewBox="0 0 140 140"
                      initial={{ filter: 'brightness(2)' }}
                      animate={{ filter: 'brightness(1)' }}
                      transition={{ duration: 0.5, delay: 1.0 }}
                    >
                      {/* Hotel body - front face */}
                      <rect x="15" y="35" width="90" height="85" rx="3" fill="#dc2626" />
                      {/* Hotel body - right side (3D) */}
                      <polygon points="105,35 135,20 135,105 105,120" fill="#991b1b" />
                      {/* Hotel body - top face (3D) */}
                      <polygon points="15,35 45,20 135,20 105,35" fill="#b91c1c" />
                      {/* Overhang ledge */}
                      <rect x="10" y="32" width="100" height="6" rx="1" fill="#7f1d1d" />
                      <polygon points="110,32 140,17 140,23 110,38" fill="#450a0a" />
                      {/* Windows row 1 */}
                      <rect x="25" y="48" width="14" height="14" rx="2" fill="#fef3c7" opacity="0.9" />
                      <rect x="53" y="48" width="14" height="14" rx="2" fill="#fef3c7" opacity="0.9" />
                      <rect x="81" y="48" width="14" height="14" rx="2" fill="#fef3c7" opacity="0.9" />
                      {/* Windows row 2 */}
                      <rect x="25" y="72" width="14" height="14" rx="2" fill="#fef3c7" opacity="0.7" />
                      <rect x="53" y="72" width="14" height="14" rx="2" fill="#fef3c7" opacity="0.7" />
                      <rect x="81" y="72" width="14" height="14" rx="2" fill="#fef3c7" opacity="0.7" />
                      {/* Door */}
                      <rect x="48" y="96" width="24" height="24" rx="3" fill="#450a0a" />
                      {/* H letter */}
                      <text x="60" y="67" textAnchor="middle" fontSize="0" fill="transparent">H</text>
                      <text x="60" y="30" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fef3c7" style={{ letterSpacing: '2px' }}>HOTEL</text>
                    </motion.svg>
                  ) : (
                    <motion.svg
                      width="120" height="120" viewBox="0 0 120 120"
                      initial={{ filter: 'brightness(2)' }}
                      animate={{ filter: 'brightness(1)' }}
                      transition={{ duration: 0.5, delay: 1.0 }}
                    >
                      {/* House body - front face */}
                      <rect x="15" y="55" width="70" height="55" rx="2" fill="#22c55e" />
                      {/* House body - right side (3D) */}
                      <polygon points="85,55 110,40 110,95 85,110" fill="#15803d" />
                      {/* Roof - front triangle */}
                      <polygon points="10,55 50,20 90,55" fill="#166534" />
                      {/* Roof - right side */}
                      <polygon points="90,55 50,20 75,8 110,40" fill="#14532d" />
                      {/* Roof ridge highlight */}
                      <line x1="50" y1="20" x2="75" y2="8" stroke="#22c55e" strokeWidth="2" opacity="0.5" />
                      {/* Door */}
                      <rect x="40" y="82" width="18" height="28" rx="9" fill="#14532d" />
                      {/* Door knob */}
                      <circle cx="53" cy="98" r="2" fill="#fbbf24" />
                      {/* Window */}
                      <rect x="25" y="64" width="12" height="12" rx="1" fill="#bbf7d0" opacity="0.8" />
                      <line x1="31" y1="64" x2="31" y2="76" stroke="#166534" strokeWidth="1" />
                      <line x1="25" y1="70" x2="37" y2="70" stroke="#166534" strokeWidth="1" />
                      <rect x="65" y="64" width="12" height="12" rx="1" fill="#bbf7d0" opacity="0.8" />
                      <line x1="71" y1="64" x2="71" y2="76" stroke="#166534" strokeWidth="1" />
                      <line x1="65" y1="70" x2="77" y2="70" stroke="#166534" strokeWidth="1" />
                    </motion.svg>
                  )}

                  {/* Ground shadow */}
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 0.4 }}
                    transition={{ delay: 0.9, duration: 0.3 }}
                    className="mx-auto rounded-full"
                    style={{ width: isHotel ? 140 : 120, height: 10, background: `radial-gradient(ellipse, ${accentHex}66 0%, transparent 70%)`, marginTop: -4 }}
                  />
                </motion.div>

                {/* Hotel confetti particles */}
                {confettiParticles.map((cp, i) => (
                  <motion.div
                    key={`confetti-${i}`}
                    initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0 }}
                    animate={{ x: cp.x, y: cp.y, opacity: [0, 1, 1, 0], rotate: cp.rotate, scale: [0, 1, 1, 0.5] }}
                    transition={{ duration: 1.5, delay: cp.delay, ease: 'easeOut' }}
                    className="absolute rounded-sm"
                    style={{ width: cp.size, height: cp.size * 0.6, background: cp.color }}
                  />
                ))}

                {/* Text banner */}
                <motion.div
                  initial={{ x: -600, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 80, damping: 14, delay: 1.1 }}
                  className="mt-8 text-center relative"
                >
                  {/* Color accent bar */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, delay: 1.3 }}
                    className="h-1.5 rounded-full mb-4 mx-auto origin-left"
                    style={{ width: 280, background: `linear-gradient(90deg, ${accentHex}, ${accentHex}88)` }}
                  />
                  <h1 className="text-5xl font-black text-white uppercase tracking-wide">
                    <span title={event.player}>{event.player && event.player.length > 12 ? event.player.slice(0, 12) + '...' : event.player}</span> <span style={{ color: accentHex }}>BUILT ON</span>
                  </h1>
                  <h2 className="text-4xl font-bold text-white mt-1 uppercase tracking-widest">{event.city}</h2>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, delay: 1.4 }}
                    className="h-1.5 rounded-full mt-4 mx-auto origin-right"
                    style={{ width: 280, background: `linear-gradient(270deg, ${accentHex}, ${accentHex}88)` }}
                  />
                </motion.div>

                {/* Level indicator & cost row */}
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 1.6 }}
                  className="mt-6 flex items-center gap-6"
                >
                  {/* House level icons */}
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-5 py-3 rounded-xl border border-white/20">
                    {isHotel ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.3, 1] }}
                        transition={{ delay: 1.8, duration: 0.4 }}
                        className="flex items-center gap-3"
                      >
                        {/* SVG Hotel icon */}
                        <svg width="32" height="32" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                          <rect x="2" y="8" width="26" height="26" fill="#dc2626" stroke="#fff" strokeWidth="1"/>
                          <polygon points="28,8 34,4 34,30 28,34" fill="#991b1b" stroke="#fff" strokeWidth="0.5"/>
                          <polygon points="0,8 28,8 34,4 6,4" fill="#7f1d1d" stroke="#fff" strokeWidth="0.5"/>
                          <text x="15" y="25" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="sans-serif">H</text>
                          <rect x="5" y="11" width="5" height="4" fill="#fef08a" rx="0.5"/>
                          <rect x="20" y="11" width="5" height="4" fill="#fef08a" rx="0.5"/>
                        </svg>
                        <span className="text-3xl font-black text-red-400 uppercase tracking-wider">HOTEL!</span>
                      </motion.div>
                    ) : (
                      Array.from({ length: event.houses }, (_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, y: -20 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 300, delay: 1.7 + i * 0.1 }}
                        >
                          {/* SVG House icon */}
                          <svg width="28" height="30" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="14" width="20" height="16" fill="#22c55e" stroke="#fff" strokeWidth="1"/>
                            <polygon points="24,14 28,11 28,27 24,30" fill="#15803d" stroke="#fff" strokeWidth="0.5"/>
                            <polygon points="2,14 14,4 26,14" fill="#166534" stroke="#fff" strokeWidth="1"/>
                            <polygon points="26,14 28,11 14,1 14,4" fill="#0f4c29" stroke="#fff" strokeWidth="0.5"/>
                            <rect x="10" y="22" width="8" height="8" fill="#854d0e" stroke="#fff" strokeWidth="0.5" rx="1"/>
                            <rect x="18" y="5" width="4" height="9" fill="#991b1b" stroke="#fff" strokeWidth="0.5"/>
                          </svg>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Cost badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.15, 1] }}
                    transition={{ delay: 1.9, duration: 0.4 }}
                    className="bg-black/60 backdrop-blur-sm border-2 px-6 py-3 rounded-xl font-mono text-3xl font-black text-emerald-400"
                    style={{ borderColor: accentHex }}
                  >
                    ₹{event.cost?.toLocaleString()}
                  </motion.div>
                </motion.div>
              </motion.div>
            );
          })()}

          {event.type === 'JAIL' && (() => {
            let jailReasonText = 'Sent directly to Jail!';
            if (event.reason === 'go_to_jail') jailReasonText = 'Landed on Go to Jail!';
            else if (event.reason === 'three_doubles') jailReasonText = 'Rolled three doubles in a row!';
            else if (event.reason === 'card') jailReasonText = 'Go Directly to Jail card!';
            return (
              <motion.div
                initial={{ opacity: 0, scale: 3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-zinc-900 w-full py-12 text-center border-y-[16px] border-black shadow-[0_0_100px_rgba(0,0,0,0.8)]"
              >
                <h1 className="text-8xl font-black text-red-500 tracking-widest uppercase">SENT TO JAIL!</h1>
                <p className="text-4xl text-zinc-100 font-bold mt-4 uppercase" title={event.player}>{event.player && event.player.length > 12 ? event.player.slice(0, 12) + '...' : event.player}</p>
                <p className="text-xl text-zinc-400 font-semibold mt-2 font-mono uppercase">{jailReasonText}</p>
              </motion.div>
            );
          })()}

          {event.type === 'BANKRUPT' && (
            <motion.div
              initial={{ opacity: 0, scale: 3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-red-700 w-full py-12 text-center border-y-[16px] border-black shadow-[0_0_100px_rgba(255,0,0,0.5)]"
            >
              <h1 className="text-8xl font-black text-white tracking-widest uppercase">BANKRUPT!</h1>
              <p className="text-4xl text-red-200 font-bold mt-4 uppercase" title={event.player}>{event.player && event.player.length > 12 ? event.player.slice(0, 12) + '...' : event.player} is out of the game!</p>
            </motion.div>
          )}

          {event.type === 'GAME_OVER' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-zinc-950 w-full py-16 text-center border-y-[16px] border-emerald-500 shadow-[0_0_120px_rgba(16,185,129,0.4)] flex flex-col items-center justify-center gap-4 relative z-[100]"
            >
              <Confetti width={window.innerWidth} height={window.innerHeight} numberOfPieces={300} gravity={0.15} />
              <h1 className="text-8xl font-black text-emerald-400 tracking-widest uppercase animate-bounce" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                🏆 VICTORY! 🏆
              </h1>
              <p className="text-4xl text-white font-extrabold uppercase tracking-wide" style={{ fontFamily: 'Plus Jakarta Sans' }} title={event.winner}>
                {event.winner && event.winner.length > 12 ? event.winner.slice(0, 12) + '...' : event.winner} WINS THE GAME!
              </p>
            </motion.div>
          )}

          {event.type === 'CARD_DRAW' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.4 }}
              className="relative w-[64vh] h-[40vh] flex items-center justify-center pointer-events-auto"
            >
              {/* Outer black border + white padding + inner black border */}
              <div className="w-full h-full bg-white border-[0.4vh] border-black p-[0.6vh] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
                <div className="w-full h-full border-[0.2vh] border-black flex flex-col relative overflow-hidden">

                  {/* Top Header */}
                  <h1 className="text-[3.2vh] font-black text-black uppercase tracking-widest text-center mt-[3vh]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {event.deck}
                  </h1>

                  <div className="flex-1 flex w-full relative">
                    {/* Left text area */}
                    <div className="flex flex-col items-center justify-center w-[55%] pl-[3vh] pr-[1vh]">
                      {event.card.split('.').filter(Boolean).map((line, i) => (
                        <p key={i} className="text-[2vh] font-bold text-black text-center mb-[2vh] last:mb-0 uppercase" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                          {line.trim() + '.'}
                        </p>
                      ))}
                    </div>

                    {/* Right side Monopoly Man */}
                    <div className="absolute right-[-1.5vh] bottom-[-1vh] w-[26vh] flex items-end justify-end">
                      <img
                        src="/monopoly_man.png"
                        alt="Monopoly Man"
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Real-time Trade Popup */}
      {activeTrade && (
        <ExactTradeOverlay
          activeTrade={activeTrade}
          tradeTimeLeft={60}
          boardState={boardState}
          players={players}
        />
      )}
    </AnimatePresence>
  );
}