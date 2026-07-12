import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';
import Confetti from 'react-confetti';
import * as THREE from 'three';
import { CITIES } from '../constants';

/* ─── Color map: Tailwind class → hex ─── */
const COLOR_HEX_MAP = {
  'bg-amber-900': '#955436',
  'bg-sky-400':   '#aae0fa',
  'bg-pink-500':  '#d93a96',
  'bg-orange-400':'#f7941d',
  'bg-red-600':   '#ed1b24',
  'bg-yellow-500':'#fef200',
  'bg-green-600': '#1fb25a',
  'bg-blue-800':  '#0072bb',
  'bg-gray-800':  '#404040',
  'bg-yellow-400':'#fbbf24',
  'bg-blue-400':  '#60a5fa',
  'bg-gray-500':  '#6b7280',
};

function getColorHex(tileColor) {
  if (!tileColor) return '#6b7280';
  for (const [cls, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (tileColor.includes(cls)) return hex;
  }
  return '#6b7280';
}

/* ─── House icon ─── */
function HouseIcon({ n, size = '1.6vh' }) {
  return (
    <span
      className="inline-flex items-center justify-center text-white font-black flex-shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: '#3aaa35',
        clipPath: 'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)',
        fontSize: '1vh',
        paddingTop: '0.15vh',
      }}
    >{n}</span>
  );
}

/* ─── Hotel icon ─── */
function HotelIcon({ size = '1.6vh' }) {
  return (
    <span
      className="inline-block flex-shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: '#e53935',
        clipPath: 'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)',
      }}
    />
  );
}

/* ════════════════════════════════════════════════════════
   THREE.JS  ─  MONOPOLY THEMED BACKGROUND (Gavel & Cash)
   ════════════════════════════════════════════════════════ */
function ThreeScene({ colorHex, isEnded, currentBid }) {
  const mountRef = useRef(null);
  
  // Refs for animation state
  const prevBidRef = useRef(currentBid);
  const strikeAnim = useRef({ active: false, time: 0 });
  const gavelRef = useRef(null);

  useEffect(() => {
    // Trigger strike animation if bid increases
    if (currentBid !== prevBidRef.current && currentBid > 0) {
      strikeAnim.current = { active: true, time: 0 };
    }
    prevBidRef.current = currentBid;
  }, [currentBid]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    const W = el.clientWidth;
    const H = el.clientHeight;

    /* Scene */
    const scene = new THREE.Scene();

    /* Camera */
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 4, 16);
    camera.lookAt(0, 1, 0);

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const themeCol = new THREE.Color(isEnded ? '#fbbf24' : colorHex);

    /* ── Floor / Desk ── */
    // Instead of a grid, let's have a subtle dark wooden desk reflection plane
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x110a05,
      metalness: 0.1,
      roughness: 0.8,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4;
    scene.add(floor);
    
    // Add a grid overlay just for a subtle structural feel
    const grid = new THREE.GridHelper(100, 40, themeCol, themeCol);
    grid.position.y = -3.98;
    grid.material.transparent = true;
    grid.material.opacity = 0.1;
    scene.add(grid);

    /* ── 3D Gavel Construction ── */
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.6, metalness: 0.1 });
    const woodLightMat = new THREE.MeshStandardMaterial({ color: 0x72421d, roughness: 0.5 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });

    const gavelGroup = new THREE.Group();
    gavelGroup.position.set(0, -1, -2);
    
    // Gavel Handle (rotates around its base)
    const handleGroup = new THREE.Group();
    handleGroup.position.set(0, 0, 0); // pivot point
    gavelGroup.add(handleGroup);

    const handleGeo = new THREE.CylinderGeometry(0.12, 0.22, 4, 32);
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.set(0, 2, 0); // shift up so base is at 0
    handleGroup.add(handle);

    // Gavel Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 3.6, 0);
    headGroup.rotation.z = Math.PI / 2;
    handleGroup.add(headGroup);

    const headCenterGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.8, 32);
    const headCenter = new THREE.Mesh(headCenterGeo, woodLightMat);
    headGroup.add(headCenter);

    const headEndGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.4, 32);
    const headEndLeft = new THREE.Mesh(headEndGeo, woodMat);
    headEndLeft.position.y = 1.1;
    headGroup.add(headEndLeft);

    const headEndRight = new THREE.Mesh(headEndGeo, woodMat);
    headEndRight.position.y = -1.1;
    headEndRight.rotation.x = Math.PI;
    headGroup.add(headEndRight);

    const brassBandGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.15, 32);
    const brassLeft = new THREE.Mesh(brassBandGeo, brassMat);
    brassLeft.position.y = 0.9;
    headGroup.add(brassLeft);
    const brassRight = new THREE.Mesh(brassBandGeo, brassMat);
    brassRight.position.y = -0.9;
    headGroup.add(brassRight);

    // Initial rotation of the handle so it rests at an angle
    handleGroup.rotation.x = Math.PI / 4; // Tilted back
    handleGroup.rotation.z = -Math.PI / 8; // Slightly angled sideways

    // Sounding Block
    const blockGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.6, 32);
    const block = new THREE.Mesh(blockGeo, woodMat);
    block.position.set(0, 0.3, 3); // positioned where the gavel strikes
    gavelGroup.add(block);
    
    const blockTopGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 32);
    const blockTop = new THREE.Mesh(blockTopGeo, woodLightMat);
    blockTop.position.set(0, 0.65, 3);
    gavelGroup.add(blockTop);

    // Save handleGroup to ref for animation
    gavelRef.current = handleGroup;
    scene.add(gavelGroup);

    /* ── Floating Monopoly Cash ── */
    const moneyCount = 60;
    const notes = [];
    const noteColors = [0x85bb65, 0xf7941d, 0x0072bb, 0xd93a96, 0xfef200]; // Monopoly bill colors
    
    const noteGeo = new THREE.PlaneGeometry(1.2, 0.6); // Aspect ratio of a bill
    
    for (let i = 0; i < moneyCount; i++) {
      const col = noteColors[Math.floor(Math.random() * noteColors.length)];
      const noteMat = new THREE.MeshStandardMaterial({ 
        color: col, 
        side: THREE.DoubleSide,
        roughness: 0.9,
      });
      const note = new THREE.Mesh(noteGeo, noteMat);
      
      // Random position in a volume
      note.position.set(
        (Math.random() - 0.5) * 40,
        Math.random() * 20 - 5,
        (Math.random() - 0.5) * 20 - 5
      );
      
      // Random rotation
      note.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      scene.add(note);
      notes.push({
        mesh: note,
        speedY: Math.random() * 0.04 + 0.01,
        rotX: Math.random() * 0.02 - 0.01,
        rotY: Math.random() * 0.03 - 0.015,
        rotZ: Math.random() * 0.02 - 0.01,
        driftX: Math.random() * 0.02 - 0.01,
      });
    }

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    
    const dLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dLight.position.set(5, 15, 10);
    dLight.castShadow = true;
    scene.add(dLight);
    
    const fillLight = new THREE.DirectionalLight(themeCol, 0.5);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    /* ── Animation loop ── */
    let raf;
    const t0 = performance.now();
    
    // Base resting rotations for the gavel
    const restRotX = Math.PI / 3.5;
    const restRotZ = -Math.PI / 12;
    
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = (performance.now() - t0) * 0.001;

      // Slowly drift camera
      camera.position.x = Math.sin(t * 0.15) * 1.5;
      camera.position.y = 4 + Math.cos(t * 0.1) * 0.5;
      camera.lookAt(0, 1, 0);

      // Animate floating cash
      notes.forEach(noteData => {
        const { mesh, speedY, rotX, rotY, rotZ, driftX } = noteData;
        mesh.position.y -= speedY;
        mesh.position.x += driftX;
        
        mesh.rotation.x += rotX;
        mesh.rotation.y += rotY;
        mesh.rotation.z += rotZ;
        
        // Loop around if they fall too far
        if (mesh.position.y < -8) {
          mesh.position.y = 18;
          mesh.position.x = (Math.random() - 0.5) * 40;
        }
      });

      // Gavel Strike Animation Logic
      if (strikeAnim.current.active && gavelRef.current) {
        strikeAnim.current.time += 0.06; // animation speed
        const st = strikeAnim.current.time;
        
        if (st < 1) {
          // Swing down
          gavelRef.current.rotation.x = restRotX + Math.sin(st * Math.PI) * 1.2;
        } else if (st < 1.2) {
          // Bounce back up slightly
          gavelRef.current.rotation.x = restRotX + 1.2 - (st - 1) * 2;
        } else {
          // Reset
          strikeAnim.current.active = false;
          gavelRef.current.rotation.x = restRotX;
        }
      } else if (gavelRef.current) {
        // Subtle resting idle breathing motion
        gavelRef.current.rotation.x = restRotX + Math.sin(t * 1.5) * 0.05;
        gavelRef.current.rotation.z = restRotZ + Math.cos(t * 1.2) * 0.02;
      }

      renderer.render(scene, camera);
    };
    animate();

    /* ── Resize ── */
    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      
      // Cleanup geometries and materials
      [floorGeo, floorMat, grid.geometry, grid.material, 
       handleGeo, woodMat, headCenterGeo, woodLightMat, headEndGeo, 
       brassBandGeo, brassMat, blockGeo, blockTopGeo, noteGeo].forEach(o => {
        if (o) o.dispose();
      });
      
      notes.forEach(n => {
        n.mesh.geometry.dispose();
        n.mesh.material.dispose();
      });
      
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [colorHex, isEnded]);

  return <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none" />;
}

/* ════════════════════════════════════════════
   ANIMATED BID VALUE
   ════════════════════════════════════════════ */
function AnimatedBidValue({ value }) {
  const digits = String(value).split('');
  return (
    <div className="flex items-end justify-center gap-1 select-none">
      <span style={{
        fontSize: '5rem', fontWeight: 900, lineHeight: 1.1,
        background: 'linear-gradient(160deg, #fff 0%, #fde68a 40%, #fb923c 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 4px 12px rgba(251,146,60,0.6))',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        alignSelf: 'flex-end', marginBottom: '0.8rem',
      }}>₹</span>
      {digits.map((digit, i) => (
        <AnimatePresence key={i} mode="wait">
          <motion.span
            key={`${i}-${digit}`}
            initial={{ y: -50, opacity: 0, rotateX: 90 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            exit={{ y: 50, opacity: 0, rotateX: -90 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18, delay: i * 0.04 }}
            style={{
              display: 'inline-block',
              fontSize: '8.5rem', fontWeight: 1000, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              background: 'linear-gradient(160deg, #ffffff 0%, #fde68a 30%, #f59e0b 70%, #ea580c 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 12px 30px rgba(234,88,12,0.8))',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: '-0.02em',
            }}
          >
            {digit}
          </motion.span>
        </AnimatePresence>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════
   MASSIVE MONOPOLY PROPERTY DEED CARD
   ════════════════════════════════════════════ */
function PropertyDeedCard({ city, colorHex, showSoldStamp }) {
  const isProperty = city.rent && city.rent.length === 6;
  const isStation  = city.type === 'station';
  const isUtility  = city.type === 'utility';
  const mortgageValue = Math.floor((city.price || 0) / 2);

  // Scaled up values for the massive aesthetic card
  return (
    <motion.div
      initial={{ rotateY: -180, opacity: 0, scale: 0.8 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.15 }}
      className="relative"
      style={{
        transformStyle: 'preserve-3d',
        perspective: 1500,
        filter: `drop-shadow(0 40px 80px ${colorHex}88) drop-shadow(0 20px 40px rgba(0,0,0,0.8))`,
      }}
    >
      {/* Glow halo beneath */}
      <motion.div
        animate={{ scaleX: [1, 1.25, 1], opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-full"
        style={{ width: '25vh', height: '2.2vh', background: `radial-gradient(ellipse, ${colorHex}dd 0%, transparent 75%)` }}
      />

      {/* Card body — Responsive width: 34vh (very little smaller than oversized 420px, which is ~39vh) */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="bg-white shadow-2xl"
        style={{ width: '34vh', border: '5.5px solid #000', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div style={{ border: '2.5px solid #000' }}>

          {/* Color header */}
          <div className="flex flex-col items-center justify-center relative overflow-hidden" style={{
            backgroundColor: colorHex,
            borderBottom: '3.5px solid #000',
            padding: '1.8vh 1.2vh 1.2vh',
          }}>
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1.5px, transparent 0, transparent 50%)',
              backgroundSize: '14px 14px',
            }} />
            <p className="relative animate-pulse" style={{ color: '#fff', fontWeight: 900, fontSize: '1.3vh', letterSpacing: '0.4em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>
              Property Deed
            </p>
            <h3 className="relative" style={{
              color: '#fff', fontWeight: 1000, fontSize: '3vh',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)', margin: 0,
            }}>{city.name}</h3>
          </div>

          {/* Purchase Price */}
          <div className="flex justify-between items-center" style={{ backgroundColor: '#cee8f5', borderBottom: '2.5px solid #000', padding: '0.9vh 1.5vh' }}>
            <span style={{ color: '#1a6fa8', fontWeight: 800, fontSize: '1.8vh' }}>Purchase Price</span>
            <span style={{ color: '#1a6fa8', fontWeight: 900, fontSize: '2vh' }}>₹{city.price || 0}</span>
          </div>

          {/* Mortgage Value */}
          <div className="flex justify-between items-center" style={{ backgroundColor: '#fff', borderBottom: '3.5px solid #000', padding: '0.9vh 1.5vh' }}>
            <span style={{ color: '#000', fontWeight: 800, fontSize: '1.8vh' }}>Mortgage Value</span>
            <span style={{ color: '#000', fontWeight: 900, fontSize: '2vh' }}>₹{mortgageValue}</span>
          </div>

          {/* Rent rows — standard property */}
          {isProperty && city.rent && (
            <div style={{ backgroundColor: '#fff', padding: '0.8vh 1.5vh' }}>
              <div className="flex justify-between items-center" style={{ padding: '0.45vh 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ fontSize: '1.8vh', color: '#333', fontWeight: 500 }}>Rent</span>
                <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>₹{city.rent[0]}</span>
              </div>
              <div className="flex justify-between items-center" style={{ padding: '0.45vh 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ fontSize: '1.8vh', color: '#333', fontWeight: 500 }}>Rent with color set</span>
                <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>₹{city.rent[0] * 2}</span>
              </div>
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="flex justify-between items-center" style={{ padding: '0.45vh 0', borderBottom: '1px solid #e5e5e5' }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ fontSize: '1.8vh', color: '#333', fontWeight: 500 }}>Rent with</span>
                    <HouseIcon n={n} size="2.2vh" />
                  </div>
                  <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>₹{city.rent[n]}</span>
                </div>
              ))}
              <div className="flex justify-between items-center" style={{ padding: '0.45vh 0' }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <span style={{ fontSize: '1.8vh', color: '#333', fontWeight: 500 }}>Rent with</span>
                  <HotelIcon size="2.2vh" />
                </div>
                <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>₹{city.rent[5]}</span>
              </div>
            </div>
          )}

          {/* Station rows */}
          {isStation && (
            <div style={{ backgroundColor: '#fff', padding: '0.9vh 1.5vh' }}>
              {[['Rent', 25], ['If 2 stations owned', 50], ['If 3 stations owned', 100], ['If 4 stations owned', 200]].map(([label, rent], i, arr) => (
                <div key={i} className="flex justify-between items-center" style={{ padding: '0.6vh 0', borderBottom: i < arr.length - 1 ? '1px solid #e5e5e5' : 'none' }}>
                  <span style={{ fontSize: '1.8vh', color: '#333' }}>{label}</span>
                  <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>₹{rent}</span>
                </div>
              ))}
            </div>
          )}

          {/* Utility rows */}
          {isUtility && (
            <div style={{ backgroundColor: '#fff', padding: '0.9vh 1.5vh' }}>
              <div className="flex justify-between items-center" style={{ padding: '0.6vh 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ fontSize: '1.8vh', color: '#333' }}>If 1 utility owned</span>
                <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>4× dice</span>
              </div>
              <div className="flex justify-between items-center" style={{ padding: '0.6vh 0' }}>
                <span style={{ fontSize: '1.8vh', color: '#333' }}>If both owned</span>
                <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>10× dice</span>
              </div>
            </div>
          )}

          {/* Houses & Hotels cost */}
          {isProperty && city.houseCost && (
            <div style={{ borderTop: '4px solid #000', backgroundColor: '#fff', padding: '0.8vh 1.5vh 1.1vh' }}>
              <div className="flex justify-between items-center" style={{ padding: '0.4vh 0', borderBottom: '1px solid #e5e5e5' }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <span style={{ display: 'inline-block', width: '1.8vh', height: '1.8vh', backgroundColor: '#3aaa35', clipPath: 'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', flexShrink: 0 }} />
                  <span style={{ fontSize: '1.7vh', color: '#444', fontWeight: 600 }}>Houses cost each</span>
                </div>
                <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>₹{city.houseCost}</span>
              </div>
              <div className="flex justify-between items-center" style={{ padding: '0.4vh 0' }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <span style={{ display: 'inline-block', width: '1.8vh', height: '1.8vh', backgroundColor: '#e53935', clipPath: 'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', flexShrink: 0 }} />
                  <span style={{ fontSize: '1.7vh', color: '#444', fontWeight: 600 }}>Hotels cost each</span>
                </div>
                <div className="flex items-center" style={{ gap: 4 }}>
                  <span style={{ fontSize: '1.8vh', fontWeight: 900, color: '#000' }}>₹{city.houseCost}</span>
                  <span style={{ fontSize: '1.6vh', color: '#666', fontWeight: 600 }}>+4</span>
                  <span style={{ display: 'inline-block', width: '1.5vh', height: '1.5vh', backgroundColor: '#3aaa35', clipPath: 'polygon(50% 0%, 100% 42%, 100% 100%, 0% 100%, 0% 42%)', flexShrink: 0 }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* SOLD stamp */}
      {showSoldStamp && (
        <motion.div
          initial={{ scale: 8, opacity: 0, rotate: -25 }}
          animate={{ scale: 1, opacity: 1, rotate: -18 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.4 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div style={{
            border: `9px solid ${colorHex}`,
            color: colorHex,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 1000, fontSize: '6vh',
            letterSpacing: '0.12em',
            background: 'rgba(255,255,255,0.95)',
            padding: '1.5vh 4.5vh', borderRadius: 12,
            textShadow: `0 0 25px ${colorHex}`,
            boxShadow: `0 0 50px ${colorHex}99, inset 0 0 24px ${colorHex}33`,
          }}>
            SOLD
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   PULSING LIVE DOT
   ════════════════════════════════════════════ */
function LiveDot() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
      <motion.div
        className="absolute rounded-full bg-red-500"
        animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        style={{ width: 16, height: 16 }}
      />
      <div className="rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" style={{ width: 10, height: 10 }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
export default function AuctionDisplay({ auctionState, allPlayers }) {
  if (!auctionState?.status) return null;

  const city      = CITIES.find(c => c.id === auctionState.propertyId) || {};
  const colorHex  = getColorHex(city.color);
  const isEnded   = auctionState.status === 'ended';

  const getPlayerName = (id) => {
    const name = allPlayers.find(p => p.id === id)?.name || '—';
    return name.length > 12 ? name.slice(0, 12) + '...' : name;
  };

  const rankedPlayers = [...allPlayers].sort((a, b) => {
    const aW = auctionState.highestBidder === a.id ? -2 : 0;
    const bW = auctionState.highestBidder === b.id ? -2 : 0;
    if (aW !== bW) return aW - bW;
    const aF = !auctionState.activePlayers?.includes(a.id) ? 1 : 0;
    const bF = !auctionState.activePlayers?.includes(b.id) ? 1 : 0;
    return aF - bF;
  });

  /* ── WINNER SCREEN ── */
  if (isEnded) {
    return (
      <motion.div
        className="fixed inset-0 z-50 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ background: `radial-gradient(ellipse at 40% 50%, #17110c 0%, #080604 100%)` }}
      >
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 1920}
          height={typeof window !== 'undefined' ? window.innerHeight : 1080}
          numberOfPieces={500}
          gravity={0.15}
          colors={[colorHex, '#85bb65', '#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#ffffff']}
        />

        {/* 3D background — transparent renderer with Gavel and Cash */}
        <ThreeScene colorHex={colorHex} isEnded={true} currentBid={auctionState.currentBid} />

        {/* Radial colour bloom */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at 50% 50%, ${colorHex}33 0%, transparent 70%)`,
        }} />

        {/* Content */}
        <div className="relative z-10 w-full h-full flex items-center justify-center gap-20 px-16 max-w-[1600px] mx-auto">
          {/* Property card */}
          <div className="flex-shrink-0">
            <PropertyDeedCard city={city} colorHex={colorHex} showSoldStamp={true} />
          </div>

          {/* Winner panel */}
          <motion.div
            initial={{ x: 100, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 90, damping: 18 }}
            className="flex flex-col items-center gap-6 rounded-3xl px-16 py-14"
            style={{
              background: 'rgba(20,14,5,0.85)',
              backdropFilter: 'blur(32px)',
              border: `2px solid ${colorHex}66`,
              boxShadow: `0 0 100px ${colorHex}44, 0 50px 150px rgba(0,0,0,0.9)`,
            }}
          >
            {/* SOLD! */}
            <motion.h1
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.2 }}
              style={{
                fontSize: '7rem', fontWeight: 1000, letterSpacing: '0.08em',
                background: `linear-gradient(135deg, #ffffff 0%, ${colorHex} 40%, #fbbf24 80%, #ffffff 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 50px ${colorHex}dd)`,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                lineHeight: 1,
              }}
            >
              SOLD!
            </motion.h1>

            {/* Property name */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55 }}
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: 800, letterSpacing: '0.4em', textTransform: 'uppercase' }}
            >
              {city.name}
            </motion.p>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              style={{ height: 2, width: 320, background: `linear-gradient(90deg, transparent, ${colorHex}, transparent)`, borderRadius: 99 }}
            />

            {/* Winner block */}
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, type: 'spring', stiffness: 120 }}
              className="flex flex-col items-center gap-5 w-full rounded-2xl px-12 py-8 mt-2"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.06) 100%)',
                border: '2px solid rgba(251,191,36,0.4)',
                boxShadow: '0 0 80px rgba(251,191,36,0.15)',
              }}
            >
              <motion.span
                className="text-6xl"
                animate={{ y: [0, -12, 0], rotate: [0, 8, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >🏆</motion.span>

              <div className="text-center mt-2">
                <p style={{ color: 'rgba(251,191,36,0.65)', fontSize: 13, fontWeight: 900, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Auction Winner
                </p>
                <p style={{
                  color: auctionState.winnerColor || '#fbbf24',
                  fontSize: '3rem', fontWeight: 1000,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  textShadow: `0 0 35px ${auctionState.winnerColor || '#fbbf24'}aa`,
                }} title={auctionState.winner}>
                  {auctionState.winner && auctionState.winner.length > 12 ? auctionState.winner.slice(0, 12) + '...' : auctionState.winner}
                </p>
              </div>

              {/* Final price */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.15, 1] }}
                transition={{ delay: 0.9, duration: 0.45 }}
                className="px-12 py-4 rounded-xl mt-4"
                style={{
                  background: `linear-gradient(135deg, ${colorHex}55, ${colorHex}22)`,
                  border: `3px solid ${colorHex}`,
                  boxShadow: `0 0 40px ${colorHex}77`,
                }}
              >
                <span style={{
                  color: '#fff', fontWeight: 1000, fontSize: '2.6rem',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  textShadow: '0 3px 8px rgba(0,0,0,0.7)',
                }}>
                  ₹{auctionState.finalPrice?.toLocaleString()}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  /* ── LIVE AUCTION SCREEN ── */
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ background: `radial-gradient(ellipse at 50% 60%, #15100c 0%, #050403 100%)` }}
    >
      {/* ── THREE.JS 3D BACKGROUND (Gavel & Cash) ── */}
      <ThreeScene colorHex={colorHex} isEnded={false} currentBid={auctionState.currentBid} />

      {/* Property color bloom in background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 50%, ${colorHex}25 0%, transparent 65%)`,
      }} />

      {/* Subtle scanline effect for that cinematic look */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
      }} />

      {/* ── MAIN LAYOUT ── */}
      <div className="relative z-10 w-full h-full flex flex-col px-12 py-8">

        {/* ─── TOP BAR ─── */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* LIVE badge */}
          <div className="flex items-center gap-3 px-6 py-3 rounded-full" style={{
            background: 'rgba(239,68,68,0.15)',
            border: '2px solid rgba(239,68,68,0.4)',
            boxShadow: '0 6px 30px rgba(239,68,68,0.25)',
            backdropFilter: 'blur(16px)',
          }}>
            <LiveDot />
            <span style={{ color: '#ef4444', fontSize: 14, fontWeight: 900, letterSpacing: '0.35em' }}>LIVE AUCTION</span>
          </div>

          {/* Title */}
          <motion.div
            className="flex items-center gap-4 px-8 py-3.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '2px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 10px 50px rgba(0,0,0,0.5)',
            }}
          >
            <motion.span
              className="text-2xl"
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >💰</motion.span>
            <h1 style={{
              fontSize: 22, fontWeight: 1000, letterSpacing: '0.25em', textTransform: 'uppercase',
              background: 'linear-gradient(90deg, #fcd34d, #f59e0b, #d97706)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              PROPERTY AUCTION
            </h1>
            <motion.span
              className="text-2xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
            >💰</motion.span>
          </motion.div>

          {/* Monopoly TV badge */}
          <div className="flex items-center gap-3 px-6 py-3 rounded-full" style={{
            background: 'rgba(255,255,255,0.05)',
            border: '2px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
          }}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 800, letterSpacing: '0.25em' }}>MONOPOLY TV</span>
          </div>
        </motion.div>

        {/* ─── 3-COLUMN LAYOUT ─── */}
        <div className="flex-1 flex items-center justify-between gap-16 min-h-0 w-full max-w-[1500px] mx-auto">

          {/* LEFT — Massive Property Deed Card */}
          <motion.div
            className="flex-shrink-0 flex justify-center items-center"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 70 }}
          >
            <PropertyDeedCard city={city} colorHex={colorHex} showSoldStamp={false} />
          </motion.div>

          {/* CENTER — Bid Display (Fully Transparent for 3D Gavel visibility) */}
          <motion.div
            className="flex-1 flex flex-col items-center justify-center gap-6 relative py-12 px-8 pointer-events-none"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 70 }}
          >
            {/* Property city tag floating above */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="flex items-center gap-3 px-6 py-2 rounded-full relative z-10"
              style={{
                background: `${colorHex}15`,
                border: `2px solid ${colorHex}44`,
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: colorHex, boxShadow: `0 0 10px ${colorHex}` }} />
              <span style={{ color: colorHex, fontSize: 14, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                {city.name}
              </span>
            </motion.div>

            {/* CURRENT BID label */}
            <div className="flex items-center gap-4 relative z-10 mt-6">
              <motion.div
                animate={{ scaleX: [0.5, 1.4, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{ height: 2.5, width: 80, background: `linear-gradient(90deg, transparent, ${colorHex}99)`, borderRadius: 99 }}
              />
              <span style={{ color: `${colorHex}ee`, fontSize: 16, fontWeight: 900, letterSpacing: '0.35em' }}>
                CURRENT BID
              </span>
              <motion.div
                animate={{ scaleX: [0.5, 1.4, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{ height: 2.5, width: 80, background: `linear-gradient(270deg, transparent, ${colorHex}99)`, borderRadius: 99 }}
              />
            </div>

            {/* Giant bid amount */}
            <div className="relative z-10 mb-8 mt-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={auctionState.currentBid}
                  initial={{ scale: 0.6, opacity: 0, rotateX: 45 }}
                  animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                  exit={{ scale: 1.4, opacity: 0, rotateX: -45 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                >
                  <AnimatedBidValue value={auctionState.currentBid} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Highest bidder badge */}
            <div className="relative z-10 min-h-[90px] flex items-center justify-center w-full mt-8">
              <AnimatePresence>
                {auctionState.highestBidder ? (
                  <motion.div
                    initial={{ y: 30, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                    className="flex items-center gap-5 px-10 py-4 rounded-3xl justify-center"
                    style={{
                      background: 'radial-gradient(ellipse, rgba(251,191,36,0.2) 0%, transparent 80%)',
                    }}
                  >
                    <motion.span
                      className="text-4xl"
                      animate={{ rotate: [0, -15, 15, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                    >👑</motion.span>
                    <div className="text-center">
                      <p style={{ color: 'rgba(251,191,36,0.65)', fontSize: 12, fontWeight: 900, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 4 }}>
                        HIGHEST BIDDER
                      </p>
                      <p style={{ color: '#fbbf24', fontSize: '2rem', fontWeight: 1000, fontFamily: "'Plus Jakarta Sans', sans-serif" }} title={allPlayers.find(p => p.id === auctionState.highestBidder)?.name || ''}>
                        {getPlayerName(auctionState.highestBidder)}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                    style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 600, letterSpacing: '0.05em' }}
                  >
                    Waiting for opening bid...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* RIGHT — Leaderboard */}
          <motion.div
            className="flex-shrink-0 flex flex-col overflow-hidden pointer-events-none"
            style={{ width: 360, height: '100%' }}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 70 }}
          >
            {/* Leaderboard header */}
            <div className="flex items-center justify-between px-8 py-6">
              <div className="flex items-center gap-4">
                <motion.span
                  className="text-3xl"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >🏅</motion.span>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 900, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 2 }}>
                    LIVE
                  </p>
                  <p style={{ color: '#fff', fontSize: 20, fontWeight: 1000, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    STANDINGS
                  </p>
                </div>
              </div>
            </div>

            {/* Player rows */}
            <div className="flex-1 flex flex-col justify-center gap-3 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'none' }}>
              {rankedPlayers.map((player, idx) => {
                const isFolded  = !auctionState.activePlayers?.includes(player.id);
                const isWinning = auctionState.highestBidder === player.id;

                return (
                  <motion.div
                    key={player.id}
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + idx * 0.08, type: 'spring', stiffness: 110 }}
                    className="relative rounded-3xl overflow-hidden"
                    style={{
                      background: isWinning
                        ? 'linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(251,191,36,0.06) 100%)'
                        : isFolded
                          ? 'rgba(255,255,255,0.02)'
                          : 'rgba(255,255,255,0.06)',
                      border: isWinning
                        ? '2px solid rgba(251,191,36,0.45)'
                        : isFolded
                          ? '1px solid rgba(255,255,255,0.03)'
                          : '1.5px solid rgba(255,255,255,0.08)',
                      boxShadow: isWinning ? '0 8px 30px rgba(251,191,36,0.15)' : 'none',
                    }}
                  >
                    {/* Winning left bar */}
                    {isWinning && (
                      <motion.div
                        className="absolute left-0 top-0 bottom-0 rounded-r-lg"
                        style={{ width: 6, background: 'linear-gradient(180deg, #fbbf24, #f59e0b)' }}
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}

                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* Rank */}
                      <span style={{
                        color: isWinning ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                        fontSize: idx === 0 ? 22 : 16,
                        fontWeight: 900,
                        width: 28,
                        textAlign: 'center',
                      }}>
                        {idx === 0 ? '👑' : idx + 1}
                      </span>

                      {/* Avatar */}
                      <motion.div
                        className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black"
                        style={{
                          backgroundColor: player.color || '#6b7280',
                          border: isWinning ? '2.5px solid rgba(251,191,36,0.7)' : '2px solid rgba(255,255,255,0.15)',
                          boxShadow: isWinning
                            ? `0 0 25px ${player.color}bb`
                            : isFolded ? 'none' : `0 0 10px ${player.color}77`,
                          fontSize: 20,
                          opacity: isFolded ? 0.4 : 1,
                        }}
                        animate={isWinning ? { boxShadow: [`0 0 15px ${player.color}99`, `0 0 35px ${player.color}dd`, `0 0 15px ${player.color}99`] } : {}}
                        transition={{ duration: 1.8, repeat: Infinity }}
                      >
                        {(player.name || '?')[0].toUpperCase()}
                      </motion.div>

                      {/* Name + info */}
                      <div className="flex-1 min-w-0">
                        <p style={{
                          fontSize: 17, fontWeight: 900,
                          color: isWinning ? '#fcd34d' : isFolded ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.95)',
                          textDecoration: isFolded ? 'line-through' : 'none',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          marginBottom: 4,
                        }} className="truncate" title={player.name}>
                          {player.name && player.name.length > 12 ? player.name.slice(0, 12) + '...' : player.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span style={{
                            fontSize: 12, fontWeight: 900,
                            color: isWinning ? '#fef08a' : '#85bb65', // monopoly money green
                            background: isWinning ? 'rgba(254,240,138,0.15)' : 'rgba(133,187,101,0.15)',
                            padding: '2px 8px', borderRadius: 6,
                          }}>
                            ₹{(player.cash || 0).toLocaleString()}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: 800,
                            color: 'rgba(255,255,255,0.35)',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 8px', borderRadius: 6,
                          }}>
                            🏠 {player.properties?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom stats panel */}
            <div className="px-8 py-6 flex flex-col gap-3 mt-auto">
              {[
                { label: 'Property', value: city.name, color: colorHex },
                { label: 'Starting Price', value: `₹${city.price || 0}`, color: 'rgba(255,255,255,0.5)' },
                { label: 'Current Bid', value: `₹${auctionState.currentBid}`, color: '#fbbf24' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 900, color }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ─── BOTTOM BAR ─── */}
        <motion.div
          className="flex items-center justify-between pt-6 mt-4"
          style={{ borderTop: '2px solid rgba(255,255,255,0.06)' }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.8, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Players bid from their phones
            </span>
          </div>

          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colorHex }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>

          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Waiting for bids
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}