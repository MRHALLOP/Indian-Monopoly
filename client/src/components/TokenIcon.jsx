/* eslint-disable react-refresh/only-export-components */
import { FaMotorcycle, FaTrain, FaBus, FaTractor, FaCrown, FaPlane, FaCarSide } from 'react-icons/fa';

export const TOKEN_ICONS = {
  '#ef4444': FaMotorcycle, // Red: Auto/Scooter
  '#3b82f6': FaTrain,      // Blue: Train
  '#10b981': FaBus,        // Emerald: Bus
  '#f59e0b': FaTractor,    // Amber: Tractor
  '#8b5cf6': FaCrown,      // Violet: Crown/Raja
  '#ec4899': FaPlane,      // Pink: Plane
  '#14b8a6': FaCarSide     // Teal: Fallback Car
};

export default function TokenIcon({ color, size = 24, className = "" }) {
  const Icon = TOKEN_ICONS[color] || FaCarSide;
  
  // Create a 3D-ish looking token using drop shadows
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Subtle base shadow for 3D effect */}
      <div 
        className="absolute bottom-[-10%] w-[80%] h-[20%] rounded-full bg-black/60 blur-[2px]"
      />
      {/* The actual icon, colored in a slightly metallic way, but tinted by the player color */}
      <Icon 
        size={size * 0.9} 
        color={color}
        style={{
          filter: `drop-shadow(1px 2px 1px rgba(0,0,0,0.8)) drop-shadow(-1px -1px 0px rgba(255,255,255,0.4))`,
          stroke: 'black',
          strokeWidth: '10'
        }}
      />
    </div>
  );
}
