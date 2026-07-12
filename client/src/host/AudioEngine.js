/* eslint-disable no-empty, no-unused-vars */
// AudioEngine.js - Procedural Sound Engine for Indian Monopoly
// Synthesizes soothing ambient music and pleasing sound effects using the Web Audio API.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.bgmVolume = null;
    this.sfxVolume = null;
    this.analyser = null;
    this.muted = true;
    
    this.bgmVolumeLevel = 0.25;
    this.sfxVolumeLevel = 0.4;
    
    // BGM states
    this.themeInterval = null;
    this.melodyInterval = null;
    this.currentBgmNodes = [];
    this.bgmPlaying = false;
    this.currentChordIndex = 0;
    
    // Chord progression: C Maj7 -> F Maj7 -> A Min7 -> G add9
    this.chords = [
      [130.81, 196.00, 246.94, 329.63], // C3, G3, B3, E4
      [87.31, 130.81, 164.81, 220.00, 261.63], // F2, C3, E3, A3, C4
      [110.00, 164.81, 196.00, 261.63], // A2, E3, G3, C4
      [98.00, 146.83, 196.00, 246.94, 440.00] // G2, D3, G3, B3, A4
    ];
    
    // Melody notes (C Pentatonic Scale)
    this.melodyScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // C4 to C6
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }
      
      this.ctx = new AudioContext();
      
      // Analyser node for the visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.connect(this.ctx.destination);
      
      // Master BGM Volume controls
      this.bgmVolume = this.ctx.createGain();
      this.bgmVolume.gain.setValueAtTime(0, this.ctx.currentTime); // start silent
      this.bgmVolume.connect(this.analyser);
      
      // Master SFX Volume controls
      this.sfxVolume = this.ctx.createGain();
      this.sfxVolume.gain.setValueAtTime(0, this.ctx.currentTime); // start silent
      this.sfxVolume.connect(this.analyser);
      
      // Setup a subtle stereo delay node for spacious sound effects
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.setValueAtTime(0.35, this.ctx.currentTime);
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.3, this.ctx.currentTime);
      
      // Loop feedback
      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      // Connect delay to output
      this.delayNode.connect(this.sfxVolume);

    } catch (e) {
      console.error('Failed to initialize AudioContext:', e);
    }
  }

  setMuted(muted) {
    try {
      this.muted = muted;
      this.init();
      if (!this.ctx) return;

      const applyMuteSettings = () => {
        const targetBgm = this.muted ? 0 : this.bgmVolumeLevel;
        const targetSfx = this.muted ? 0 : this.sfxVolumeLevel;
        
        if (this.bgmVolume) {
          this.bgmVolume.gain.value = targetBgm;
        }
        if (this.sfxVolume) {
          this.sfxVolume.gain.value = targetSfx;
        }

        if (!this.muted) {
          this.startBgm();
        } else {
          this.stopBgm();
        }
      };

      if (this.ctx.state === 'suspended') {
        this.ctx.resume()
          .then(applyMuteSettings)
          .catch(e => {
            console.error('Error resuming AudioContext:', e);
            applyMuteSettings();
          });
      } else {
        applyMuteSettings();
      }
    } catch (e) {
      console.error('Error toggling audio mute state:', e);
    }
  }

  async unlock() {
    this.init();
    if (!this.ctx) return false;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const unlocked = this.ctx.state === 'running';
      if (unlocked) this.setMuted(false);
      return unlocked;
    } catch (error) {
      console.warn('Audio unlock failed:', error);
      return false;
    }
  }

  isUnlocked() {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  setBgmVolume(level) {
    try {
      this.bgmVolumeLevel = Math.max(0, Math.min(1, level));
      if (this.bgmVolume && !this.muted) {
        this.bgmVolume.gain.value = this.bgmVolumeLevel;
      }
    } catch (e) {
      console.error('Error setting BGM volume:', e);
    }
  }

  setSfxVolume(level) {
    try {
      this.sfxVolumeLevel = Math.max(0, Math.min(1, level));
      if (this.sfxVolume && !this.muted) {
        this.sfxVolume.gain.value = this.sfxVolumeLevel;
      }
    } catch (e) {
      console.error('Error setting SFX volume:', e);
    }
  }

  // --- Background Music Theme ---
  startBgm() {
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    
    // Play first chord immediately
    this.playNextChord();
    
    // Schedule looping chords (every 6 seconds)
    this.themeInterval = setInterval(() => {
      this.playNextChord();
    }, 6000);
    
    // Schedule melody chimes (every 3 to 4.5 seconds randomly)
    this.melodyInterval = setInterval(() => {
      if (Math.random() > 0.3) {
        this.playMelodyChime();
      }
    }, 3200);
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.themeInterval) {
      clearInterval(this.themeInterval);
      this.themeInterval = null;
    }
    if (this.melodyInterval) {
      clearInterval(this.melodyInterval);
      this.melodyInterval = null;
    }
    
    // Fade out currently playing BGM nodes
    try {
      const now = this.ctx ? this.ctx.currentTime : 0;
      this.currentBgmNodes.forEach(node => {
        try {
          node.gainNode.gain.cancelScheduledValues(now);
          node.gainNode.gain.setTargetAtTime(0, now, 0.5);
          setTimeout(() => {
            try {
              node.oscNode.stop();
              node.oscNode.disconnect();
              node.gainNode.disconnect();
            } catch(err){}
          }, 2000);
        } catch(err){}
      });
      this.currentBgmNodes = [];
    } catch (e) {
      console.error('Error stopping BGM nodes:', e);
    }
  }

  playNextChord() {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const chord = this.chords[this.currentChordIndex];
      this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
      
      // Keep track of active oscillators to clean up later
      const newBgmNodes = [];
      const duration = 6.2; // slightly overlap next chord
      
      chord.forEach((freq, idx) => {
        // Create oscillator for notes
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Triangle wave for smooth, warm character
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        
        // Warm low-pass filter to remove harsh high frequencies
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320 + (idx * 40), now); // filter lower notes more heavily
        
        gain.gain.setValueAtTime(0, now);
        // Very slow attack to be soothing (1.8s)
        gain.gain.linearRampToValueAtTime(0.08 / chord.length, now + 1.8);
        // Hold
        gain.gain.setValueAtTime(0.08 / chord.length, now + duration - 2.0);
        // Very slow release (1.8s)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        // Connections
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmVolume);
        
        osc.start(now);
        
        newBgmNodes.push({ oscNode: osc, gainNode: gain });
      });
      
      // Clean up old nodes after fadeout
      const oldNodes = this.currentBgmNodes;
      this.currentBgmNodes = newBgmNodes;
      
      setTimeout(() => {
        oldNodes.forEach(node => {
          try {
            node.oscNode.stop();
            node.oscNode.disconnect();
            node.gainNode.disconnect();
          } catch(err){}
        });
      }, 2500);

    } catch (e) {
      console.warn('BGM chord play error:', e);
    }
  }

  playMelodyChime() {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      // Select random pentatonic note
      const freq = this.melodyScale[Math.floor(Math.random() * this.melodyScale.length)];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine'; // pure bell tone
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0, now);
      // Gentle attack
      gain.gain.linearRampToValueAtTime(0.02, now + 0.1);
      // Long tail
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
      
      // Add subtle vibrato (LFO)
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5, now); // 5Hz vibrato
      lfoGain.gain.setValueAtTime(2, now); // scale frequency slightly
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      osc.connect(gain);
      gain.connect(this.bgmVolume);
      
      lfo.start(now);
      osc.start(now);
      
      // Clean up
      setTimeout(() => {
        try {
          osc.stop();
          lfo.stop();
          osc.disconnect();
          lfo.disconnect();
          gain.disconnect();
        } catch(err){}
      }, 3500);
      
    } catch (e) {
      console.warn('Melody chime error:', e);
    }
  }

  // --- Sound Effects (SFX) Synthesizers ---
  
  playDiceRoll() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const duration = 0.8;
      
      // 1. Synthesize Rolling Noise (felt-like tumbling)
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      // Lowpass filter to sound muffled (felt rolling)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + duration);
      
      // Modulate volume rapidly to simulate individual rolls/tumbles
      const rollGain = this.ctx.createGain();
      rollGain.gain.setValueAtTime(0.01, now);
      for (let t = 0; t < duration - 0.1; t += 0.08) {
        rollGain.gain.linearRampToValueAtTime(0.18 + Math.random() * 0.1, now + t);
        rollGain.gain.linearRampToValueAtTime(0.02, now + t + 0.04);
      }
      rollGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      
      noise.connect(filter);
      filter.connect(rollGain);
      rollGain.connect(this.sfxVolume);
      
      noise.start(now);

      // 2. Synthesize High-pitched plastic dice clatter/rattle
      const clatterFilter = this.ctx.createBiquadFilter();
      clatterFilter.type = 'bandpass';
      clatterFilter.frequency.setValueAtTime(2200, now);
      clatterFilter.Q.setValueAtTime(5, now);
      
      const clatterGain = this.ctx.createGain();
      clatterGain.gain.setValueAtTime(0, now);
      for (let t = 0; t < duration - 0.15; t += 0.05) {
        clatterGain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, now + t);
        clatterGain.gain.linearRampToValueAtTime(0.005, now + t + 0.025);
      }
      clatterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      
      const clatterNoise = this.ctx.createBufferSource();
      clatterNoise.buffer = buffer;
      clatterNoise.connect(clatterFilter);
      clatterFilter.connect(clatterGain);
      clatterGain.connect(this.sfxVolume);
      clatterNoise.start(now);
      
      // 3. Play 2 distinct crisp impact clicks at the end of the roll
      setTimeout(() => this.playSoftTap(580, 0.15, 'sine'), 580);
      setTimeout(() => this.playSoftTap(520, 0.15, 'sine'), 700);
      
    } catch (e) {
      console.warn('Dice roll sound error:', e);
    }
  }
  
  playSoftTap(freq, duration = 0.1, type = 'triangle') {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(type === 'sine' ? freq * 1.5 : 150, now);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxVolume);
      
      osc.start(now);
      setTimeout(() => {
        try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
      }, duration * 1000);
    } catch(err){}
  }

  playTokenStep() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      // High-pitched woodblock-style step click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);
      
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      
      osc.connect(gain);
      gain.connect(this.sfxVolume);
      
      osc.start(now);
      setTimeout(() => {
        try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
      }, 60);
    } catch(e){}
  }

  playCardFlip() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const duration = 0.15;
      
      // Card friction flutter (friction swipe)
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + duration);
      filter.Q.setValueAtTime(3, now);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxVolume);
      noise.start(now);
      
      // Click at the end of flip
      setTimeout(() => {
        if (this.muted) return;
        this.playSoftTap(180, 0.08, 'sine');
      }, 70);
    } catch(e){}
  }

  playHouseSell() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Downward wooden block rattle (wood blocks selling)
      const tapFreqs = [240, 200, 160];
      tapFreqs.forEach((freq, idx) => {
        const timeOffset = idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.09, now + timeOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.06);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now + timeOffset);
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 0.15) * 1000);
      });
    } catch (e) {}
  }

  playPurchase() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Delightful, soothing upward pentatonic flourish (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        // Soft vibrato
        osc.frequency.linearRampToValueAtTime(freq + 4, now + timeOffset + 0.2);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.07, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 1.2);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        // Also connect to delay for spaciousness
        gain.connect(this.delayNode);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.5) * 1000);
      });
    } catch (e) {
      console.warn('Purchase sound error:', e);
    }
  }

  playRent() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Gentle, soft two-tone warning chimes (G5 -> E5)
      const notes = [783.99, 659.25];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.2;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.08, now + timeOffset + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.8);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.0) * 1000);
      });
    } catch (e) {
      console.warn('Rent sound error:', e);
    }
  }

  playJail() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Descending minor chord scale (A4 -> E4 -> C4 -> A3)
      const notes = [440.00, 329.63, 261.63, 220.00];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.18;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle'; // darker tone
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.1, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 1.4);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.8) * 1000);
      });
    } catch (e) {
      console.warn('Jail sound error:', e);
    }
  }

  playBankrupt() {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const notes = [392, 329.63, 261.63, 196];
    notes.forEach((frequency, index) => {
      const start = now + index * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, start);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.72, start + 0.45);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxVolume);
      osc.start(start);
      osc.stop(start + 0.8);
    });
  }

  playBuild() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // 1. Three rapid wooden block construction taps (120ms apart)
      const tapFreqs = [180, 220, 200];
      tapFreqs.forEach((freq, idx) => {
        const timeOffset = idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.5, now + timeOffset);
        filter.Q.setValueAtTime(5, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.08);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 0.2) * 1000);
      });
      
      // 2. Conclude with a bright sparkling success chime
      const chimeTime = 0.45;
      const oscChime = this.ctx.createOscillator();
      const gainChime = this.ctx.createGain();
      
      oscChime.type = 'sine';
      oscChime.frequency.setValueAtTime(880, now + chimeTime); // A5 chime
      
      gainChime.gain.setValueAtTime(0, now + chimeTime);
      gainChime.gain.linearRampToValueAtTime(0.08, now + chimeTime + 0.05);
      gainChime.gain.exponentialRampToValueAtTime(0.0001, now + chimeTime + 1.2);
      
      oscChime.connect(gainChime);
      gainChime.connect(this.sfxVolume);
      gainChime.connect(this.delayNode); // Echo!
      
      oscChime.start(now + chimeTime);
      
      setTimeout(() => {
        try { oscChime.stop(); oscChime.disconnect(); gainChime.disconnect(); } catch(err){}
      }, (chimeTime + 1.5) * 1000);
      
    } catch (e) {
      console.warn('Build sound error:', e);
    }
  }

  playCardDraw() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // 1. Soft card swipe sound (filtered noise)
      const duration = 0.25;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + duration);
      
      const swipeGain = this.ctx.createGain();
      swipeGain.gain.setValueAtTime(0, now);
      swipeGain.gain.linearRampToValueAtTime(0.08, now + 0.08);
      swipeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      
      noise.connect(filter);
      filter.connect(swipeGain);
      swipeGain.connect(this.sfxVolume);
      
      noise.start(now);
      
      // 2. Play a gentle magic chord chime (D5 -> G5 -> C6)
      const notes = [587.33, 783.99, 1046.50];
      const startOffset = 0.15;
      
      notes.forEach((freq, idx) => {
        const timeOffset = startOffset + (idx * 0.1);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.06, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 1.0);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.2) * 1000);
      });
      
    } catch (e) {
      console.warn('Card draw sound error:', e);
    }
  }

  playAuctionStart() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Beautiful, warm triple bell announcement chime (C5 -> E5 -> G5 -> E5 -> C5)
      const notes = [523.25, 659.25, 783.99, 659.25, 523.25];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.14;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.08, now + timeOffset + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.7);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        gain.connect(this.delayNode);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.2) * 1000);
      });
    } catch (e) {
      console.warn('Auction start sound error:', e);
    }
  }

  playAuctionBid() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Light, playful bubble popping/bid sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.08); // downward frequency sweep
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      
      osc.connect(gain);
      gain.connect(this.sfxVolume);
      
      osc.start(now);
      
      setTimeout(() => {
        try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
      }, 100);
    } catch (e) {
      console.warn('Auction bid sound error:', e);
    }
  }

  playAuctionEnd() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Pleasing victory arpeggio: C5 -> G5 -> C6
      const notes = [523.25, 783.99, 1046.50];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.1;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.09, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 1.2);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        gain.connect(this.delayNode);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.5) * 1000);
      });
    } catch (e) {
      console.warn('Auction end sound error:', e);
    }
  }

  playTradeProposed() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Warm F-to-C interval chime (F5 -> C6)
      const notes = [698.46, 1046.50];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.15;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.08, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.9);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.2) * 1000);
      });
    } catch (e) {
      console.warn('Trade proposed sound error:', e);
    }
  }

  playTradeAccepted() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Happy, bright sparkling major chord roll (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.07, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 1.5);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        gain.connect(this.delayNode);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.8) * 1000);
      });
    } catch (e) {
      console.warn('Trade accepted sound error:', e);
    }
  }

  playTradeDeclined() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      
      // Gentle, warm descending tone (D4 -> C4)
      const notes = [293.66, 261.63];
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.18;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.09, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.6);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now + timeOffset);
        
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 1.0) * 1000);
      });
    } catch (e) {
      console.warn('Trade declined sound error:', e);
    }
  }

  playCoinClink() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      // High-pitched crystal-clear coin clinks: two rapid high frequencies (e.g. 1600Hz -> 1900Hz)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      const gain2 = this.ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1600, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1900, now + 0.05);
      gain2.gain.setValueAtTime(0.08, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      
      osc1.connect(gain1);
      gain1.connect(this.sfxVolume);
      
      osc2.connect(gain2);
      gain2.connect(this.sfxVolume);
      
      osc1.start(now);
      osc2.start(now + 0.05);
      
      setTimeout(() => {
        try {
          osc1.stop(); osc2.stop();
          osc1.disconnect(); osc2.disconnect();
          gain1.disconnect(); gain2.disconnect();
        } catch(err){}
      }, 300);
    } catch(e){}
  }

  playGameOver() {
    this.init();
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      // Celebratory upward fanfare chord: C4, G4, C5, E5, G5, C6
      const notes = [261.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.15;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.1, now + timeOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 2.0);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        gain.connect(this.delayNode);
        
        osc.start(now + timeOffset);
        setTimeout(() => {
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(err){}
        }, (timeOffset + 2.5) * 1000);
      });
    } catch (e) {
      console.warn('Game over sound error:', e);
    }
  }
}

// Export a single instance to share across components
const soundEngine = new SoundEngine();
export default soundEngine;
