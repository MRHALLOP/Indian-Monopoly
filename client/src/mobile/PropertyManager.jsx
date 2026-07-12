import { CITIES } from '../constants';

const COLOR_GROUPS = {};
CITIES.forEach(city => {
  if (city.color && !city.type && city.price) {
    if (!COLOR_GROUPS[city.color]) COLOR_GROUPS[city.color] = [];
    COLOR_GROUPS[city.color].push(city.id);
  }
});

function Icon({ name, fill = 0, size = 20, className = '' }) {
  return (
    <span className={`material-symbols-outlined select-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}` }}>
      {name}
    </span>
  );
}

export default function PropertyManager({ propertyId, socket, room, gameState }) {
  const property = CITIES.find(c => c.id === propertyId);
  if (!property) return null;

  const state = gameState?.boardState[propertyId] || {};
  const isMortgaged = state.mortgaged;
  const houses = state.houses || 0;

  const buildCost = property.houseCost || Math.floor(property.price * 0.5);
  const mortgageValue = Math.floor(property.price * 0.5);
  const unmortgageCost = Math.floor(mortgageValue * 1.1);
  const sellHouseValue = Math.floor(buildCost * 0.5);

  const isMyTurn = gameState?.players[gameState.currentTurn]?.id === socket.id;
  const colorGroup = COLOR_GROUPS[property.color] || [];
  const ownsFullSet = colorGroup.length > 0 && colorGroup.every(propId => {
    const propState = gameState?.boardState[propId];
    return propState && propState.owner === socket.id;
  });

  const hasMortgaged = colorGroup.some(propId => {
    const propState = gameState?.boardState[propId];
    return propState && propState.mortgaged;
  });

  const canBuildEvenly = ownsFullSet && !hasMortgaged && colorGroup.every(propId => {
    const propState = gameState?.boardState[propId] || {};
    const propHouses = propState.houses || 0;
    return propHouses >= houses;
  });

  const canBuild = !isMortgaged && property.type !== 'station' && property.type !== 'utility'
    && houses < 5 && isMyTurn && ownsFullSet && !hasMortgaged && canBuildEvenly;

  let buildLabel = `Build (₹${buildCost})`;
  if (!isMyTurn) buildLabel = 'Not your turn';
  else if (!ownsFullSet) buildLabel = 'Need full set';
  else if (hasMortgaged) buildLabel = 'Set is mortgaged';
  else if (!canBuildEvenly) buildLabel = 'Build evenly';

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: '#fff', border: '1px solid #eae7e7', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', opacity: isMortgaged ? 0.7 : 1 }}>
      {/* Color band */}
      <div className={`h-1.5 w-full ${property.color}`} />
      <div className="p-3">
        {/* Property name & houses */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-sm font-black uppercase tracking-wide" style={{ fontFamily: 'Montserrat', color: '#1b1c1c' }}>
              {property.name}
            </span>
            {isMortgaged && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase"
                style={{ background: '#ffdad6', color: '#ba1a1a', fontFamily: 'Plus Jakarta Sans' }}>
                Mortgaged
              </span>
            )}
          </div>
          <div className="flex gap-1 items-center">
            {houses > 0 && houses < 5 && [...Array(houses)].map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: '#52625a' }} />
            ))}
            {houses === 5 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase"
                style={{ background: '#ba1a1a', color: '#fff', fontFamily: 'Plus Jakarta Sans' }}>Hotel</span>
            )}
            {ownsFullSet && (
              <Icon name="stars" fill={1} size={14} className="text-[#794e00] ml-1" />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Build house */}
          {property.type !== 'station' && property.type !== 'utility' && houses < 5 && !isMortgaged && (
            <button onClick={() => socket.emit('manage_property', { room, action: 'BUILD_HOUSE', propertyId })}
              disabled={!canBuild}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold btn-press disabled:opacity-40"
              style={{
                background: canBuild ? '#d3e4da' : '#f0eded',
                color: canBuild ? '#101e19' : '#88717a',
                fontFamily: 'Plus Jakarta Sans',
                border: `1px solid ${canBuild ? '#bacac1' : '#dbbfc9'}`,
              }}>
              {buildLabel}
            </button>
          )}
          {/* Sell house */}
          {houses > 0 && isMyTurn && (() => {
            const canSellEvenly = colorGroup.every(propId => {
              const propState = gameState?.boardState[propId] || {};
              const propHouses = propState.houses || 0;
              return propHouses <= houses;
            });
            return (
              <button onClick={() => socket.emit('manage_property', { room, action: 'SELL_HOUSE', propertyId })}
                disabled={!canSellEvenly}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold btn-press disabled:opacity-40"
                style={{
                  background: canSellEvenly ? '#ffddb4' : '#f0eded',
                  color: canSellEvenly ? '#291800' : '#88717a',
                  fontFamily: 'Plus Jakarta Sans',
                  border: `1px solid ${canSellEvenly ? '#ffb955' : '#dbbfc9'}`
                }}>
                {canSellEvenly ? `Sell House +₹${sellHouseValue}` : 'Sell evenly'}
              </button>
            );
          })()}
          {/* Mortgage / Unmortgage */}
          {isMortgaged ? (
            <button onClick={() => socket.emit('manage_property', { room, action: 'UNMORTGAGE', propertyId })}
              disabled={!isMyTurn}
              className="w-full py-2.5 rounded-lg text-xs font-bold btn-press disabled:opacity-40"
              style={{ background: '#d3e4da', color: '#101e19', fontFamily: 'Plus Jakarta Sans', border: '1px solid #bacac1' }}>
              Unmortgage -₹{unmortgageCost}
            </button>
          ) : (() => {
            const setHasHouses = colorGroup.some(propId => {
              const propState = gameState?.boardState[propId];
              return propState && (propState.houses || 0) > 0;
            });
            const canMortgage = houses === 0 && isMyTurn && !setHasHouses;
            return (
              <button onClick={() => socket.emit('manage_property', { room, action: 'MORTGAGE', propertyId })}
                disabled={!canMortgage}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold btn-press disabled:opacity-40"
                style={{
                  background: canMortgage ? '#ffdad6' : '#f0eded',
                  color: canMortgage ? '#93000a' : '#88717a',
                  fontFamily: 'Plus Jakarta Sans',
                  border: `1px solid ${canMortgage ? '#f4b8b8' : '#dbbfc9'}`
                }}>
                {setHasHouses ? 'Sell houses first' : `Mortgage +₹${mortgageValue}`}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}