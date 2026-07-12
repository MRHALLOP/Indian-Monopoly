import { useState } from 'react';
import { CITIES } from '../constants';

// Build color groups for display
const COLOR_GROUPS_MAP = {};
const STATIONS = [];
const UTILITIES = [];

CITIES.forEach(city => {
  if (city.type === 'station') {
    STATIONS.push(city);
  } else if (city.type === 'utility') {
    UTILITIES.push(city);
  } else if (city.color && !city.type && city.price) {
    if (!COLOR_GROUPS_MAP[city.color]) COLOR_GROUPS_MAP[city.color] = [];
    COLOR_GROUPS_MAP[city.color].push(city);
  }
});

// Map Tailwind class to readable color name and a hex value for styling
const COLOR_LABELS = {
  'bg-amber-900': { name: 'Brown', hex: '#78350f' },
  'bg-sky-400': { name: 'Light Blue', hex: '#38bdf8' },
  'bg-pink-500': { name: 'Pink', hex: '#ec4899' },
  'bg-orange-400': { name: 'Orange', hex: '#fb923c' },
  'bg-red-600': { name: 'Red', hex: '#dc2626' },
  'bg-yellow-500': { name: 'Yellow', hex: '#eab308' },
  'bg-green-600': { name: 'Green', hex: '#16a34a' },
  'bg-blue-800': { name: 'Dark Blue', hex: '#1e40af' },
};

// Circled number characters for house counts
const CIRCLED_NUMBERS = ['', '①', '②', '③', '④'];

// Small inline house icon (green square)
function HouseIcon() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '10px',
        height: '10px',
        backgroundColor: '#16a34a',
        borderRadius: '2px',
        marginRight: '3px',
        verticalAlign: 'middle',
      }}
    />
  );
}

// Small inline hotel icon (red square)
function HotelIcon() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '10px',
        height: '10px',
        backgroundColor: '#dc2626',
        borderRadius: '2px',
        marginRight: '3px',
        verticalAlign: 'middle',
      }}
    />
  );
}

// Generic row component for the property detail table
function DetailRow({ leftContent, rightText, bgColor, borderBottom = true, highlighted = false }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{
        backgroundColor: bgColor || '#fff',
        borderBottom: borderBottom ? '1px solid #eae7e7' : 'none',
        borderLeft: highlighted ? '3px solid #9e216d' : 'none',
        paddingLeft: highlighted ? '13px' : '16px',
      }}
    >
      <span
        className="text-xs tracking-wide"
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 600,
          color: '#55414a',
        }}
      >
        {leftContent}
      </span>
      <span
        className="font-mono text-sm"
        style={{ fontWeight: 700, color: '#1b1c1c' }}
      >
        {rightText}
      </span>
    </div>
  );
}

function PropertyCard({ property, colorHex, isExpanded, onToggle }) {
  const houseCost = property.houseCost || Math.round(property.price * 0.5);
  const rent = property.rent;
  const baseRent = rent[0];

  // All rows in the rent table section, with alternating backgrounds
  // Row index tracker for alternating bg (starts after Purchase Price & Mortgage rows)
  let rowIdx = 0;
  const altBg = () => (rowIdx++ % 2 === 0 ? '#fff' : '#f6f3f2');

  return (
    <div className="mb-2">
      {/* Collapsed button */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
        style={{
          backgroundColor: '#fff',
          border: '1px solid #eae7e7',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm uppercase tracking-wide"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1b1c1c' }}
          >
            {property.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-sm"
            style={{ fontWeight: 700, color: '#9e216d' }}
          >
            ₹{property.price.toLocaleString()}
          </span>
          <span
            className={`material-symbols-outlined transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            style={{ color: '#88717a', fontSize: '20px' }}
          >
            expand_more
          </span>
        </div>
      </button>

      {/* Expanded card */}
      {isExpanded && (
        <div
          className="mt-1 mx-1 rounded-xl overflow-hidden animate-[slideDown_0.2s_ease-out]"
          style={{ border: '1px solid #eae7e7', backgroundColor: '#fff' }}
        >
          {/* 1. Color band header */}
          <div
            className="w-full py-3 px-4 text-center"
            style={{ backgroundColor: colorHex || '#666' }}
          >
            <span
              className="text-sm uppercase tracking-widest"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '0.1em',
              }}
            >
              {property.name}
            </span>
          </div>

          {/* 2. Purchase Price row */}
          <DetailRow
            leftContent="Purchase Price"
            rightText={`₹${property.price.toLocaleString()}`}
            bgColor="#fff"
          />

          {/* 3. Mortgage Value row */}
          <DetailRow
            leftContent="Mortgage Value"
            rightText={`₹${(property.price * 0.5).toLocaleString()}`}
            bgColor="#f6f3f2"
          />

          {/* 4. Separator */}
          <div style={{ borderBottom: '2px solid #dbbfc9' }} />

          {/* 5. Rent row (HIGHLIGHTED) */}
          <DetailRow
            leftContent="Rent"
            rightText={`₹${baseRent.toLocaleString()}`}
            bgColor="#fdf2f6"
            highlighted={true}
          />

          {/* 6. Rent with colour set (double base rent) */}
          <DetailRow
            leftContent="Rent with colour set"
            rightText={`₹${(baseRent * 2).toLocaleString()}`}
            bgColor="#f6f3f2"
          />

          {/* 7-10. Rent with 1-4 houses */}
          {[1, 2, 3, 4].map(count => (
            <DetailRow
              key={`house-${count}`}
              leftContent={
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Rent with <HouseIcon />
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '1px solid #88717a',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#55414a',
                      lineHeight: 1,
                    }}
                  >
                    {count}
                  </span>
                </span>
              }
              rightText={`₹${rent[count].toLocaleString()}`}
              bgColor={count % 2 === 1 ? '#fff' : '#f6f3f2'}
            />
          ))}

          {/* 11. Rent with hotel */}
          <DetailRow
            leftContent={
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Rent with <HotelIcon />
              </span>
            }
            rightText={`₹${rent[5].toLocaleString()}`}
            bgColor="#f6f3f2"
          />

          {/* 12. Houses cost row */}
          <DetailRow
            leftContent={
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HouseIcon /> Houses cost
              </span>
            }
            rightText={`₹${houseCost.toLocaleString()}`}
            bgColor="#fff"
          />

          {/* 13. Hotels cost row */}
          <DetailRow
            leftContent={
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HotelIcon /> Hotels cost
              </span>
            }
            rightText={
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                ₹{houseCost.toLocaleString()}
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '14px', color: '#55414a' }}
                >
                  apartment
                </span>
              </span>
            }
            bgColor="#f6f3f2"
            borderBottom={false}
          />
        </div>
      )}
    </div>
  );
}

function ColorGroupSection({ colorClass, properties }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedProp, setExpandedProp] = useState(null);
  const colorInfo = COLOR_LABELS[colorClass] || { name: colorClass, hex: '#666' };

  return (
    <div className="mb-3">
      {/* Group Header */}
      <button
        onClick={() => { setIsOpen(!isOpen); setExpandedProp(null); }}
        className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all"
        style={{
          backgroundColor: '#fff',
          border: '1px solid #eae7e7',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="w-5 h-5 rounded-md shrink-0"
          style={{
            backgroundColor: colorInfo.hex,
            border: '1px solid #dbbfc9',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
          }}
        />
        <span
          className="uppercase tracking-widest text-sm flex-grow text-left"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1b1c1c' }}
        >
          {colorInfo.name}
        </span>
        <span
          className="text-xs"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#88717a' }}
        >
          {properties.length} PROPS
        </span>
        <span
          className={`material-symbols-outlined text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: '#88717a', fontSize: '20px' }}
        >
          expand_more
        </span>
      </button>

      {/* Expanded Properties */}
      {isOpen && (
        <div
          className="mt-2 ml-2 pl-4"
          style={{ borderLeft: '2px solid #dbbfc9' }}
        >
          {properties.map(prop => (
            <PropertyCard
              key={prop.id}
              property={prop}
              colorHex={colorInfo.hex}
              isExpanded={expandedProp === prop.id}
              onToggle={() => setExpandedProp(expandedProp === prop.id ? null : prop.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StationsSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all"
        style={{
          backgroundColor: '#fff',
          border: '1px solid #eae7e7',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center"
          style={{
            backgroundColor: '#f0eded',
            border: '1px solid #dbbfc9',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#55414a' }}>
            train
          </span>
        </div>
        <span
          className="uppercase tracking-widest text-sm flex-grow text-left"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1b1c1c' }}
        >
          Stations
        </span>
        <span
          className="text-xs"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#88717a' }}
        >
          {STATIONS.length} PROPS
        </span>
        <span
          className={`material-symbols-outlined text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: '#88717a', fontSize: '20px' }}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          className="mt-2 ml-2 pl-4"
          style={{ borderLeft: '2px solid #dbbfc9' }}
        >
          {STATIONS.map(station => (
            <div
              key={station.id}
              className="mb-2 px-4 py-3 rounded-xl"
              style={{
                backgroundColor: '#fff',
                border: '1px solid #eae7e7',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm uppercase tracking-wide"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1b1c1c' }}
                >
                  {station.name}
                </span>
                <span
                  className="font-mono text-sm"
                  style={{ fontWeight: 700, color: '#9e216d' }}
                >
                  ₹{station.price.toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          {/* Station Rent Rules */}
          <div
            className="rounded-xl overflow-hidden mb-2"
            style={{ border: '1px solid #eae7e7', backgroundColor: '#fff' }}
          >
            <div
              className="px-4 py-2.5"
              style={{ backgroundColor: '#f0eded', borderBottom: '1px solid #eae7e7' }}
            >
              <span
                className="text-xs uppercase tracking-wider"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#9e216d' }}
              >
                Rent by Stations Owned
              </span>
            </div>
            <div>
              {[
                { count: '1 Station', rent: 25 },
                { count: '2 Stations', rent: 50 },
                { count: '3 Stations', rent: 100 },
                { count: '4 Stations', rent: 200 },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{
                    backgroundColor: i % 2 === 0 ? '#fff' : '#f6f3f2',
                    borderBottom: i < 3 ? '1px solid #eae7e7' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '16px', color: '#55414a' }}
                    >
                      train
                    </span>
                    <span
                      className="text-xs uppercase tracking-wide"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#55414a' }}
                    >
                      {item.count}
                    </span>
                  </div>
                  <span
                    className="font-mono text-sm"
                    style={{ fontWeight: 700, color: '#1b1c1c' }}
                  >
                    ₹{item.rent.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            {/* Mortgage */}
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ backgroundColor: '#ffdad6', borderTop: '1px solid #eae7e7' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px', color: '#ba1a1a' }}
                >
                  description
                </span>
                <span
                  className="text-xs uppercase tracking-wider"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#93000a' }}
                >
                  Mortgage Value
                </span>
              </div>
              <span
                className="font-mono text-sm"
                style={{ fontWeight: 700, color: '#93000a' }}
              >
                ₹100
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UtilitiesSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all"
        style={{
          backgroundColor: '#fff',
          border: '1px solid #eae7e7',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center"
          style={{
            backgroundColor: '#eab308',
            border: '1px solid #dbbfc9',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#fff' }}>
            bolt
          </span>
        </div>
        <span
          className="uppercase tracking-widest text-sm flex-grow text-left"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1b1c1c' }}
        >
          Utilities
        </span>
        <span
          className="text-xs"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#88717a' }}
        >
          {UTILITIES.length} PROPS
        </span>
        <span
          className={`material-symbols-outlined text-lg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: '#88717a', fontSize: '20px' }}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          className="mt-2 ml-2 pl-4"
          style={{ borderLeft: '2px solid #dbbfc9' }}
        >
          {UTILITIES.map(util => (
            <div
              key={util.id}
              className="mb-2 px-4 py-3 rounded-xl"
              style={{
                backgroundColor: '#fff',
                border: '1px solid #eae7e7',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm uppercase tracking-wide"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1b1c1c' }}
                >
                  {util.name}
                </span>
                <span
                  className="font-mono text-sm"
                  style={{ fontWeight: 700, color: '#9e216d' }}
                >
                  ₹{util.price.toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          {/* Utility Rent Rules */}
          <div
            className="rounded-xl overflow-hidden mb-2"
            style={{ border: '1px solid #eae7e7', backgroundColor: '#fff' }}
          >
            <div
              className="px-4 py-2.5"
              style={{ backgroundColor: '#f0eded', borderBottom: '1px solid #eae7e7' }}
            >
              <span
                className="text-xs uppercase tracking-wider"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#9e216d' }}
              >
                Rent Rules
              </span>
            </div>
            <div>
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ backgroundColor: '#fff', borderBottom: '1px solid #eae7e7' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '16px', color: '#55414a' }}
                  >
                    bolt
                  </span>
                  <span
                    className="text-xs uppercase tracking-wide"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#55414a' }}
                  >
                    1 Utility
                  </span>
                </div>
                <span
                  className="font-mono text-sm"
                  style={{ fontWeight: 700, color: '#1b1c1c' }}
                >
                  4× Dice Roll
                </span>
              </div>
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ backgroundColor: '#f6f3f2' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '16px', color: '#55414a' }}
                  >
                    bolt
                  </span>
                  <span
                    className="text-xs uppercase tracking-wide"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#55414a' }}
                  >
                    2 Utilities
                  </span>
                </div>
                <span
                  className="font-mono text-sm"
                  style={{ fontWeight: 700, color: '#1b1c1c' }}
                >
                  10× Dice Roll
                </span>
              </div>
            </div>
            {/* Mortgage */}
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ backgroundColor: '#ffdad6', borderTop: '1px solid #eae7e7' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px', color: '#ba1a1a' }}
                >
                  description
                </span>
                <span
                  className="text-xs uppercase tracking-wider"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#93000a' }}
                >
                  Mortgage Value
                </span>
              </div>
              <span
                className="font-mono text-sm"
                style={{ fontWeight: 700, color: '#93000a' }}
              >
                ₹75
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PropertyViewer() {
  const colorGroups = Object.entries(COLOR_GROUPS_MAP);

  return (
    <div className="flex flex-col gap-1 pb-4">
      {/* Colour Groups */}
      {colorGroups.map(([colorClass, properties]) => (
        <ColorGroupSection key={colorClass} colorClass={colorClass} properties={properties} />
      ))}

      {/* Stations */}
      <StationsSection />

      {/* Utilities */}
      <UtilitiesSection />
    </div>
  );
}
