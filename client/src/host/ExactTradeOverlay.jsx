import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Confetti from 'react-confetti';
import { FaCarSide } from 'react-icons/fa';
import { CITIES } from '../constants';
import { TOKEN_ICONS } from '../components/TokenIcon';

/*
  DROP-IN USAGE INSIDE VisualEvents.jsx

  1. Add:
     import ExactTradeOverlay from './ExactTradeOverlay';

  2. Replace the entire existing `{activeTrade && (() => { ... })()}` block with:

     {activeTrade && (
       <ExactTradeOverlay
         activeTrade={activeTrade}
         tradeTimeLeft={tradeTimeLeft}
         boardState={boardState}
         players={players}
       />
     )}

  This component is a display-only 16:9 TV canvas. All values remain live.
*/

const money = value => Number(value || 0).toLocaleString('en-IN');
const property = id => CITIES.find(city => city.id === id);

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function bundleTitle(ids = [], cash = 0, jailCards = 0, limit = false) {
  const bits = [];
  if (cash > 0) bits.push(`₹${money(cash)}`);
  if (jailCards > 0) bits.push(`${jailCards} Jail Key${jailCards > 1 ? 's' : ''}`);
  const propertiesList = ids.map(property).filter(Boolean);
  if (propertiesList.length > 0) {
    if (limit && propertiesList.length > 2) {
      const firstTwo = propertiesList.slice(0, 2).map(item => item.name).join(', ');
      bits.push(`${firstTwo} + ${propertiesList.length - 2} more`);
    } else {
      bits.push(propertiesList.map(item => item.name).join(', '));
    }
  }
  return bits.length ? bits.join(' + ') : 'Nothing';
}

function bundleMeta(ids = [], cash = 0, jailCards = 0, boardState) {
  const bits = [];
  if (cash > 0) bits.push('Cash');
  if (jailCards > 0) bits.push('Jail Card');

  ids.map(property).filter(Boolean).forEach(item => {
    if (item.type === 'station') return bits.push('Station');
    if (item.type === 'utility') return bits.push('Utility');

    const raw = String(item.color || '')
      .replace('bg-', '')
      .replace(/-(400|500|600|800|900)$/, '');
    const setName = raw ? `${raw[0].toUpperCase()}${raw.slice(1)} set` : 'Property';
    const houses = boardState?.[item.id]?.houses || 0;
    if (houses === 5) bits.push(`${setName} · Hotel`);
    else if (houses > 0) bits.push(`${setName} · ${houses} house${houses > 1 ? 's' : ''}`);
    else bits.push(setName);
  });

  return bits.length ? bits.join(' · ') : 'No assets';
}

function bundleIcon(ids = [], cash = 0, jailCards = 0) {
  const first = property(ids[0]);
  if (first?.type === 'station') return '🚉';
  if (first?.type === 'utility') return '⚡';
  if (first) return '🏠';
  if (jailCards > 0) return '🔑';
  if (cash > 0) return '💵';
  return '🤝';
}

export default function ExactTradeOverlay({ activeTrade, tradeTimeLeft, boardState, players }) {
  const shouldReduceMotion = useReducedMotion();
  const [localTimeLeft, setLocalTimeLeft] = useState(tradeTimeLeft);
  const [prevTrade, setPrevTrade] = useState(activeTrade);
  const [prevTimeLeft, setPrevTimeLeft] = useState(tradeTimeLeft);

  if (activeTrade !== prevTrade || tradeTimeLeft !== prevTimeLeft) {
    setPrevTrade(activeTrade);
    setPrevTimeLeft(tradeTimeLeft);
    setLocalTimeLeft(tradeTimeLeft);
  }

  useEffect(() => {
    if (!activeTrade || activeTrade.status !== 'pending') return;
    const timer = setInterval(() => {
      setLocalTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTrade]);

  const initiator = players.find(player => player.name === activeTrade.initiatorName);
  const receiver = players.find(player => player.name === activeTrade.targetName);
  const leftColor = initiator?.color || '#5d35b5';
  const rightColor = receiver?.color || '#e46d54';
  const OffererIcon = TOKEN_ICONS[leftColor] || FaCarSide;
  const ReceiverIcon = TOKEN_ICONS[rightColor] || FaCarSide;

  const accepted = activeTrade.status === 'accepted';
  const declined = activeTrade.status === 'declined';
  const pending = activeTrade.status === 'pending';
  const stateColor = accepted ? 'var(--success)' : declined ? 'var(--danger)' : 'var(--left)';
  const heading = accepted ? 'DEAL COMPLETED' : declined ? 'DEAL REJECTED' : 'DEAL ON THE TABLE';
  const eyebrow = accepted ? 'Deal finalized' : declined ? 'Deal declined' : 'Incoming offer';
  const stamp = accepted ? 'DEAL COMPLETED!' : declined ? 'DEAL REJECTED' : `Needs your call, ${activeTrade.targetName}`;

  const offererInitial = shouldReduceMotion ? { opacity: 0 } : { x: '-6cqw', opacity: 0, rotate: -1.2 };
  const offererAnimate = shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1, rotate: -1.2 };

  const receiverInitial = shouldReduceMotion ? { opacity: 0 } : { x: '6cqw', opacity: 0, rotate: 1.2 };
  const receiverAnimate = shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1, rotate: 1.2 };

  const dealInitial = shouldReduceMotion ? { opacity: 0 } : { scale: .94, opacity: 0 };
  const dealAnimate = shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 };

  const stampInitial = shouldReduceMotion ? { opacity: 0 } : { scale: 2, opacity: 0, rotate: 20 };
  const stampAnimate = shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 6 };

  return (
    <motion.div
      className="exact-trade-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      style={{ '--left': leftColor, '--right': rightColor, '--state': stateColor }}
    >
      <style>{`
        .exact-trade-overlay {
          --ink: oklch(24% .035 305);
          --muted: oklch(49% .035 305);
          --paper: oklch(97% .018 95);
          --soft: oklch(93% .03 95);
          --line: oklch(83% .035 305);
          --yellow: oklch(84% .16 87);
          --cyan: oklch(72% .13 215);
          --success: oklch(67% .15 151);
          --danger: oklch(61% .19 26);
          position: fixed;
          inset: 0;
          z-index: 110;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: oklch(88% .035 305);
          font-family: "DM Sans", system-ui, sans-serif;
          color: var(--ink);
          pointer-events: auto;
        }
        .exact-trade-overlay * { box-sizing: border-box; }
        .exact-trade-overlay .tv {
          container-type: inline-size;
          position: relative;
          isolation: isolate;
          width: min(100vw, 177.7778vh);
          aspect-ratio: 16 / 9;
          overflow: hidden;
          display: grid;
          grid-template-rows: 5.25cqw 1fr 5.75cqw;
          background: var(--paper);
          border: .0625cqw solid oklch(78% .04 305);
          box-shadow: 0 1.125cqw 3.125cqw oklch(25% .04 305 / .13);
        }
        .exact-trade-overlay .tv::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          background-image: radial-gradient(circle at 1px 1px, oklch(44% .04 305 / .13) 1px, transparent 1px);
          background-size: 1.375cqw 1.375cqw;
        }
        .exact-trade-overlay .tv::after {
          content: "";
          position: absolute;
          z-index: -1;
          width: 26.25cqw;
          aspect-ratio: 1;
          border: 4.5cqw solid var(--yellow);
          border-radius: 50%;
          right: -13.125cqw;
          top: 5cqw;
          opacity: .45;
        }
        .exact-trade-overlay .topbar {
          padding: 0 2.75cqw;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          background: var(--paper);
          border-bottom: .0625cqw solid var(--line);
        }
        .exact-trade-overlay .brand {
          font: 400 1.375cqw/1 "Archivo Black", sans-serif;
          letter-spacing: -.04em;
        }
        .exact-trade-overlay .brand span { color: var(--left); }
        .exact-trade-overlay .phase {
          justify-self: center;
          color: var(--muted);
          font-size: .875cqw;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .exact-trade-overlay .room { justify-self: end; display: flex; gap: .5625cqw; }
        .exact-trade-overlay .mini {
          width: 2.125cqw;
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: .1875cqw solid var(--paper);
          box-shadow: 0 0 0 .0625cqw var(--line);
          color: oklch(98% .01 95);
          font-size: .75cqw;
          font-weight: 800;
        }
        .exact-trade-overlay .main {
          min-height: 0;
          padding: 2.125cqw 3.375cqw 1.875cqw;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 1.375cqw;
        }
        .exact-trade-overlay .heading { text-align: center; }
        .exact-trade-overlay .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: .5625cqw;
          color: var(--state);
          font-size: .8125cqw;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .exact-trade-overlay .eyebrow::before,
        .exact-trade-overlay .eyebrow::after {
          content: "";
          width: 2cqw;
          height: .125cqw;
          background: currentColor;
        }
        .exact-trade-overlay h1 {
          margin: .375cqw 0 0;
          font: 400 4.125cqw/.95 "Archivo Black", sans-serif;
          letter-spacing: -.055em;
        }
        .exact-trade-overlay .stage {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 1.25cqw;
          align-items: stretch;
        }
        .exact-trade-overlay .party {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5cqw 1.125cqw;
          text-align: center;
          background: var(--soft);
          border: .0625cqw solid var(--line);
        }
        .exact-trade-overlay .offerer { box-shadow: -.5625cqw .625cqw 0 var(--left); }
        .exact-trade-overlay .receiver { box-shadow: .5625cqw .625cqw 0 var(--right); }
        .exact-trade-overlay .role {
          margin-bottom: .75cqw;
          color: var(--muted);
          font-size: .75cqw;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .exact-trade-overlay .avatar {
          position: relative;
          width: 8cqw;
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          margin-bottom: 1cqw;
          border-radius: 50%;
          color: oklch(98% .01 95);
        }
        .exact-trade-overlay .offerer .avatar { background: var(--left); }
        .exact-trade-overlay .receiver .avatar { background: var(--right); }
        .exact-trade-overlay .avatar::after {
          content: "";
          position: absolute;
          inset: -.5cqw;
          border: .125cqw dashed currentColor;
          border-radius: 50%;
          opacity: .45;
        }
        .exact-trade-overlay .avatar svg { width: 48%; height: 48%; }
        .exact-trade-overlay .person {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font: 400 2.25cqw/1 "Archivo Black", sans-serif;
          letter-spacing: -.04em;
        }
        .exact-trade-overlay .balance {
          margin-top: .5cqw;
          color: var(--muted);
          font-size: 1cqw;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .exact-trade-overlay .balance strong { color: var(--ink); }
        .exact-trade-overlay .deal {
          min-width: 0;
          display: grid;
          grid-template-rows: 1fr auto 1fr;
          align-items: center;
          padding: 1.125cqw 1.625cqw;
          background: oklch(99% .008 95);
          border: .125cqw solid var(--ink);
          box-shadow: 0 .625cqw 0 var(--ink);
        }
        .exact-trade-overlay .bundle {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 1.125cqw;
        }
        .exact-trade-overlay .bundle.reverse {
          grid-template-columns: minmax(0, 1fr) auto;
          text-align: right;
        }
        .exact-trade-overlay .bundle.reverse .copy { order: 1; }
        .exact-trade-overlay .bundle.reverse .asset-icon { order: 2; }
        .exact-trade-overlay .asset-icon {
          width: 4cqw;
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          border-radius: 1.125cqw;
          background: var(--yellow);
          font-size: 1.9375cqw;
          transform: rotate(-4deg);
        }
        .exact-trade-overlay .reverse .asset-icon { background: var(--cyan); transform: rotate(4deg); }
        .exact-trade-overlay .copy { min-width: 0; }
        .exact-trade-overlay .bundle-label {
          color: var(--muted);
          font-size: .75cqw;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .exact-trade-overlay .bundle-title {
          margin-top: .3125cqw;
          overflow-wrap: anywhere;
          font: 400 2.375cqw/1.05 "Archivo Black", sans-serif;
          letter-spacing: -.04em;
        }
        .exact-trade-overlay .bundle-meta {
          margin-top: .3125cqw;
          color: var(--muted);
          font-size: .875cqw;
          font-weight: 600;
        }
        .exact-trade-overlay .swap {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: .75cqw;
          margin: .25cqw 0;
        }
        .exact-trade-overlay .swap::before,
        .exact-trade-overlay .swap::after { content: ""; height: .0625cqw; background: var(--line); }
        .exact-trade-overlay .swap span {
          width: 2.75cqw;
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--ink);
          color: var(--paper);
          font-size: 1.3125cqw;
          font-weight: 900;
        }
        .exact-trade-overlay .stamp {
          position: absolute;
          top: 6.75cqw;
          right: 3.625cqw;
          z-index: 5;
          padding: .375cqw .625cqw;
          border: .125cqw solid var(--state);
          background: var(--paper);
          color: var(--state);
          font: 400 .8125cqw/1 "Archivo Black", sans-serif;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .exact-trade-overlay .footer {
          padding: 1.125cqw 2.75cqw;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          background: oklch(35% .16 307);
          color: oklch(95% .015 95);
        }
        .exact-trade-overlay .phone-note {
          display: flex;
          align-items: center;
          gap: .75cqw;
          font-size: .9375cqw;
          font-weight: 700;
        }
        .exact-trade-overlay .phone {
          position: relative;
          width: 1.5625cqw;
          height: 2.4375cqw;
          border: .125cqw solid currentColor;
          border-radius: .375cqw;
        }
        .exact-trade-overlay .phone::after {
          content: "";
          position: absolute;
          left: .5625cqw;
          bottom: .1875cqw;
          width: .25cqw;
          aspect-ratio: 1;
          border-radius: 50%;
          background: currentColor;
        }
        .exact-trade-overlay .timer { text-align: center; }
        .exact-trade-overlay .timer-label {
          display: block;
          color: oklch(79% .05 305);
          font-size: .6875cqw;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .exact-trade-overlay .time {
          margin-top: .1875cqw;
          font: 400 1.75cqw/1 "Archivo Black", sans-serif;
          font-variant-numeric: tabular-nums;
        }
        .exact-trade-overlay .status {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: .625cqw;
          font-size: .875cqw;
          font-weight: 800;
        }
        .exact-trade-overlay .pulse {
          width: .625cqw;
          aspect-ratio: 1;
          border-radius: 50%;
          background: ${accepted ? 'var(--success)' : (declined || localTimeLeft === 0) ? 'var(--danger)' : 'var(--yellow)'};
          box-shadow: 0 0 0 .3125cqw color-mix(in oklch, var(--state) 20%, transparent);
          animation: tradePulse 1.7s cubic-bezier(.16,1,.3,1) infinite;
        }
        @keyframes tradePulse {
          0%,100% { transform: scale(.85); opacity: .65; }
          50% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .exact-trade-overlay .pulse { animation: none; }
        }
      `}</style>

      {accepted && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          numberOfPieces={260}
          recycle={false}
          gravity={0.28}
          colors={[leftColor, rightColor, '#fbbf24', '#f8f4e8', '#10b981']}
          style={{ position: 'fixed', inset: 0, zIndex: 120, pointerEvents: 'none' }}
        />
      )}

      <main className="tv" aria-label="Trading offer display">
        <header className="topbar">
          <div className="brand">INDIAN<span>MONOPOLY</span></div>
          <div className="phase">Live trade · Negotiation</div>
          <div className="room" aria-label="Players in the room">
            {players.map(player => (
              <div
                className="mini"
                key={player.id || player.name}
                style={{ background: player.color || 'var(--left)' }}
              >
                {initials(player.name)}
              </div>
            ))}
          </div>
        </header>

        <section className="main">
          <div className="heading">
            <div className="eyebrow">{eyebrow}</div>
            <h1>{heading}</h1>
          </div>

          <div className="stage">
            <motion.article
              className="party offerer"
              initial={offererInitial}
              animate={offererAnimate}
              transition={{ duration: .5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="role">Offer made by</div>
              <div className="avatar"><OffererIcon color="currentColor" /></div>
              <div className="person">{activeTrade.initiatorName}</div>
              <div className="balance">Balance <strong>₹{money(initiator?.cash)}</strong></div>
            </motion.article>

            <motion.article
              className="deal"
              initial={dealInitial}
              animate={dealAnimate}
              transition={{ duration: .5, delay: .08, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="bundle">
                <div className="asset-icon">{bundleIcon(activeTrade.offerPropertyIds, activeTrade.offerCash, activeTrade.offerJailCards)}</div>
                <div className="copy">
                  <div className="bundle-label">{activeTrade.initiatorName} gives</div>
                  <div
                    className="bundle-title"
                    title={bundleTitle(activeTrade.offerPropertyIds, activeTrade.offerCash, activeTrade.offerJailCards, false)}
                    style={{
                      fontSize: bundleTitle(activeTrade.offerPropertyIds, activeTrade.offerCash, activeTrade.offerJailCards, true).length > 42 ? '1.6cqw' : '2.375cqw',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {bundleTitle(activeTrade.offerPropertyIds, activeTrade.offerCash, activeTrade.offerJailCards, true)}
                  </div>
                  <div className="bundle-meta">{bundleMeta(activeTrade.offerPropertyIds, activeTrade.offerCash, activeTrade.offerJailCards, boardState)}</div>
                </div>
              </div>

              <div className="swap"><span>⇄</span></div>

              <div className="bundle reverse">
                <div className="copy">
                  <div className="bundle-label">{activeTrade.targetName} gives</div>
                  <div
                    className="bundle-title"
                    title={bundleTitle(activeTrade.requestPropertyIds, activeTrade.requestCash, activeTrade.requestJailCards, false)}
                    style={{
                      fontSize: bundleTitle(activeTrade.requestPropertyIds, activeTrade.requestCash, activeTrade.requestJailCards, true).length > 42 ? '1.6cqw' : '2.375cqw',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {bundleTitle(activeTrade.requestPropertyIds, activeTrade.requestCash, activeTrade.requestJailCards, true)}
                  </div>
                  <div className="bundle-meta">{bundleMeta(activeTrade.requestPropertyIds, activeTrade.requestCash, activeTrade.requestJailCards, boardState)}</div>
                </div>
                <div className="asset-icon">{bundleIcon(activeTrade.requestPropertyIds, activeTrade.requestCash, activeTrade.requestJailCards)}</div>
              </div>
            </motion.article>

            <motion.article
              className="party receiver"
              initial={receiverInitial}
              animate={receiverAnimate}
              transition={{ duration: .5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="role">{accepted ? 'Accepted by' : declined ? 'Declined by' : 'Waiting on'}</div>
              <div className="avatar"><ReceiverIcon color="currentColor" /></div>
              <div className="person">{activeTrade.targetName}</div>
              <div className="balance">Balance <strong>₹{money(receiver?.cash)}</strong></div>
            </motion.article>
          </div>
        </section>

        <motion.div
          className="stamp"
          initial={stampInitial}
          animate={stampAnimate}
          transition={{ duration: .55, delay: .2, ease: [0.16, 1, 0.3, 1] }}
        >
          {stamp}
        </motion.div>

        <footer className="footer">
          <div className="phone-note">
            <span className="phone" aria-hidden="true" />
            <span>{pending ? `${activeTrade.targetName}, answer on your phone` : accepted ? 'Deal approved on phone!' : 'Negotiation closed'}</span>
          </div>
          <div className="timer">
            <span className="timer-label">{pending ? 'Offer expires in' : 'Trade closed'}</span>
            <div className="time">{pending ? `00:${String(localTimeLeft).padStart(2, '0')}` : '--:--'}</div>
          </div>
          <div className="status"><span className="pulse" />{accepted ? 'Accepted' : declined ? 'Declined' : (localTimeLeft === 0 ? 'Offer expired' : 'Waiting for response')}</div>
        </footer>
      </main>
    </motion.div>
  );
}