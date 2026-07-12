import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CITIES } from '../constants';
import VisualEvents from './VisualEvents';
import AuctionDisplay from './AuctionDisplay';
import TokenIcon from '../components/TokenIcon';
import soundEngine from './AudioEngine';


const PDF_COLORS = {
  'bg-amber-900': '#955436', // Brown
  'bg-sky-400': '#aae0fa',   // Light Blue
  'bg-pink-500': '#d93a96',  // Pink
  'bg-orange-400': '#f7941d', // Orange
  'bg-red-600': '#ed1b24',    // Red
  'bg-yellow-500': '#fef200', // Yellow
  'bg-green-600': '#1fb25a',  // Green
  'bg-blue-800': '#0072bb',   // Dark Blue
};

function getColorHex(tileColor) {
  if (!tileColor) return 'transparent';
  for (const [cls, hex] of Object.entries(PDF_COLORS)) {
    if (tileColor.includes(cls)) return hex;
  }
  return 'transparent';
}

function PropertyCardPopup({ landedTile }) {
  useEffect(() => {
    try {
      soundEngine.playCardFlip();
    } catch (e) {
      console.warn('Error playing flip sound on popup mount:', e);
    }
  }, []);

  if (!landedTile) return null;

  const {
    tileName, tileColor, tilePrice, tileRent, tileType,
    houseCost, playerName, playerColor, context, amount, ownerName, ownerColor
  } = landedTile;

  if (context === 'rent_due' || context === 'chance' || context === 'community_chest' || tileName === 'Chance' || tileName === 'Community Chest') {
    return null;
  }

  const colorHex = getColorHex(tileColor);
  const isProperty = tileType === 'property' || (!tileType && tileRent && tileRent.length > 1);
  const isStation = tileType === 'station';
  const isUtility = tileType === 'utility';
  const isSpecialCard = ['GO', 'Jail', 'Free Parking', 'Go to Jail', 'Income Tax', 'Luxury Tax'].includes(tileName);
  const mortgageValue = tilePrice ? Math.floor(tilePrice / 2) : null;

  let ribbonText = '';
  if (context === 'for_sale') ribbonText = 'For sale';
  else if (context === 'rent_due') ribbonText = 'Rent Due';
  else if (context === 'tax') ribbonText = 'Tax Due';
  else ribbonText = 'Landed';

  let specialHeaderBg = '#1f2937'; // Default dark gray
  if (tileName === 'GO') specialHeaderBg = '#ed1b24'; // Red
  else if (tileName === 'Jail') specialHeaderBg = '#4b5563'; // Gray
  else if (tileName === 'Go to Jail') specialHeaderBg = '#1e3a8a'; // Dark Blue
  else if (tileName === 'Free Parking') specialHeaderBg = '#f59e0b'; // Amber

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        transition={{ type: 'spring', bounce: 0.4 }}
        className="relative w-[62vh] h-[48vh] flex items-center justify-center gap-[4vh] pointer-events-auto"
      >
        {/* --- Top Ribbon Banner --- */}
        <div className="absolute top-[-5vh] left-1/2 -translate-x-1/2 z-[60] drop-shadow-lg flex flex-col items-center">
          {/* Player Token (Only show for 'for_sale' or 'rent_due') */}
          {(context === 'for_sale' || context === 'rent_due') && (
            <div className="absolute top-[-2.2rem] bg-white rounded-full p-[0.375rem] w-[3.5rem] h-[3.5rem] shadow-lg z-[70] flex items-center justify-center border-4 border-gray-100">
              <TokenIcon color={playerColor} size={28} />
            </div>
          )}
          <div className="relative">
            {/* Main Ribbon Body */}
            <div className={`relative ${context === 'for_sale' ? 'bg-[#9810ea]' : 'bg-pink-600'} px-[2.5rem] py-[0.5rem] rounded-lg shadow-md text-center min-w-[15.6rem]`}>
              <h2 className="text-white font-bold text-[2.25rem] drop-shadow-md" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {context === 'for_sale' ? 'For sale' : ribbonText}
              </h2>
            </div>
          </div>
        </div>

        {/* --- Left Side: The Card --- */}
        {(isProperty || isStation || isUtility) && (
          <div className="pointer-events-auto z-20 -rotate-[2deg] origin-center flex-shrink-0">
            <div>
              {/* Outer card border */}
              <div className="w-[24vh] bg-white border-[2px] border-black p-[0.375rem] shadow-2xl">
                {/* Inner border wrapper */}
                <div className="border-[1px] border-black flex flex-col overflow-hidden">
                  {/* Card Header — colored band */}
                  {isProperty && (
                    <div className="flex items-center justify-center py-[0.75rem] border-b border-black" style={{ backgroundColor: colorHex }}>
                      <h3 className="text-black font-black text-[1.25rem] uppercase tracking-wider" style={{ fontFamily: 'Plus Jakarta Sans' }}>{tileName}</h3>
                    </div>
                  )}

                  {/* Card Body */}
                  <div className="flex flex-col bg-white text-[0.875rem]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {isProperty && tileRent && tileRent.length === 6 && (
                      <>
                        {/* Purchase Price — light blue bg, blue text */}
                        <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-[#cee8f5]">
                          <span className="text-[#1a6fa8] font-semibold">Purchase Price</span>
                          <span className="text-[#1a6fa8] font-bold">₹{tilePrice}</span>
                        </div>
                        {/* Mortgage Value — white bg, bold black text */}
                        <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-white">
                          <span className="font-bold text-black text-[0.93rem]">Mortgage Value</span>
                          <span className="font-bold text-black text-[0.93rem]">₹{Math.floor(tilePrice / 2)}</span>
                        </div>
                        {/* Thick separator line */}
                        <div className="border-t-[2px] border-black mx-0"></div>

                        {/* Rent rows */}
                        <div className="flex flex-col px-[0.75rem] pt-[0.5rem] pb-[0.25rem]">
                          <div className="flex justify-between items-center py-[0.25rem]">
                            <span>Rent</span>
                            <span className="font-semibold">₹{tileRent[0]}</span>
                          </div>
                          <div className="flex justify-between items-center py-[0.25rem]">
                            <span>Rent with color set</span>
                            <span className="font-semibold">₹{tileRent[0] * 2}</span>
                          </div>
                          {[1, 2, 3, 4].map(n => (
                            <div key={n} className="flex justify-between items-center py-[0.25rem]">
                              <div className="flex items-center gap-[0.375rem]">
                                <span>Rent with</span>
                                {/* Green house with number */}
                                <div className="relative w-[1.125rem] h-[1.125rem] bg-[#4caf50] flex items-center justify-center flex-shrink-0"
                                  style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}>
                                  <span className="text-white text-[0.55rem] font-black leading-none mt-[0.18rem]">{n}</span>
                                </div>
                              </div>
                              <span className="font-semibold">₹{tileRent[n]}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center py-[0.25rem]">
                            <div className="flex items-center gap-[0.375rem]">
                              <span>Rent with</span>
                              {/* Red hotel */}
                              <div className="w-[1.125rem] h-[1.125rem] bg-[#e53935] flex-shrink-0"
                                style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                            </div>
                            <span className="font-semibold">₹{tileRent[5]}</span>
                          </div>
                        </div>

                        {/* Thick separator */}
                        <div className="border-t-[2px] border-black mx-0 mt-[0.25rem]"></div>

                        {/* House & Hotel costs */}
                        <div className="flex flex-col px-[0.75rem] pt-[0.5rem] pb-[0.75rem] gap-[0.25rem]">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-[0.3rem]">
                              <div className="w-[0.75rem] h-[0.75rem] bg-[#4caf50] flex-shrink-0"
                                style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                              <span className="text-[0.8rem]">Houses cost</span>
                            </div>
                            <span className="font-semibold text-[0.8rem]">₹{houseCost}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-[0.3rem]">
                              <div className="w-[0.75rem] h-[0.75rem] bg-[#e53935] flex-shrink-0"
                                style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                              <span className="text-[0.8rem]">Hotels cost</span>
                            </div>
                            <span className="font-semibold text-[0.8rem] flex items-center gap-[2px]">
                              ₹{houseCost}(+4
                              <div className="w-[0.625rem] h-[0.625rem] bg-[#4caf50] inline-block"
                                style={{ clipPath: 'polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%)' }}></div>
                              )
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {isStation && (
                      <>
                        <div className="flex flex-col items-center pt-[1.5rem] pb-[0.5rem]">
                          <img src="/monopoly_train.png" alt="Train" className="w-[5.3rem] h-[5.3rem] object-contain mb-[0.75rem]" />
                          <h3 className="text-black font-black text-[1.25rem] uppercase text-center leading-tight tracking-wider px-[1rem] whitespace-pre-line">
                            {tileName.replace(' Station', '\nStation')}
                          </h3>
                        </div>
                        <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-[#cee8f5] mt-[0.25rem]">
                          <span className="text-[#1a6fa8] font-semibold">Purchase Price</span>
                          <span className="text-[#1a6fa8] font-bold">₹{tilePrice}</span>
                        </div>
                        <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-white">
                          <span className="font-bold text-black text-[0.93rem]">Mortgage Value</span>
                          <span className="font-bold text-black text-[0.93rem]">₹{Math.floor(tilePrice / 2)}</span>
                        </div>
                        <div className="border-t-[2px] border-black mx-0"></div>
                        <div className="flex flex-col px-[0.75rem] pt-[0.5rem] pb-[1rem] text-[0.875rem]">
                          <div className="flex justify-between items-center py-[0.25rem]">
                            <span>Rent</span>
                            <span className="font-semibold">₹25</span>
                          </div>
                          <div className="flex justify-between items-center py-[0.25rem]">
                            <span>If 2 stations are owned</span>
                            <span className="font-semibold">₹50</span>
                          </div>
                          <div className="flex justify-between items-center py-[0.25rem]">
                            <span>If 3 stations are owned</span>
                            <span className="font-semibold">₹100</span>
                          </div>
                          <div className="flex justify-between items-center py-[0.25rem]">
                            <span>If 4 stations are owned</span>
                            <span className="font-semibold">₹200</span>
                          </div>
                        </div>
                      </>
                    )}

                    {isUtility && (
                      <>
                        <div className="flex flex-col items-center pt-[1.5rem] pb-[0.5rem]">
                          {tileName === 'Water Works' ? (
                            <img src="/monopoly_faucet.svg" alt="Water Works" className="w-[5.3rem] h-[5.3rem] object-contain mb-[0.75rem]" />
                          ) : (
                            <img src="/monopoly_bulb.png" alt="Electric Company" className="w-[5.3rem] h-[5.3rem] object-contain mb-[0.75rem]" />
                          )}
                          <h3 className="text-black font-black text-[1.25rem] uppercase text-center leading-tight tracking-wider px-[1rem] whitespace-pre-line">
                            {tileName.replace(' ', '\n')}
                          </h3>
                        </div>
                        <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-[#cee8f5] mt-[0.25rem]">
                          <span className="text-[#1a6fa8] font-semibold">Purchase Price</span>
                          <span className="text-[#1a6fa8] font-bold">₹{tilePrice}</span>
                        </div>
                        <div className="flex justify-between items-center px-[0.75rem] py-[0.3rem] bg-white">
                          <span className="font-bold text-black text-[0.93rem]">Mortgage Value</span>
                          <span className="font-bold text-black text-[0.93rem]">₹{Math.floor(tilePrice / 2)}</span>
                        </div>
                        <div className="border-t-[2px] border-black mx-0"></div>
                        <div className="flex flex-col px-[1.5rem] pt-[1rem] pb-[1.5rem] text-[0.875rem] text-center gap-[1rem] font-semibold">
                          <p>If one Utility is owned, rent is 4 times amount shown on dice.</p>
                          <p>If both Utilities are owned, rent is 10 times amount shown on dice.</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Left Side: Special Card (GO, Jail, Parking, Tax) --- */}
        {isSpecialCard && (
          <div className="pointer-events-auto z-20 -rotate-[2deg] origin-center flex-shrink-0">
            <div>
              {/* Outer card border */}
              <div className="w-[24vh] h-[38vh] bg-white border-[2px] border-black p-[0.375rem] shadow-2xl">
                {/* Inner border wrapper */}
                <div className="h-full border-[1px] border-black flex flex-col overflow-hidden">
                  
                  {/* Card Header — colored band */}
                  <div className="flex items-center justify-center py-[0.75rem] border-b border-black text-white font-black text-[1.25rem] uppercase tracking-wider"
                       style={{ backgroundColor: specialHeaderBg }}>
                    <h3 style={{ fontFamily: 'Plus Jakarta Sans' }}>{tileName}</h3>
                  </div>

                  {/* Card Body */}
                  <div className="flex-1 flex flex-col items-center justify-center p-[1rem] bg-white text-center text-black" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {tileName === 'GO' && (
                      <div className="flex flex-col items-center gap-[0.75rem]">
                        <svg className="w-[5rem] h-[5rem] text-[#ed1b24] animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L4.5 9.5H9v8h6v-8h4.5L12 2z" transform="rotate(90 12 12)" />
                        </svg>
                        <p className="text-[0.875rem] font-bold text-gray-500 uppercase tracking-widest">Collect Salary</p>
                        <p className="text-[1.25rem] font-black text-red-600">COLLECT ₹200</p>
                        <p className="text-[0.75rem] font-semibold text-gray-500">As you pass or land here</p>
                      </div>
                    )}

                    {tileName === 'Jail' && (
                      <div className="flex flex-col items-center gap-[0.75rem]">
                        <svg className="w-[5rem] h-[5rem] text-gray-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <line x1="7" y1="3" x2="7" y2="21" />
                          <line x1="12" y1="3" x2="12" y2="21" />
                          <line x1="17" y1="3" x2="17" y2="21" />
                        </svg>
                        <p className="text-[0.875rem] font-bold text-gray-500 uppercase tracking-widest">Just Visiting</p>
                        <p className="text-[1.25rem] font-black text-gray-700">IN JAIL</p>
                        <p className="text-[0.75rem] font-semibold text-gray-500">If you are visiting, rest here.<br/>Otherwise, follow court orders.</p>
                      </div>
                    )}

                    {tileName === 'Go to Jail' && (
                      <div className="flex flex-col items-center gap-[0.75rem]">
                        <svg className="w-[5rem] h-[5rem] text-blue-900" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                          <path d="M12 12v3M12 18v.01" />
                        </svg>
                        <p className="text-[0.875rem] font-bold text-red-500 uppercase tracking-widest">Go Directly To</p>
                        <p className="text-[1.25rem] font-black text-blue-900">JAIL</p>
                        <p className="text-[0.75rem] font-semibold text-gray-500">Do not pass GO.<br/>Do not collect ₹200.</p>
                      </div>
                    )}

                    {tileName === 'Free Parking' && (
                      <div className="flex flex-col items-center gap-[0.75rem]">
                        <svg className="w-[5rem] h-[5rem] text-[#f59e0b]" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M9 17V7h4a3 3 0 0 1 0 6H11v4H9zm2-6h2a1 1 0 1 0 0-2h-2v2z" fill="white" />
                        </svg>
                        <p className="text-[0.875rem] font-bold text-gray-500 uppercase tracking-widest">Free Parking</p>
                        <p className="text-[1.25rem] font-black text-amber-600">REST & RELAX</p>
                        <p className="text-[0.75rem] font-semibold text-gray-500">No rent, fees, or taxes are collected here. Enjoy your stay!</p>
                      </div>
                    )}

                    {(tileName === 'Income Tax' || tileName === 'Luxury Tax') && (
                      <div className="flex flex-col items-center gap-[0.75rem]">
                        <svg className="w-[5rem] h-[5rem] text-red-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="M12 8v8M9 11h6" />
                        </svg>
                        <p className="text-[0.875rem] font-bold text-gray-500 uppercase tracking-widest">Government Tax</p>
                        <p className="text-[1.25rem] font-black text-red-600">PAY ₹{amount || (tileName === 'Income Tax' ? 200 : 100)}</p>
                        <p className="text-[0.75rem] font-semibold text-gray-500">Pay directly to the Bank</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Right Side: Monopoly Man & Speech Bubble --- */}
        <div className="relative w-[24vh] h-[34vh] flex flex-col items-center justify-end pointer-events-none z-10 flex-shrink-0">
          {/* Monopoly Man Image */}
          <img 
            src="/monopoly_man.png" 
            alt="Monopoly Man" 
            className="relative z-30 w-full h-auto object-contain drop-shadow-2xl" 
          />
          
          {/* Speech Bubble — large, clean, white, no black border, pointer bottom-center */}
          <div className="absolute top-[-5vh] left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="relative bg-white border-[3px] border-gray-300 rounded-[1.5rem] px-[2vh] py-[1vh] shadow-2xl flex items-center justify-center min-w-[12vh] max-w-[22vh]">
              {/* Center Pointer */}
              <div className="absolute bottom-[-1.375rem] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[0.8rem] border-l-transparent border-t-[1.375rem] border-t-gray-300 border-r-[0.8rem] border-r-transparent"></div>
              <div className="absolute bottom-[-1.05rem] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[0.7rem] border-l-transparent border-t-[1.125rem] border-t-white border-r-[0.7rem] border-r-transparent z-10"></div>
              
              {context === 'rent_due' ? (
                <p className="text-[1.125rem] font-black text-zinc-950 text-center" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {playerName} paid<br/><span className="text-[#9e216d]">₹{amount}</span> to {ownerName}
                </p>
              ) : context === 'for_sale' ? (
                <div className="flex items-center">
                  <span className="text-[1.875rem] font-black text-zinc-950 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>₹{tilePrice}</span>
                </div>
              ) : (
                <p className="text-[1.125rem] font-black text-zinc-950 text-center" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {playerName} landed<br/>here!
                </p>
              )}
            </div>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
}

function BankruptcyResolveOverlay({ activeResolution, allPlayers }) {
  useEffect(() => {
    try {
      soundEngine.playCardDraw();
    } catch (e) {
      console.warn('Error playing draw sound on bankruptcy overlay mount:', e);
    }
  }, []);

  if (!activeResolution) return null;

  const { propertyId, creditorId, bankruptPlayerName } = activeResolution;
  const city = CITIES[propertyId];
  if (!city) return null;

  const creditor = allPlayers.find(p => p.id === creditorId);
  const colorHex = getColorHex(city.color);
  const mortgageValue = Math.floor(city.price / 2);
  const unmortgageCost = Math.floor(mortgageValue * 1.1);
  const keepMortgagedFee = Math.floor(mortgageValue * 0.1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/75 pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        transition={{ type: 'spring', bounce: 0.4 }}
        className="relative w-[75vh] h-[48vh] flex items-center justify-center gap-[4vh] pointer-events-auto bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl"
      >
        {/* Left: The Card */}
        <div className="w-[22vh] bg-white border-[2px] border-black p-[5px] shadow-2xl -rotate-[2deg] flex-shrink-0">
          <div className="border-[1px] border-black flex flex-col overflow-hidden">
            {city.color ? (
              <div className="py-2 border-b border-black text-center" style={{ backgroundColor: colorHex }}>
                <h3 className="text-black font-black text-xs uppercase tracking-wider">{city.name}</h3>
              </div>
            ) : (
              <div className="py-2 border-b border-black text-center bg-zinc-800 text-white">
                <h3 className="font-black text-xs uppercase tracking-wider">{city.name}</h3>
              </div>
            )}
            <div className="flex flex-col bg-white text-[10px] p-2 font-semibold text-black gap-1">
              <div className="flex justify-between border-b pb-1">
                <span>Value</span>
                <span>₹{city.price}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>Mortgage Val</span>
                <span>₹{mortgageValue}</span>
              </div>
              <div className="flex justify-between border-b pb-1 text-red-600 font-bold">
                <span>Keep Fee</span>
                <span>₹{keepMortgagedFee}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Unmortgage</span>
                <span>₹{unmortgageCost}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Decision details */}
        <div className="flex-1 flex flex-col text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-red-600 px-2 py-0.5 rounded text-white">
              Bankruptcy Transfer
            </span>
          </div>
          <h2 className="text-2xl font-black mb-2 leading-tight">
            RESOLVING {city.name.toUpperCase()}
          </h2>
          <p className="text-sm text-zinc-300 mb-4 leading-relaxed font-sans">
            <strong className="text-white">{bankruptPlayerName}</strong> went bankrupt. This mortgaged property is being transferred to{' '}
            <strong style={{ color: creditor?.color }}>{creditor?.name}</strong>.
          </p>

          <div className="space-y-2 mb-4 text-xs font-sans">
            <div className="flex items-start gap-2 bg-zinc-800/80 p-2.5 rounded-lg border border-zinc-700">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <span className="font-bold block text-emerald-400">Option 1: Unmortgage immediately</span>
                <span className="text-zinc-400">Pay 1.1x mortgage value: ₹{unmortgageCost}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-zinc-800/80 p-2.5 rounded-lg border border-zinc-700">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <div>
                <span className="font-bold block text-red-400">Option 2: Keep mortgaged</span>
                <span className="text-zinc-400">Pay 10% immediate fee: ₹{keepMortgagedFee}</span>
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2 text-yellow-400 text-xs font-black animate-pulse font-sans">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
            WAITING FOR {creditor?.name?.toUpperCase()} TO DECIDE ON MOBILE...
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AudioVisualizer({ analyser, isMuted }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!analyser || isMuted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationFrameId;

    const renderFrame = () => {
      animationFrameId = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        // scale height to look nice
        const percent = dataArray[i] / 255;
        const barHeight = percent * canvas.height * 0.9;
        
        if (barHeight > 0) {
          const grad = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
          grad.addColorStop(0, '#f472b6'); // pink-400
          grad.addColorStop(1, '#9e216d'); // RS 2000 Magenta
          
          ctx.fillStyle = grad;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        }
        x += barWidth;
      }
    };

    renderFrame();
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, isMuted]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-20 h-5 rounded bg-zinc-950/60 border border-zinc-800" 
      width={80} 
      height={20} 
    />
  );
}

export default function BoardComponent({ socket, room = 'ABCD' }) {
  const [gameState, setGameState] = useState({
    players: [],
    boardState: {},
    landedTile: null
  });
  const [auctionState, setAuctionState] = useState(null);

  // Sequential Visual States
  const [visualPlayers, setVisualPlayers] = useState([]);
  const [visualBoardState, setVisualBoardState] = useState({});
  const [visualLandedTile, setVisualLandedTile] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeDice, setActiveDice] = useState(null);
  const [floaters, setFloaters] = useState([]);
  const [particles, setParticles] = useState([]);
  
  const [prevPlayersState, setPrevPlayersState] = useState([]);
  const [prevCash, setPrevCash] = useState({});

  const lastRollSumRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const pendingVisualEventRef = useRef(null);
  const willMoveRef = useRef(false);
  const gameStateRef = useRef(null);
  // Tracks the landing key (tileName+playerName) that was already shown and dismissed,
  // so manage_property game_updates don't re-trigger the popup for the same landing.
  const dismissedLandedTileKeyRef = useRef(null);
  const [activeVisualEvent, setActiveVisualEvent] = useState(null);
  
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.25);
  const [sfxVolume, setSfxVolume] = useState(0.4);
  const [audioAnalyser, setAudioAnalyser] = useState(null);

  // User gesture interaction listener to bypass browser autoplay blocks
  useEffect(() => {
    const handleGesture = () => {
      try {
        soundEngine.setMuted(false);
      } catch (e) {
        console.warn('Error starting sound engine on gesture:', e);
      }
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // Sync state changes with the SoundEngine safely
  useEffect(() => {
    try {
      soundEngine.setMuted(isAudioMuted);
      if (!isAudioMuted && soundEngine.analyser) {
        setAudioAnalyser(soundEngine.analyser);
      } else {
        setAudioAnalyser(null);
      }
    } catch (e) {
      console.error('Error syncing mute state:', e);
    }
  }, [isAudioMuted]);

  useEffect(() => {
    try {
      soundEngine.setBgmVolume(bgmVolume);
    } catch (e) {
      console.error('Error syncing BGM volume:', e);
    }
  }, [bgmVolume]);

  useEffect(() => {
    try {
      soundEngine.setSfxVolume(sfxVolume);
    } catch (e) {
      console.error('Error syncing SFX volume:', e);
    }
  }, [sfxVolume]);

  // Detect property mortgages or house sells/builds to play audio feedback
  useEffect(() => {
    if (!gameState || !gameState.boardState) return;
    
    // Skip if we are initialising
    if (Object.keys(visualBoardState).length === 0) return;

    for (const propId in gameState.boardState) {
      const prev = visualBoardState[propId] || {};
      const curr = gameState.boardState[propId] || {};

      // 1. Mortgage / Unmortgage detection
      if (prev.mortgaged !== curr.mortgaged) {
        try {
          soundEngine.playCardFlip();
        } catch (e) {
          console.warn('Error playing flip sound:', e);
        }
      }

      // 2. House sell detection
      if (curr.houses < prev.houses) {
        try {
          soundEngine.playHouseSell();
        } catch (e) {
          console.warn('Error playing sell sound:', e);
        }
      }
    }
  }, [gameState, visualBoardState]);

  // Stop background music when host board unmounts
  useEffect(() => {
    return () => {
      try {
        soundEngine.stopBgm();
      } catch (e) {
        console.error('Error stopping BGM on unmount:', e);
      }
    };
  }, []);
  
  useEffect(() => {
    socket.emit("create_room", room);
    socket.on("game_update", setGameState);
    
    socket.on("auction_start", (data) => {
      setAuctionState(data);
      try {
        soundEngine.playAuctionStart();
      } catch (e) {
        console.error('Error playing auction start sound:', e);
      }
    });

    socket.on("auction_update", (data) => {
      setAuctionState(prev => {
        if (data && (!prev || data.currentBid > prev.currentBid)) {
          try {
            soundEngine.playAuctionBid();
          } catch (e) {
            console.error('Error playing auction bid sound:', e);
          }
        }
        return data;
      });
    });

    socket.on("auction_end", (data) => {
      setAuctionState(prev => ({
        ...prev,
        status: 'ended',
        winner: data.winner,
        winnerColor: data.winnerColor,
        finalPrice: data.finalPrice,
      }));
      try {
        soundEngine.playAuctionEnd();
      } catch (e) {
        console.error('Error playing auction end sound:', e);
      }
      // Auto-dismiss after 5 seconds
      setTimeout(() => setAuctionState(null), 5000);
    });
    
    // Listen to dice rolls and queue visual events during movement
    socket.on("trigger_visual", (data) => {
      if (data.type === 'DICE_ROLL') {
        lastRollSumRef.current = data.dice[0] + data.dice[1];
        setActiveDice(data.dice);
        setTimeout(() => setActiveDice(null), 2000);
        willMoveRef.current = true;
        try {
          soundEngine.playDiceRoll();
        } catch (e) {
          console.error('Error playing dice roll sound:', e);
        }
      } else if (['RENT', 'BUY', 'BUILD', 'BANKRUPT', 'CARD_DRAW', 'GAME_OVER'].includes(data.type)) {
        // RENT and CARD_DRAW fire during the dice roll handler (before movement completes), so always queue them
        // BUY fires after the player clicks Buy (post-landing), so use normal ref-based queueing
        const alwaysQueue = ['RENT', 'CARD_DRAW'].includes(data.type);
        if (alwaysQueue || isAnimatingRef.current || willMoveRef.current) {
          pendingVisualEventRef.current = data;
        } else {
          setActiveVisualEvent(data);
          setTimeout(() => setActiveVisualEvent(null), 4000);
        }
      }
    });

    return () => {
      socket.off("game_update");
      socket.off("auction_start");
      socket.off("auction_update");
      socket.off("auction_end");
      socket.off("trigger_visual");
    };
  }, [socket]);

  // Cash changes: floating text and flying coins
  useEffect(() => {
    if (visualPlayers.length === 0) return;
    
    const decs = [];
    const incs = [];
    let hasCashChange = false;
    
    visualPlayers.forEach(p => {
      const oldCash = prevCash[p.id];
      if (oldCash !== undefined && oldCash !== p.cash) {
        hasCashChange = true;
        const diff = p.cash - oldCash;
        const text = diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`;
        const color = diff > 0 ? 'text-green-500' : 'text-red-500';
        
        // Push floater indicator
        const newFloater = {
          id: Math.random().toString(),
          playerId: p.id,
          text,
          color
        };
        setFloaters(prev => [...prev, newFloater]);
        setTimeout(() => {
          setFloaters(prev => prev.filter(f => f.id !== newFloater.id));
        }, 2000);

        if (diff < 0) decs.push({ id: p.id, amount: Math.abs(diff) });
        else incs.push({ id: p.id, amount: diff });
      }
    });

    // Trigger flying coin particles
    if (decs.length > 0 && incs.length > 0) {
      decs.forEach(dec => {
        incs.forEach(inc => {
          const fromIndex = visualPlayers.findIndex(pl => pl.id === dec.id);
          const toIndex = visualPlayers.findIndex(pl => pl.id === inc.id);
          
          if (fromIndex !== -1 && toIndex !== -1) {
            const startTop = fromIndex * 96 + 40;
            const endTop = toIndex * 96 + 40;
            const newParticle = {
              id: Math.random().toString(),
              startTop,
              endTop
            };
            setParticles(prev => [...prev, newParticle]);
            setTimeout(() => {
              setParticles(prev => prev.filter(part => part.id !== newParticle.id));
            }, 1500);
          }
        });
      });
    }

    if (hasCashChange) {
      try {
        soundEngine.playCoinClink();
      } catch (e) {}
    }

    const cashMap = {};
    visualPlayers.forEach(p => {
      cashMap[p.id] = p.cash;
    });
    setPrevCash(cashMap);
  }, [visualPlayers]);

  // Auto-dismiss landing cards after 3 seconds for non-actionable tiles
  useEffect(() => {
    if (visualLandedTile && visualLandedTile.context !== 'for_sale') {
      const timer = setTimeout(() => {
        // Mark this landing event as dismissed so subsequent manage_property game_updates
        // don't re-show the same tile popup (Bug 1 fix)
        dismissedLandedTileKeyRef.current = `${visualLandedTile.tileName}:${visualLandedTile.playerName}`;
        setVisualLandedTile(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visualLandedTile]);

  // Handle visual positions, dice updates and popups sequencing
  useEffect(() => {
    if (!gameState || !gameState.players || gameState.players.length === 0) return;
    gameStateRef.current = gameState;

    if (visualPlayers.length === 0) {
      setVisualPlayers(gameState.players.map(p => ({ ...p })));
      setVisualBoardState(gameState.boardState);
      setVisualLandedTile(gameState.landedTile);
      setPrevPlayersState(gameState.players.map(p => ({ ...p })));
      return;
    }

    // Check if player position changed on server
    const movingPlayer = gameState.players.find(p => {
      const prev = prevPlayersState.find(vp => vp.id === p.id);
      return prev && prev.position !== p.position;
    });

    if (movingPlayer && !isAnimatingRef.current) {
      const prevPlayer = prevPlayersState.find(vp => vp.id === movingPlayer.id);
      const oldPos = prevPlayer.position;
      const finalPos = movingPlayer.position;
      
      runSequencedMovement(movingPlayer.id, oldPos, finalPos, gameState);
    } else if (!isAnimatingRef.current) {
      if (willMoveRef.current) {
        willMoveRef.current = false;
        if (pendingVisualEventRef.current) {
          setActiveVisualEvent(pendingVisualEventRef.current);
          pendingVisualEventRef.current = null;
          setTimeout(() => setActiveVisualEvent(null), 4000);
        }
      }
      setVisualPlayers(gameState.players.map(p => ({ ...p })));
      // Bug fix: Only update visualLandedTile if the server explicitly cleared it (null)
      // or if it's a brand-new landing (tileName/playerName key changed) AND it hasn't
      // already been shown + dismissed. Prevents FREE_PARKING and other landing popups
      // from re-appearing when manage_property (build/mortgage) triggers a game_update.
      setVisualLandedTile(prev => {
        const newTile = gameState.landedTile;
        if (newTile === null) {
          // Server explicitly cleared — also clear the dismissed key so next landing works
          dismissedLandedTileKeyRef.current = null;
          return null;
        }
        const newKey = `${newTile.tileName}:${newTile.playerName}`;
        // If this landing was already shown and dismissed, don't re-trigger it
        if (newKey === dismissedLandedTileKeyRef.current) return null;
        if (prev === null) return newTile; // no current tile — show new one
        // same key = same landing event; don't re-trigger popup
        if (`${prev.tileName}:${prev.playerName}` === newKey) return prev;
        return newTile;
      });
      setPrevPlayersState(gameState.players.map(p => ({ ...p })));
      
      if (!activeVisualEvent || activeVisualEvent.type !== 'BUILD') {
        setVisualBoardState(gameState.boardState);
      }
    }
  }, [gameState]);

  // Synchronize boardState when fullscreen visual events (like upgrade build animations) disappear
  useEffect(() => {
    if (!activeVisualEvent && gameStateRef.current) {
      setVisualBoardState(gameStateRef.current.boardState);
    }
  }, [activeVisualEvent]);

  const runSequencedMovement = async (playerId, oldPos, finalPos, targetGameState) => {
    isAnimatingRef.current = true;
    setIsAnimating(true);
    willMoveRef.current = false;
    // New movement = new landing event; reset the dismissed key so the new tile shows
    dismissedLandedTileKeyRef.current = null;
    setVisualLandedTile(null); // Keep card popup hidden while moving

    // 1. Wait for dice roll to complete on screen
    await new Promise(resolve => setTimeout(resolve, 2200));

    // Calculate rolled pos before possible jail jump
    const roll = lastRollSumRef.current || ((finalPos - oldPos + 40) % 40);
    const rolledPos = (oldPos + roll) % 40;

    // 2. Slide token cell-by-cell
    let current = oldPos;
    while (current !== rolledPos) {
      current = (current + 1) % 40;
      setVisualPlayers(prev => prev.map(p => p.id === playerId ? { ...p, position: current } : p));
      try {
        soundEngine.playTokenStep();
      } catch (e) {
        console.warn('Error playing token step sound:', e);
      }
      await new Promise(resolve => setTimeout(resolve, 250)); // 250ms per cell
    }

    // 3. Jump to jail cell if needed
    if (rolledPos !== finalPos) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setVisualPlayers(prev => prev.map(p => p.id === playerId ? { ...p, position: finalPos } : p));
      if (finalPos === 10) {
        try {
          soundEngine.playJail();
        } catch (e) {
          console.error('Error playing jail sound:', e);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 4. Update visual state
    setVisualPlayers(targetGameState.players.map(p => ({ ...p })));
    setPrevPlayersState(targetGameState.players.map(p => ({ ...p })));
    
    // 5. Open property card popup and trigger visual event if queued
    if (pendingVisualEventRef.current) {
      setActiveVisualEvent(pendingVisualEventRef.current);
      pendingVisualEventRef.current = null;
      setTimeout(() => setActiveVisualEvent(null), 4000);
    }
    setVisualLandedTile(gameStateRef.current ? gameStateRef.current.landedTile : targetGameState.landedTile);
    isAnimatingRef.current = false;
    setIsAnimating(false);

    lastRollSumRef.current = 0;
  };

  function getGridStyle(i) {
    let row, col;
    if (i >= 0 && i <= 10) {
      row = 11; col = 11 - i;
    } else if (i >= 11 && i <= 20) {
      row = 11 - (i - 10); col = 1;
    } else if (i >= 21 && i <= 30) {
      row = 1; col = (i - 20) + 1;
    } else if (i >= 31 && i <= 39) {
      row = (i - 30) + 1; col = 11;
    }
    return { gridRowStart: row, gridColumnStart: col };
  }

  if (!gameState) return <div className="text-white text-4xl flex h-screen items-center justify-center bg-zinc-950 font-bold tracking-widest animate-pulse">INITIALIZING LOBBY...</div>;

  return (
    <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center overflow-hidden text-black relative font-oswald">
      <style>{`
        html {
          font-size: 1.48vh !important;
        }
      `}</style>
      <VisualEvents activeEvent={activeVisualEvent} setActiveEvent={setActiveVisualEvent} socket={socket} boardState={gameState.boardState} players={gameState.players} />
      <AuctionDisplay auctionState={auctionState} allPlayers={gameState.players} />

      {/* --- Left Sidebar: Room Info --- */}
      <div className="absolute left-[4vh] top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10 w-[15rem]">
        {/* Room Card */}
        <div className="bg-white/95 backdrop-blur-sm p-[1rem] rounded-[1rem] border-[3px] border-zinc-300 shadow-2xl flex flex-col gap-1 select-none">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 font-sans">Room Code</span>
          <span className="text-2xl font-black tracking-wider text-zinc-900 uppercase font-sans">{room}</span>
        </div>
      </div>
      
      {/* Property Card Popup Overlay (Interactive) */}
      <div className="absolute inset-0 pointer-events-none z-[100]">
        <AnimatePresence mode="wait">
           {visualLandedTile && (
             <PropertyCardPopup key={visualLandedTile.tileId} landedTile={visualLandedTile} />
           )}
           {visualLandedTile?.context === 'jail' && (
              <motion.div
                key="jail-siren"
                initial={{ opacity: 0 }}
                animate={{ backgroundColor: ['rgba(255,0,0,0.5)', 'rgba(0,0,255,0.5)', 'rgba(255,0,0,0.5)', 'rgba(0,0,255,0.5)'] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="fixed inset-0 pointer-events-none mix-blend-color-burn z-[90]"
              />
           )}
           {gameState.bankruptcyResolveQueue && gameState.bankruptcyResolveQueue.length > 0 && (
             <BankruptcyResolveOverlay 
               key={`resolve-${gameState.bankruptcyResolveQueue[0].propertyId}`} 
               activeResolution={gameState.bankruptcyResolveQueue[0]} 
               allPlayers={gameState.players} 
             />
           )}
        </AnimatePresence>
      </div>

      {/* --- Right Sidebar: Player List & Money Flow --- */}
      {visualPlayers && visualPlayers.length > 0 && (
        <div className="absolute right-[4vh] top-1/2 -translate-y-1/2 flex flex-col gap-[0.5rem] z-10 w-[15rem] pointer-events-none">
          <div className="relative flex flex-col gap-[0.5rem]">
            {visualPlayers.map((p, idx) => {
              const isCurrent = idx === gameState.currentTurn;
              const isBankrupt = p.bankrupt;
              return (
                <div 
                  key={p.id}
                  className={`relative flex items-center gap-[0.5rem] bg-white/95 backdrop-blur-sm h-[5rem] p-[0.5rem] rounded-[1rem] border-[3px] shadow-2xl transition-all ${
                    isCurrent 
                      ? 'border-yellow-400 scale-105 shadow-[0_0_20px_rgba(250,204,21,0.4)]' 
                      : 'border-zinc-300'
                  } ${isBankrupt ? 'opacity-40 grayscale' : ''} ${p.connected === false ? 'opacity-60 border-dashed border-zinc-300 bg-zinc-50' : ''}`}
                  style={{
                    borderLeftColor: p.color,
                    borderLeftWidth: '8px'
                  }}
                >
                  {/* Player Avatar */}
                  <div 
                    className="w-[2.25rem] h-[2.25rem] rounded-full border-2 border-white shadow-md flex items-center justify-center shrink-0" 
                    style={{ backgroundColor: p.color }}
                  >
                    <TokenIcon color="#fff" size={16} />
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="font-black text-sm text-zinc-950 truncate uppercase tracking-tight leading-tight flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {p.connected === false && (
                        <span className="text-[9px] font-extrabold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded normal-case tracking-normal shrink-0">Offline</span>
                      )}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="font-extrabold text-lg text-emerald-600 leading-none">
                        ₹{p.cash.toLocaleString()}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-right leading-none">
                        NW: ₹{(p.cash + (p.properties?.reduce((acc, id) => {
                          const tile = CITIES[id];
                          const state = gameState.boardState[id];
                          if (!state || !tile) return acc;
                          const houses = state.houses || 0;
                          if (houses > 0) acc += houses * Math.floor((tile.houseCost || tile.price / 2) / 2);
                          if (!state.mortgaged && houses === 0) acc += Math.floor(tile.price / 2);
                          return acc;
                        }, 0) || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Floating Cash Indicators */}
                  <AnimatePresence>
                    {floaters.filter(f => f.playerId === p.id).map(f => (
                      <motion.div
                        key={f.id}
                        initial={{ opacity: 1, y: 10, scale: 0.8 }}
                        animate={{ opacity: 0, y: -45, scale: 1.2 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.8, ease: 'easeOut' }}
                        className={`absolute right-4 top-2 font-black text-xl z-50 drop-shadow-md ${f.color}`}
                      >
                        {f.text}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Flying Rupee Particles */}
            <AnimatePresence>
              {particles.map(part => (
                <motion.div
                  key={part.id}
                  initial={{ top: part.startTop, left: 16, opacity: 1, scale: 1.4 }}
                  animate={{ top: part.endTop, left: 16, opacity: [1, 1, 0], scale: [1.4, 1.2, 0.8] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: 'easeInOut' }}
                  className="absolute z-50 bg-emerald-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-black shadow-lg border border-emerald-400 text-xs"
                >
                  ₹
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Action Log Box */}
            {gameState.logs && gameState.logs.length > 0 && (
              <div className="bg-[#1e1b18]/95 border-[3px] border-zinc-300 rounded-[1rem] p-[1rem] shadow-2xl flex flex-col gap-[0.5rem] mt-[0.5rem] pointer-events-auto max-h-[30vh]">
                <p className="font-black text-xs text-yellow-400 uppercase tracking-wider border-b border-zinc-700 pb-[0.35rem] flex items-center gap-[0.35rem] shrink-0" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  <span className="w-[0.5rem] h-[0.5rem] rounded-full bg-yellow-400 animate-pulse"></span>
                  Activity Log
                </p>
                <div className="flex flex-col gap-[0.35rem] overflow-y-auto pr-1 no-scrollbar">
                  {gameState.logs.slice(0, 8).map((log, idx) => (
                    <div key={idx} className="text-zinc-300 text-[11px] font-bold leading-normal font-sans border-b border-zinc-800/40 pb-[0.25rem] last:border-0">
                      {log.replace(/^> /, '')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Dice Roll Floating Animation Overlay --- */}
      <AnimatePresence>
        {activeDice && (
          <motion.div 
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute z-50 flex gap-6 bg-black/50 backdrop-blur-sm px-8 py-6 rounded-3xl border border-zinc-700 shadow-2xl pointer-events-none"
            style={{ top: '35%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            {activeDice.map((d, i) => (
              <div key={i} className="w-24 h-24 bg-white rounded-2xl shadow-lg border-2 border-gray-100 flex items-center justify-center text-5xl font-black text-red-600">
                {d}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="w-[95vh] h-[95vh] bg-[#fbf8ef] border-2 border-black shadow-2xl relative box-border"
        style={{
          display: 'grid',
          gridTemplateColumns: '13.5% repeat(9, 1fr) 13.5%',
          gridTemplateRows: '13.5% repeat(9, 1fr) 13.5%'
        }}
      >
        {CITIES.map((city) => {
          const tileState = visualBoardState[city.id] || {};
          const isCorner = city.id === 0 || city.id === 10 || city.id === 20 || city.id === 30;
          const isMortgaged = tileState.mortgaged;
          const ownerPlayer = tileState.owner ? visualPlayers.find(p => p.id === tileState.owner) : null;
          
          const hexColor = getColorHex(city.color);
          const hasColorBar = hexColor !== 'transparent';
          const isTopRow = city.id > 20 && city.id < 30;
          
          return (
            <div 
              key={city.id} 
              className="relative flex items-center justify-center bg-[#fbf8ef] box-border"
              style={{
                ...getGridStyle(city.id),
              }}
            >
              {/* Border overlay - renders on top of tile content */}
              <div className="absolute inset-0 z-30 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px black${ownerPlayer ? `, inset 0 0 0 3px ${ownerPlayer.color}` : ''}` }} />
              {/* Inner container with strict aspect ratio rotation for non-corners */}
              <div 
                className={
                  isCorner || (city.id > 0 && city.id < 10) || (city.id > 20 && city.id < 30) 
                    ? "w-full h-full flex flex-col justify-between absolute inset-0 box-border" 
                    : "absolute top-1/2 left-1/2 flex flex-col justify-between box-border"
                }
                style={
                  isCorner 
                    ? {} 
                    : (city.id > 0 && city.id < 10) 
                      ? { transform: 'none' }
                      : (city.id > 20 && city.id < 30)
                        ? { transform: 'none' }
                        : {
                            width: 'calc((95vh - 4px) * 0.73 / 9)',
                            height: 'calc((95vh - 4px) * 0.135)',
                            transform: `translate(-50%, -50%) rotate(${
                              (city.id > 10 && city.id < 20) ? '90deg' : '-90deg'
                            })`
                          }
                }
              >
                {/* 3D Card Flipper for Mortgaged Properties */}
                <motion.div
                  className="w-full h-full relative"
                  style={{ transformStyle: isMortgaged ? 'preserve-3d' : 'flat' }}
                  animate={{ rotateY: isMortgaged ? 180 : 0 }}
                  transition={{ duration: 0.6 }}
                >
                  {/* Front Face: The actual tile content */}
                  <div 
                    className="absolute inset-0 w-full h-full flex flex-col justify-between bg-[#fbf8ef]"
                    style={{ backfaceVisibility: isMortgaged ? 'hidden' : 'visible', ...(isTopRow ? { flexDirection: 'column-reverse' } : {}) }}
                  >
                    {/* Regular Property Tiles */}
                    {!isCorner && hasColorBar && (
                      <>
                        <div className={`w-full h-[22%] ${isTopRow ? 'border-t-2' : 'border-b-2'} border-black box-border flex items-center justify-center gap-[2px] relative overflow-visible`} style={{backgroundColor: hexColor}}>
                          {tileState.houses > 0 && tileState.houses < 5 && (
                            [...Array(tileState.houses)].map((_, i) => (
                              <motion.div
                                key={`house-${city.id}-${i}`}
                                initial={{ scale: 0, y: -40, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                transition={{ 
                                  type: 'spring', 
                                  stiffness: 400, 
                                  damping: 12, 
                                  delay: i * 0.15,
                                  mass: 0.8
                                }}
                                className="relative z-10"
                                style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
                              >
                                {/* 3D Isometric House SVG */}
                                <svg width="14" height="16" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg">
                                  {/* Front face */}
                                  <rect x="4" y="14" width="20" height="16" fill="#22c55e" stroke="#111" strokeWidth="1.5"/>
                                  {/* Right side face (3D depth) */}
                                  <polygon points="24,14 28,11 28,27 24,30" fill="#15803d" stroke="#111" strokeWidth="1"/>
                                  {/* Roof front */}
                                  <polygon points="2,14 14,4 26,14" fill="#166534" stroke="#111" strokeWidth="1.5"/>
                                  {/* Roof right side */}
                                  <polygon points="26,14 28,11 14,1 14,4" fill="#0f4c29" stroke="#111" strokeWidth="1"/>
                                  {/* Door */}
                                  <rect x="10" y="22" width="8" height="8" fill="#854d0e" stroke="#111" strokeWidth="1" rx="1"/>
                                  {/* Chimney */}
                                  <rect x="18" y="5" width="4" height="9" fill="#991b1b" stroke="#111" strokeWidth="1"/>
                                </svg>
                              </motion.div>
                            ))
                          )}
                          {tileState.houses === 5 && (
                            <motion.div
                              key={`hotel-${city.id}`}
                              initial={{ scale: 0, y: -50, rotateZ: -15, opacity: 0 }}
                              animate={{ scale: 1, y: 0, rotateZ: 0, opacity: 1 }}
                              transition={{ 
                                type: 'spring', 
                                stiffness: 350, 
                                damping: 10,
                                mass: 1
                              }}
                              className="relative z-10"
                              style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))' }}
                            >
                              {/* 3D Isometric Hotel SVG */}
                              <svg width="20" height="20" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                                {/* Front face */}
                                <rect x="2" y="8" width="26" height="26" fill="#dc2626" stroke="#111" strokeWidth="1.5"/>
                                {/* Right side face (3D depth) */}
                                <polygon points="28,8 34,4 34,30 28,34" fill="#991b1b" stroke="#111" strokeWidth="1"/>
                                {/* Roof/top */}
                                <polygon points="0,8 28,8 34,4 6,4" fill="#7f1d1d" stroke="#111" strokeWidth="1"/>
                                {/* H letter */}
                                <text x="15" y="25" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="sans-serif" stroke="#111" strokeWidth="0.5">H</text>
                                {/* Windows row 1 */}
                                <rect x="5" y="11" width="5" height="4" fill="#fef08a" stroke="#111" strokeWidth="0.8" rx="0.5"/>
                                <rect x="20" y="11" width="5" height="4" fill="#fef08a" stroke="#111" strokeWidth="0.8" rx="0.5"/>
                                {/* Door */}
                                <rect x="11" y="28" width="8" height="6" fill="#854d0e" stroke="#111" strokeWidth="1" rx="1"/>
                              </svg>
                            </motion.div>
                          )}
                        </div>
                        <div className="flex-1 w-full flex flex-col items-center p-1 box-border" style={isTopRow ? { flexDirection: 'column-reverse' } : {}}>
                          <span className="font-extrabold text-[0.6rem] uppercase text-black text-center leading-[1.1] mt-1 whitespace-pre-wrap break-words w-full px-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", WebkitFontSmoothing: 'subpixel-antialiased', MozOsxFontSmoothing: 'auto', textRendering: 'geometricPrecision', letterSpacing: '0.02em', ...(isTopRow ? { transform: 'rotate(180deg)' } : {}) }}>{city.name.replace(' ', '\n')}</span>
                          {ownerPlayer && (
                            <span className="text-[0.45rem] font-black px-1 rounded-sm text-white uppercase mt-0.5 truncate max-w-full leading-normal" style={{ backgroundColor: ownerPlayer.color, ...(isTopRow ? { transform: 'rotate(180deg)' } : {}) }}>
                              {ownerPlayer.name}
                            </span>
                          )}
                          {city.price && <span className="text-[0.65rem] font-bold text-black mt-auto mb-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>₹{city.price}</span>}
                        </div>
                      </>
                    )}

                    {/* Non-Property Edges (Stations, Utilities, Chance, Chest, Tax) */}
                    {!isCorner && !hasColorBar && (
                      <div className="flex-1 w-full flex flex-col items-center p-1 box-border" style={isTopRow ? { flexDirection: 'column-reverse' } : {}}>
                          <span className="font-extrabold text-[0.6rem] uppercase text-black text-center leading-[1.1] mt-1 whitespace-pre-wrap break-words w-full px-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", WebkitFontSmoothing: 'subpixel-antialiased', MozOsxFontSmoothing: 'auto', textRendering: 'geometricPrecision', letterSpacing: '0.02em', ...(isTopRow ? { transform: 'rotate(180deg)' } : {}) }}>{city.name.replace(' ', '\n')}</span>
                          {ownerPlayer && (
                            <span className="text-[0.45rem] font-black px-1 rounded-sm text-white uppercase mt-0.5 truncate max-w-full leading-normal" style={{ backgroundColor: ownerPlayer.color, ...(isTopRow ? { transform: 'rotate(180deg)' } : {}) }}>
                              {ownerPlayer.name}
                            </span>
                          )}
                          
                          {/* Train Icon */}
                          {city.type === 'station' && (
                            <div className="flex-1 w-full flex items-center justify-center my-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>
                              <svg viewBox="0 0 100 50" className="w-[85%] h-auto fill-[#231f20]">
                                <path d="M15,40 L85,40 L85,25 L75,25 L70,12 L50,12 L50,25 L45,25 L40,15 L35,15 L35,25 L15,25 Z M85,40 L95,45 L15,45 L5,40 Z" />
                                <circle cx="25" cy="45" r="4.5" />
                                <circle cx="45" cy="45" r="4.5" />
                                <circle cx="65" cy="45" r="4.5" />
                                <circle cx="80" cy="45" r="3" />
                                <path d="M35,10 C38,8 38,5 35,2" stroke="#231f20" strokeWidth="2" fill="none"/>
                                <path d="M42,8 C45,5 45,2 42,-1" stroke="#231f20" strokeWidth="2" fill="none"/>
                              </svg>
                            </div>
                          )}

                          {/* Utilities & Taxes & Chance */}
                          {city.type === 'utility' && city.name.includes('Electric') && (
                            <div className="flex-1 w-full flex items-center justify-center my-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>
                              <svg viewBox="0 0 100 100" className="w-[60%] h-auto fill-[#fef200] stroke-black stroke-[3px]">
                                 <path d="M50,10 C30,10 20,30 20,50 C20,65 35,75 35,85 L65,85 C65,75 80,65 80,50 C80,30 70,10 50,10 Z" />
                                 <rect x="40" y="85" width="20" height="10" fill="#999" />
                              </svg>
                            </div>
                          )}
                          {city.type === 'utility' && city.name.includes('Water') && (
                            <div className="flex-1 w-full flex items-center justify-center my-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>
                              <svg viewBox="0 0 100 100" className="w-[60%] h-auto fill-[#aae0fa] stroke-black stroke-[3px]">
                                 <path d="M50,10 Q60,40 80,60 A30,30 0 0,1 20,60 Q40,40 50,10 Z" />
                              </svg>
                            </div>
                          )}
                          {city.type === 'tax' && city.name.includes('Income') && (
                            <div className="flex-1 w-full flex items-center justify-center my-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>
                              <svg viewBox="0 0 100 100" className="w-[70%] h-auto fill-black">
                                 <polygon points="50,10 90,40 75,90 25,90 10,40" />
                                 <text x="50%" y="60%" textAnchor="middle" fill="white" fontSize="30" fontWeight="bold">TAX</text>
                              </svg>
                            </div>
                          )}
                          {city.type === 'tax' && city.name.includes('Luxury') && (
                            <div className="flex-1 w-full flex items-center justify-center my-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>
                              <svg viewBox="0 0 100 100" className="w-[60%] h-auto fill-[#0072bb]">
                                 <polygon points="20,30 80,30 50,90" />
                                 <polygon points="20,30 50,10 80,30" fill="#aae0fa"/>
                              </svg>
                            </div>
                          )}
                          {city.type === 'special' && city.name === 'Chance' && (
                            <div className="flex-1 w-full flex items-center justify-center my-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>
                              <span className="text-4xl font-black text-[#c18625] leading-none">?</span>
                            </div>
                          )}
                          {city.type === 'special' && city.name === 'Community Chest' && (
                            <div className="flex-1 w-full flex items-center justify-center my-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>
                              <svg viewBox="0 0 100 80" className="w-[80%] h-auto fill-[#f7941d] stroke-black stroke-[3px]">
                                 <rect x="5" y="30" width="90" height="45" rx="4" fill="#deb887" />
                                 <path d="M5,30 Q50,5 95,30" fill="#deb887" />
                                 <rect x="5" y="30" width="90" height="10" fill="#a0522d" />
                                 <rect x="5" y="65" width="90" height="10" fill="#a0522d" />
                                 <rect x="40" y="25" width="20" height="18" fill="#fef200" stroke="black" rx="2" />
                                 <circle cx="50" cy="36" r="3" fill="black" />
                              </svg>
                            </div>
                          )}

                          {(city.price || city.cost) && <span className="text-[0.65rem] font-bold text-black mt-auto mb-1" style={isTopRow ? { transform: 'rotate(180deg)' } : {}}>{city.price ? `₹${city.price}` : `PAY ₹${city.cost}`}</span>}
                      </div>
                    )}

                    {/* Corner Tiles */}
                    {city.id === 0 && (
                      <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                        <div className="-rotate-45 flex flex-col items-center justify-center w-[120%] h-[120%]">
                          <span className="text-[0.5rem] font-bold text-black leading-[1] uppercase text-center tracking-tighter">COLLECT<br/>₹200<br/>SALARY AS<br/>YOU PASS</span>
                          <svg viewBox="0 0 100 40" className="w-[60%] h-auto my-1 fill-[#ed1b24]">
                            <path d="M0,20 L30,0 L30,10 L100,10 L100,30 L30,30 L30,40 Z"/>
                          </svg>
                          <span className="text-[1.8rem] font-black text-black uppercase leading-none tracking-tighter">GO</span>
                        </div>
                      </div>
                    )}
                    {city.id === 10 && (
                      <div className="w-full h-full relative overflow-hidden bg-[#fbf8ef]">
                         {/* Orange Jail Box (Top-Right) */}
                         <div className="absolute top-0 right-0 w-[70%] h-[70%] bg-[#f7941d] border-l-[2px] border-b-[2px] border-black flex flex-col items-center justify-center p-1">
                            <div className="transform rotate-45 flex flex-col items-center w-full h-full justify-center">
                               <span className="text-[0.7rem] font-black uppercase text-black leading-none mb-1">IN</span>
                               
                               {/* Jail Bars */}
                               <div className="w-[85%] aspect-square bg-[#fbf8ef] border-[2px] border-black relative flex items-end justify-center overflow-hidden">
                                  {/* Character */}
                                  <div className="absolute inset-0 flex justify-center items-end opacity-70">
                                    <svg viewBox="0 0 100 100" className="w-[85%] h-auto fill-black">
                                      <circle cx="50" cy="30" r="20" />
                                      <path d="M20,100 Q20,50 50,50 Q80,50 80,100 Z" />
                                    </svg>
                                  </div>
                                  {/* Bars */}
                                  <div className="absolute inset-0 flex justify-evenly items-center w-full h-full">
                                    <div className="w-[4px] h-full bg-black"></div>
                                    <div className="w-[4px] h-full bg-black"></div>
                                    <div className="w-[4px] h-full bg-black"></div>
                                  </div>
                               </div>

                               <span className="text-[0.8rem] font-black uppercase text-black leading-none mt-1">JAIL</span>
                            </div>
                         </div>

                         {/* JUST (Left Edge) */}
                         <div className="absolute top-0 bottom-[30%] left-0 w-[30%] flex items-center justify-center">
                            <span className="text-[0.75rem] font-black uppercase text-black -rotate-90 tracking-widest whitespace-nowrap">JUST</span>
                         </div>
                         
                         {/* VISITING (Bottom Edge) */}
                         <div className="absolute bottom-0 right-0 left-0 h-[30%] flex items-center justify-center">
                            <span className="text-[0.75rem] font-black uppercase text-black tracking-widest pl-[15%]">VISITING</span>
                         </div>
                      </div>
                    )}
                    {city.id === 20 && (
                      <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                         <div className="flex flex-col items-center transform rotate-[135deg] w-[120%] justify-center">
                           <span className="text-[0.6rem] font-bold text-black uppercase leading-[1.1] text-center tracking-tighter w-full block">FREE</span>
                           <svg viewBox="0 0 100 60" className="w-[70%] h-auto my-0.5 fill-[#ed1b24] stroke-black stroke-[1.5px]">
                             <path d="M10,40 L90,40 C95,40 95,30 90,30 L75,25 L65,10 C60,5 40,5 35,10 L25,25 L10,30 C5,30 5,40 10,40 Z" />
                             <circle cx="25" cy="45" r="10" fill="black"/>
                             <circle cx="25" cy="45" r="4" fill="white" stroke="none"/>
                             <circle cx="75" cy="45" r="10" fill="black"/>
                             <circle cx="75" cy="45" r="4" fill="white" stroke="none"/>
                             <rect x="35" y="12" width="12" height="13" fill="white" stroke="black" />
                             <rect x="52" y="12" width="12" height="13" fill="white" stroke="black" />
                           </svg>
                           <span className="text-[0.6rem] font-bold text-black uppercase leading-[1.1] text-center tracking-tighter w-full block">PARKING</span>
                         </div>
                      </div>
                    )}
                    {city.id === 30 && (
                      <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                         <div className="flex flex-col items-center transform -rotate-[135deg] w-[120%] justify-center">
                           <span className="text-[0.6rem] font-bold text-black uppercase leading-[1.1] text-center tracking-tighter w-full block">GO TO</span>
                           <svg viewBox="0 0 100 80" className="w-[60%] h-auto my-0.5 fill-[#0072bb] stroke-black stroke-[1.5px]">
                             <path d="M30,80 Q30,40 50,40 Q70,40 70,80 Z" />
                             <circle cx="50" cy="30" r="15" fill="#fbc490" />
                             <path d="M25,20 Q50,-10 75,20 Z" fill="#0072bb" />
                             <path d="M20,20 L80,20 L80,25 L20,25 Z" fill="black" />
                             <path d="M50,30 Q55,30 60,35" fill="none" stroke="black" />
                             <circle cx="45" cy="25" r="2" fill="black" stroke="none" />
                             <circle cx="55" cy="25" r="2" fill="black" stroke="none" />
                             <path d="M50,40 Q60,45 80,45 L80,50 Q60,50 50,40 Z" fill="#fbc490" />
                           </svg>
                           <span className="text-[0.8rem] font-black text-black uppercase leading-[1.1] text-center tracking-tighter w-full block">JAIL</span>
                         </div>
                      </div>
                    )}
                  </div>

                   {/* Back Face: Mortgaged Overlay Stamp */}
                  <div 
                    className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-zinc-200 border border-red-600 shadow-inner"
                    style={{ 
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <div className="text-red-600 font-black text-[0.48rem] border border-red-600 px-0.5 py-0.2 rounded transform -rotate-12 uppercase tracking-tight bg-white/95 shadow-sm text-center w-[85%] truncate leading-tight">
                      MORTGAGED
                    </div>
                    {ownerPlayer && (
                      <span className="mt-1 text-[0.45rem] font-black px-1 rounded-sm text-white uppercase truncate max-w-full leading-normal" style={{ backgroundColor: ownerPlayer.color }}>
                        {ownerPlayer.name}
                      </span>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Dynamic Players Container */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 z-20 pointer-events-none flex-wrap p-1">
                {visualPlayers.map(p => p.position === city.id && (
                  <motion.div 
                    layoutId={`player-${p.id}`}
                    key={p.id} 
                    className={`relative z-50 ${p.bankrupt ? 'hidden' : ''}`}
                  >
                    <TokenIcon color={p.color} size={28} />
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}

        {/* CENTER BOARD ARTWORK */}
        <div 
          className="relative pointer-events-none z-0 border-[4px] border-black"
          style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
        >
           {/* Community Chest Placeholder */}
           <div className="absolute top-[15%] left-[15%] w-[18%] h-[12%] bg-[#ffdfbd] border-[1.5px] border-black flex items-center justify-center transform rotate-45 shadow-inner opacity-80">
              <svg viewBox="0 0 100 80" className="w-[50%] h-auto fill-[#f7941d] stroke-black stroke-[3px]">
                 <rect x="10" y="30" width="80" height="40" rx="4" />
                 <path d="M10,30 Q50,10 90,30" fill="none" />
                 <rect x="40" y="25" width="20" height="15" fill="#fef200" stroke="black" rx="2" />
              </svg>
           </div>

           {/* Monopoly Banner */}
           <div className="absolute inset-0 flex items-center justify-center">
             <div className="bg-[#ed1b24] border-2 border-black transform -rotate-45 px-6 py-1 shadow-[4px_4px_0_rgba(0,0,0,0.2)] w-[70%] flex justify-center">
                <h1 className="text-white text-[2.5rem] font-black uppercase tracking-[0.2em] drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
                  MONOPOLY
                </h1>
             </div>
           </div>

           {/* Chance Placeholder */}
           <div className="absolute bottom-[15%] right-[15%] w-[18%] h-[12%] bg-[#aae0fa] border-[1.5px] border-black flex items-center justify-center transform rotate-45 shadow-inner opacity-80">
              <span className="text-4xl font-black text-[#f7941d] drop-shadow-[1px_1px_0_rgba(0,0,0,1)]">?</span>
           </div>


           {/* Property Card Popup Overlay Container (Moved to Root) */}
        </div>
      </div>
    </div>
  );
}