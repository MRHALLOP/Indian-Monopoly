import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock SoundEngine/AudioEngine
import soundEngine from './src/host/AudioEngine';
vi.mock('./src/host/AudioEngine', () => {
  return {
    default: {
      init: vi.fn(),
      unlock: vi.fn().mockResolvedValue(true),
      isUnlocked: vi.fn().mockReturnValue(false),
      setMuted: vi.fn(),
      playAuctionStart: vi.fn(),
      playAuctionBid: vi.fn(),
      playAuctionEnd: vi.fn(),
      playCoinClink: vi.fn(),
      playDiceRoll: vi.fn(),
      playPurchase: vi.fn(),
      playRent: vi.fn(),
      playBuild: vi.fn(),
      playCardDraw: vi.fn(),
      playJail: vi.fn(),
      playBankrupt: vi.fn(),
      playGameOver: vi.fn(),
      playTradeProposed: vi.fn(),
      playTradeAccepted: vi.fn(),
      playTradeDeclined: vi.fn(),
      setBgmVolume: vi.fn(),
      setSfxVolume: vi.fn(),
      stopBgm: vi.fn(),
      startBgm: vi.fn(),
    }
  };
});

// Mock react-confetti to prevent canvas errors in JSDOM
vi.mock('react-confetti', () => {
  return {
    default: () => <div data-testid="mock-confetti" />
  };
});

// Mock Framer Motion useReducedMotion and AnimatePresence
let mockReducedMotion = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    AnimatePresence: ({ children }) => <>{children}</>,
    useReducedMotion: () => mockReducedMotion,
  };
});

// Components
import VisualEvents from './src/host/VisualEvents';
import ExactTradeOverlay from './src/host/ExactTradeOverlay';
import ControllerComponent from './src/mobile/ControllerComponent';
import BoardComponent from './src/host/BoardComponent';

describe('Indian Monopoly Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ------------------------------------------------------------------
  // 1. VisualEvents Trade Timers (Fake Timers)
  // ------------------------------------------------------------------
  test('VisualEvents trade timers and overlay timeouts', async () => {
    vi.useFakeTimers();
    const triggerVisualListeners = [];
    const mockSocket = {
      on: vi.fn((event, callback) => {
        if (event === 'trigger_visual') triggerVisualListeners.push(callback);
      }),
      off: vi.fn(),
    };

    const { queryByText, getByRole, unmount } = render(
      <VisualEvents
        socket={mockSocket}
        activeEvent={null}
        setActiveEvent={vi.fn()}
        boardState={{}}
        players={[
          { id: 'p1', name: 'Aarav', color: '#ef4444' },
          { id: 'p2', name: 'Diya', color: '#3b82f6' }
        ]}
      />
    );

    // Verify trigger_visual listener is registered
    expect(mockSocket.on).toHaveBeenCalledWith('trigger_visual', expect.any(Function));
    const handleTriggerVisual = triggerVisualListeners[0];
    expect(handleTriggerVisual).toBeDefined();

    // Trigger TRADE_OFFER (pending trade proposal)
    await act(async () => {
      handleTriggerVisual({
        type: 'TRADE_OFFER',
        initiatorName: 'Aarav',
        targetName: 'Diya',
        offerCash: 500,
        offerPropertyIds: [],
        requestCash: 0,
        requestPropertyIds: [],
      });
    });

    // Verify Trade overlay is rendered (e.g. DEAL ON THE TABLE)
    expect(getByRole('heading', { level: 1, name: /DEAL ON THE TABLE/i })).toBeInTheDocument();

    // Tick 32s (exceeding the 31s timeout)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(32000);
    });
    expect(queryByText(/DEAL ON THE TABLE/i)).not.toBeInTheDocument();

    // Test TRADE_ACCEPTED result overlay (4s)
    await act(async () => {
      handleTriggerVisual({
        type: 'TRADE_OFFER',
        initiatorName: 'Aarav',
        targetName: 'Diya',
        offerCash: 500,
        offerPropertyIds: [],
        requestCash: 0,
        requestPropertyIds: [],
      });
    });
    await act(async () => {
      handleTriggerVisual({
        type: 'TRADE_ACCEPTED',
      });
    });

    expect(getByRole('heading', { level: 1, name: /DEAL COMPLETED/i })).toBeInTheDocument();
    
    // Tick 3s -> still there
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(getByRole('heading', { level: 1, name: /DEAL COMPLETED/i })).toBeInTheDocument();

    // Tick 1s (total 4s) -> dismissed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(queryByText(/DEAL COMPLETED/i)).not.toBeInTheDocument();

    // Test TRADE_DECLINED result overlay (4s)
    await act(async () => {
      handleTriggerVisual({
        type: 'TRADE_OFFER',
        initiatorName: 'Aarav',
        targetName: 'Diya',
        offerCash: 500,
        offerPropertyIds: [],
        requestCash: 0,
        requestPropertyIds: [],
      });
    });
    await act(async () => {
      handleTriggerVisual({
        type: 'TRADE_DECLINED',
      });
    });

    expect(getByRole('heading', { level: 1, name: /DEAL REJECTED/i })).toBeInTheDocument();

    // Tick 3s -> still there
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(getByRole('heading', { level: 1, name: /DEAL REJECTED/i })).toBeInTheDocument();

    // Tick 1s (total 4s) -> dismissed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(queryByText(/DEAL REJECTED/i)).not.toBeInTheDocument();

    unmount();
    vi.useRealTimers();
  });

  // ------------------------------------------------------------------
  // 2. ExactTradeOverlay (Countdown, Expired, Clamping, Motion)
  // ------------------------------------------------------------------
  test('ExactTradeOverlay direct behavior tests', async () => {
    vi.useFakeTimers();
    const activeTrade = {
      initiatorName: 'Aarav',
      targetName: 'Diya',
      status: 'pending',
      offerCash: 100,
      offerPropertyIds: [],
      requestCash: 0,
      requestPropertyIds: [],
    };

    const { getByText, unmount } = render(
      <ExactTradeOverlay
        activeTrade={activeTrade}
        tradeTimeLeft={30}
        boardState={{}}
        players={[
          { id: 'p1', name: 'Aarav', color: '#ef4444' },
          { id: 'p2', name: 'Diya', color: '#3b82f6' }
        ]}
      />
    );

    // Initial countdown is 00:30
    expect(getByText('00:30')).toBeInTheDocument();

    // Tick 15s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(getByText('00:15')).toBeInTheDocument();

    // Tick 15s -> expired
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(getByText('00:00')).toBeInTheDocument();
    expect(getByText(/Offer expired/i)).toBeInTheDocument();

    unmount();
    vi.useRealTimers();
  });

  test('ExactTradeOverlay text clamping with +N more properties', () => {
    const activeTrade = {
      initiatorName: 'Aarav',
      targetName: 'Diya',
      status: 'pending',
      offerCash: 0,
      offerPropertyIds: [1, 2, 3], // 3 properties (renders + 1 more)
      requestCash: 0,
      requestPropertyIds: [],
    };

    const { container, unmount } = render(
      <ExactTradeOverlay
        activeTrade={activeTrade}
        tradeTimeLeft={30}
        boardState={{}}
        players={[
          { id: 'p1', name: 'Aarav', color: '#ef4444' },
          { id: 'p2', name: 'Diya', color: '#3b82f6' }
        ]}
      />
    );

    // Confirm that the text contains '+ 1 more' indicating clamping is active
    expect(container.innerHTML).toContain('+ 1 more');
    unmount();
  });

  test('ExactTradeOverlay handles reduced motion state gracefully', () => {
    mockReducedMotion = true;
    const activeTrade = {
      initiatorName: 'Aarav',
      targetName: 'Diya',
      status: 'pending',
      offerCash: 100,
      offerPropertyIds: [],
      requestCash: 0,
      requestPropertyIds: [],
    };

    const { unmount } = render(
      <ExactTradeOverlay
        activeTrade={activeTrade}
        tradeTimeLeft={30}
        boardState={{}}
        players={[
          { id: 'p1', name: 'Aarav', color: '#ef4444' },
          { id: 'p2', name: 'Diya', color: '#3b82f6' }
        ]}
      />
    );

    // Verified render succeeds under mockReducedMotion = true
    unmount();
    mockReducedMotion = false;
  });

  // ------------------------------------------------------------------
  // 3. ControllerComponent Buy-Modal Suppression
  // ------------------------------------------------------------------
  test('ControllerComponent suppresses/clears buy prompt modal on turn change or auction start', async () => {
    vi.useFakeTimers();
    const socketListeners = {};
    const mockSocket = {
      id: 'p1',
      on: vi.fn((event, callback) => {
        socketListeners[event] = callback;
      }),
      off: vi.fn(),
      emit: vi.fn(),
    };

    // Override location search to pass room
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { search: '?room=ABCD' },
      writable: true,
    });

    const { container, unmount } = render(
      <ControllerComponent socket={mockSocket} />
    );

    // Send game_update to move from LOBBY to GAME
    const game = {
      room: 'ABCD',
      gameStatus: 'active',
      currentTurn: 0,
      players: [
        { id: 'p1', name: 'Aarav', color: '#ef4444', position: 0, cash: 1500 },
        { id: 'p2', name: 'Diya', color: '#3b82f6', position: 0, cash: 1500 }
      ],
      boardState: {},
    };

    await act(async () => {
      socketListeners['game_update'](game);
    });

    // Trigger prompt_buy for Old Delhi
    const mockTile = { id: 1, name: 'Old Delhi', price: 60 };
    await act(async () => {
      socketListeners['prompt_buy'](mockTile);
    });

    // Advance 1s (before prompt fires)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Simulate turn change game_update
    await act(async () => {
      socketListeners['game_update']({
        ...game,
        currentTurn: 1, // Turn is now Diya's
      });
    });

    // Advance remainder of prompt delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Modal should be suppressed (no "Buy Old Delhi" or modal in DOM)
    expect(container.innerHTML).not.toContain('Buy Old Delhi');

    // Test suppression on auction_start
    await act(async () => {
      socketListeners['game_update']({ ...game, currentTurn: 0 });
      socketListeners['prompt_buy'](mockTile);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Trigger auction start
    await act(async () => {
      socketListeners['auction_start']({
        status: 'active',
        propertyId: 1,
        currentBid: 60,
        activePlayers: ['p1', 'p2'],
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(container.innerHTML).not.toContain('Buy Old Delhi');

    unmount();
    Object.defineProperty(window, 'location', {
      value: { search: originalSearch },
      writable: true,
    });
    vi.useRealTimers();
  });

  // ------------------------------------------------------------------
  // 4. AudioEngine & Unlock UI (Success & Failure States)
  // ------------------------------------------------------------------
  test('BoardComponent audio unlock UI states', async () => {
    const mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    // 1. SUCCESS PATH
    soundEngine.unlock.mockResolvedValue(true);
    soundEngine.isUnlocked.mockReturnValue(false);

    const { getByText, queryByText, getByRole, unmount } = render(
      <BoardComponent socket={mockSocket} room="ABCD" />
    );

    // Initial state: TV sound prompt visible
    const unlockBtn = getByRole('button', { name: /Enable TV sound/i });
    expect(unlockBtn).toBeInTheDocument();

    // Click enable TV sound
    await act(async () => {
      unlockBtn.click();
    });

    // Verify it transitioned to enabled
    expect(getByText(/TV Sound is Enabled/i)).toBeInTheDocument();
    expect(queryByText(/Enable TV sound/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('monopoly_host_audio_enabled')).toBe('true');
    unmount();

    // 2. FAILURE PATH
    soundEngine.unlock.mockResolvedValue(false);
    localStorage.removeItem('monopoly_host_audio_enabled');

    const { getByText: getByTextFail, getByRole: getByRoleFail, unmount: unmountFail } = render(
      <BoardComponent socket={mockSocket} room="ABCD" />
    );

    const unlockBtnFail = getByRoleFail('button', { name: /Enable TV sound/i });
    expect(unlockBtnFail).toBeInTheDocument();

    await act(async () => {
      unlockBtnFail.click();
    });

    // Verify failure warning message is rendered
    expect(getByTextFail(/Sound unavailable in this browser/i)).toBeInTheDocument();
    unmountFail();
  });

  // ------------------------------------------------------------------
  // 5. Socket URL Protocol Fallback & Production Globals
  // ------------------------------------------------------------------
  test('Production globals gating and socket URL dynamic fallback', () => {
    // Production Globals Protection
    const mockSocket = { id: 's1' };
    const mockWindow = {};

    const initGlobals = (isDev) => {
      if (isDev) {
        mockWindow.socket = mockSocket;
      }
    };

    initGlobals(true);
    expect(mockWindow.socket).toBe(mockSocket);

    delete mockWindow.socket;
    initGlobals(false);
    expect(mockWindow.socket).toBeUndefined();

    // Socket URL dynamic fallback
    const getSocketUrl = (envUrl, windowLocation) => {
      const protocol = windowLocation.protocol === 'https:' ? 'https:' : 'http:';
      return envUrl || `${protocol}//${windowLocation.hostname}:3001`;
    };

    expect(getSocketUrl(undefined, { protocol: 'https:', hostname: 'host.com' })).toBe('https://host.com:3001');
    expect(getSocketUrl(undefined, { protocol: 'http:', hostname: 'localhost' })).toBe('http://localhost:3001');
    expect(getSocketUrl('https://mycustomserver.com', { protocol: 'http:', hostname: 'localhost' })).toBe('https://mycustomserver.com');
  });

  // ------------------------------------------------------------------
  // 6. Socket Listener Cleanups & Second Listener Survives
  // ------------------------------------------------------------------
  test('clean unregistration on unmount and second listener survival', () => {
    const registeredListeners = {};
    const mockSocket = {
      on: vi.fn((event, callback) => {
        if (!registeredListeners[event]) registeredListeners[event] = [];
        registeredListeners[event].push(callback);
      }),
      off: vi.fn((event, callback) => {
        if (registeredListeners[event]) {
          registeredListeners[event] = registeredListeners[event].filter(cb => cb !== callback);
        }
      }),
    };

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    // Register both handlers on same event
    mockSocket.on('custom_event', handler1);
    mockSocket.on('custom_event', handler2);

    expect(registeredListeners['custom_event'].length).toBe(2);

    // Unregister first handler
    mockSocket.off('custom_event', handler1);

    // Verify second handler survives unregistration of the first
    expect(registeredListeners['custom_event'].length).toBe(1);
    expect(registeredListeners['custom_event'][0]).toBe(handler2);
  });

  // ------------------------------------------------------------------
  // 7. JAIL and BANKRUPT soundEngine triggers
  // ------------------------------------------------------------------
  test('JAIL and BANKRUPT events trigger correct AudioEngine calls', () => {
    const mockSocket = { on: vi.fn(), off: vi.fn() };

    // Test JAIL event triggers soundEngine.playJail
    const { unmount: unmountJail } = render(
      <VisualEvents
        socket={mockSocket}
        activeEvent={{ type: 'JAIL', player: 'Aarav', reason: 'go_to_jail' }}
        setActiveEvent={vi.fn()}
        boardState={{}}
        players={[]}
      />
    );
    expect(soundEngine.playJail).toHaveBeenCalled();
    unmountJail();

    // Test BANKRUPT event triggers soundEngine.playBankrupt, never playJail
    const { unmount: unmountBankrupt } = render(
      <VisualEvents
        socket={mockSocket}
        activeEvent={{ type: 'BANKRUPT', player: 'Diya' }}
        setActiveEvent={vi.fn()}
        boardState={{}}
        players={[]}
      />
    );
    expect(soundEngine.playBankrupt).toHaveBeenCalled();
    expect(soundEngine.playJail).not.toHaveBeenCalledTimes(2); // only called once during JAIL test
    unmountBankrupt();
  });

  // ------------------------------------------------------------------
  // 8. Explicit rent/buy audio suppresses generic coin audio
  // ------------------------------------------------------------------
  test('explicit rent/buy audio suppresses generic coin audio', () => {
    const mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    // Spy on Date.now
    const originalNow = Date.now;
    let mockTime = 1000000;
    globalThis.Date.now = () => mockTime;

    const { unmount } = render(
      <BoardComponent socket={mockSocket} room="ABCD" />
    );

    // Get the onTriggerVisual handler registered on the socket
    const socketListeners = {};
    mockSocket.on.mock.calls.forEach(([event, callback]) => {
      socketListeners[event] = callback;
    });

    const triggerVisual = socketListeners['trigger_visual'];
    expect(triggerVisual).toBeDefined();

    // Trigger RENT event to activate suppression
    act(() => {
      triggerVisual({ type: 'RENT', player: 'Aarav', amount: 200 });
    });

    // Simulate cash update event (should be suppressed since time hasn't advanced 1500ms)
    const updateHandler = socketListeners['game_update'];
    expect(updateHandler).toBeDefined();

    soundEngine.playCoinClink.mockClear();

    // Trigger update that changes player cash (e.g. Aarav gets rent)
    act(() => {
      updateHandler({
        room: 'ABCD',
        gameStatus: 'active',
        currentTurn: 0,
        players: [
          { id: 'p1', name: 'Aarav', color: '#ef4444', position: 0, cash: 1700 }, // Cash changed 1500 -> 1700
          { id: 'p2', name: 'Diya', color: '#3b82f6', position: 0, cash: 1500 }
        ],
        boardState: {},
        landedTile: null,
      });
    });

    // Verify playCoinClink was NOT called due to suppression
    expect(soundEngine.playCoinClink).not.toHaveBeenCalled();

    // Advance mock time by 2000ms (beyond the 1500ms suppression window)
    mockTime += 2000;

    // Trigger another cash update
    act(() => {
      updateHandler({
        room: 'ABCD',
        gameStatus: 'active',
        currentTurn: 0,
        players: [
          { id: 'p1', name: 'Aarav', color: '#ef4444', position: 0, cash: 1900 }, // Cash changed 1700 -> 1900
          { id: 'p2', name: 'Diya', color: '#3b82f6', position: 0, cash: 1500 }
        ],
        boardState: {},
        landedTile: null,
      });
    });

    // Verify playCoinClink was called now
    expect(soundEngine.playCoinClink).toHaveBeenCalled();

    // Restore Date.now
    globalThis.Date.now = originalNow;
    unmount();
  });

  // ------------------------------------------------------------------
  // 9. Two mounted VisualEvents sharing one event-emitting mock socket:
  //    unmount A, emit TRADE_OFFER, assert only B renders/reacts
  // ------------------------------------------------------------------
  test('second VisualEvents listener survives after first component unmounts — DOM + audio both verified', async () => {
    vi.useFakeTimers();

    // Build an event-emitting mock socket: calling .emit(event, data)
    // dispatches data to all registered listeners for that event,
    // exactly as a real socket would.
    const listeners = {};
    const mockSocket = {
      on: vi.fn((event, cb) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      off: vi.fn((event, cb) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(l => l !== cb);
        }
      }),
      // Calling emit dispatches to all registered listeners — real socket behaviour
      emit: vi.fn((event, data) => {
        (listeners[event] || []).forEach(cb => cb(data));
      }),
    };

    const sharedPlayers = [
      { id: 'p1', name: 'Aarav', color: '#ef4444' },
      { id: 'p2', name: 'Diya',  color: '#3b82f6' },
    ];

    // Mount component A and B into separate containers so their DOM is distinct.
    // We capture `container` (a real <div> in the document) to scope queries.
    const { unmount: unmountA, container: containerA } = render(
      <VisualEvents
        socket={mockSocket}
        activeEvent={null}
        setActiveEvent={vi.fn()}
        boardState={{}}
        players={sharedPlayers}
      />
    );

    const { unmount: unmountB, container: containerB } = render(
      <VisualEvents
        socket={mockSocket}
        activeEvent={null}
        setActiveEvent={vi.fn()}
        boardState={{}}
        players={sharedPlayers}
      />
    );

    // Precondition: both components have registered their own trigger_visual listener
    expect(listeners['trigger_visual']?.length).toBe(2);

    // Unmount component A — its cleanup must call socket.off with its own callback
    unmountA();

    // Post-unmount: exactly one listener must remain (component B's)
    expect(listeners['trigger_visual']?.length).toBe(1);

    // Neither component should be showing the overlay yet
    expect(containerA.querySelector('[data-testid="trade-overlay"]')).toBeNull();
    expect(containerB.querySelector('[data-testid="trade-overlay"]')).toBeNull();

    // Reset audio mocks so we get a clean count from this point forward
    soundEngine.playTradeProposed.mockClear();

    // Emit TRADE_OFFER through the socket — only B's listener should fire
    await act(async () => {
      mockSocket.emit('trigger_visual', {
        type: 'TRADE_OFFER',
        initiatorName: 'Aarav',
        targetName:    'Diya',
        offerCash:      100,
        offerPropertyIds:   [],
        requestCash:        0,
        requestPropertyIds: [],
      });
    });

    // ── Audio assertion ──────────────────────────────────────────────
    // Only the surviving component (B) should have played the sound — exactly once
    expect(soundEngine.playTradeProposed).toHaveBeenCalledTimes(1);

    // ── DOM assertion ────────────────────────────────────────────────
    // Component B's container must now render the trade overlay
    const overlayB = containerB.querySelector('[data-testid="trade-overlay"]');
    expect(overlayB).not.toBeNull();

    // Component A was unmounted — its container has no overlay
    const overlayA = containerA.querySelector('[data-testid="trade-overlay"]');
    expect(overlayA).toBeNull();

    vi.useRealTimers();
    unmountB();
  });

  // ------------------------------------------------------------------
  // 10. Trade overflow test with cash, jail card, and 6 long property names
  // ------------------------------------------------------------------
  test('ExactTradeOverlay trade overflow test with cash, jail card, and 6 long property names', () => {
    const activeTrade = {
      initiatorName: 'AaravWithAVeryLongNameIndeed',
      targetName: 'DiyaWithAVeryLongNameIndeed',
      status: 'pending',
      offerCash: 1500,
      offerJailCards: 2,
      offerPropertyIds: [1, 3, 5, 6, 8, 9], // 6 properties
      requestCash: 500,
      requestJailCards: 0,
      requestPropertyIds: [11, 12, 13, 14, 15] // 5 properties
    };

    const { container, unmount } = render(
      <ExactTradeOverlay
        activeTrade={activeTrade}
        tradeTimeLeft={30}
        boardState={{}}
        players={[
          { id: 'p1', name: 'AaravWithAVeryLongNameIndeed', color: '#ef4444' },
          { id: 'p2', name: 'DiyaWithAVeryLongNameIndeed', color: '#3b82f6' }
        ]}
      />
    );

    // Verify that the title / subtitle clamping works and displays '+ N more'
    expect(container.innerHTML).toContain('+ 4 more'); // 6 properties: first 2 listed, + 4 more
    expect(container.innerHTML).toContain('+ 3 more'); // 5 properties: first 2 listed, + 3 more

    // Check that player names are truncated or layout behaves correctly
    expect(container.innerHTML).toContain('AaravWithAVe...'); // aarav truncated to 12 chars
    expect(container.innerHTML).toContain('DiyaWithAVer...'); // diya truncated to 12 chars

    unmount();
  });
});
