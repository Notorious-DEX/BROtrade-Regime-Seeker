/**
 * BROtrade Regime Seeker - Technical Indicators
 * Implements ADX, EMA, and regime detection logic
 */

class FilteredSignalsIndicator {
    constructor(config = {}) {
        this.adxLength = config.adxLength || 14;
        this.adxThreshold = config.adxThreshold || 25;
        this.emaLength = config.emaLength || 50;
        this.confirmationBars = config.confirmationBars || 3;
        this.adxDeclinePct = config.adxDeclinePct || 15.0;
        this.diConvergence = config.diConvergence || 5.0;

        this.currentState = "RANGING";
    }

    /**
     * Calculate EMA (Exponential Moving Average)
     * @param {Array} values - Array of values
     * @param {number} period - EMA period
     * @returns {Array} - EMA values
     */
    calculateEMA(values, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);

        // Calculate initial SMA for first EMA value
        let sum = 0;
        for (let i = 0; i < period && i < values.length; i++) {
            sum += values[i];
        }

        if (values.length < period) {
            return new Array(values.length).fill(null);
        }

        let previousEMA = sum / period;

        // Fill nulls for initial period
        for (let i = 0; i < period - 1; i++) {
            ema.push(null);
        }

        ema.push(previousEMA);

        // Calculate EMA
        for (let i = period; i < values.length; i++) {
            const currentEMA = (values[i] - previousEMA) * multiplier + previousEMA;
            ema.push(currentEMA);
            previousEMA = currentEMA;
        }

        return ema;
    }

    /**
     * Calculate Wilder's smoothing (RMA - used by Pine Script's ta.rma)
     * This is equivalent to EMA with alpha = 1/period
     * @param {Array} values - Array of values
     * @param {number} period - Smoothing period
     * @returns {Array} - Smoothed values
     */
    calculateRMA(values, period) {
        const rma = [];
        const alpha = 1.0 / period;

        if (values.length === 0) {
            return [];
        }

        // First value
        rma.push(values[0]);

        // Apply exponential smoothing with alpha = 1/period
        for (let i = 1; i < values.length; i++) {
            const smoothed = alpha * values[i] + (1 - alpha) * rma[i - 1];
            rma.push(smoothed);
        }

        return rma;
    }

    /**
     * Calculate ADX and directional indicators
     * Uses Wilder's smoothing (RMA) to match Pine Script implementation
     * @param {Array} candles - Array of OHLC candles
     * @returns {Object} - {diPlus, diMinus, adx}
     */
    calculateADX(candles) {
        const length = candles.length;

        // Calculate True Range and Directional Movement
        const tr = [];
        const plusDM = [];
        const minusDM = [];

        for (let i = 0; i < length; i++) {
            if (i === 0) {
                tr.push(candles[i].high - candles[i].low);
                plusDM.push(0);
                minusDM.push(0);
            } else {
                const high = candles[i].high;
                const low = candles[i].low;
                const prevClose = candles[i - 1].close;
                const prevHigh = candles[i - 1].high;
                const prevLow = candles[i - 1].low;

                // True Range
                const tr1 = high - low;
                const tr2 = Math.abs(high - prevClose);
                const tr3 = Math.abs(low - prevClose);
                tr.push(Math.max(tr1, tr2, tr3));

                // Directional Movement
                const upMove = high - prevHigh;
                const downMove = prevLow - low;

                const pdm = (upMove > downMove && upMove > 0) ? upMove : 0;
                const mdm = (downMove > upMove && downMove > 0) ? downMove : 0;

                plusDM.push(pdm);
                minusDM.push(mdm);
            }
        }

        // Wilder's smoothing (RMA) for TR and DM
        const trSmooth = this.calculateRMA(tr, this.adxLength);
        const plusDMSmooth = this.calculateRMA(plusDM, this.adxLength);
        const minusDMSmooth = this.calculateRMA(minusDM, this.adxLength);

        // Calculate directional indicators
        const diPlus = [];
        const diMinus = [];
        const dx = [];

        for (let i = 0; i < length; i++) {
            if (trSmooth[i] === 0) {
                diPlus.push(0);
                diMinus.push(0);
                dx.push(0);
            } else {
                const dip = 100 * (plusDMSmooth[i] / trSmooth[i]);
                const dim = 100 * (minusDMSmooth[i] / trSmooth[i]);

                diPlus.push(dip);
                diMinus.push(dim);

                // DX calculation
                const sum = dip + dim;
                if (sum === 0) {
                    dx.push(0);
                } else {
                    dx.push(100 * Math.abs(dip - dim) / sum);
                }
            }
        }

        // ADX is Wilder's smoothing of DX
        const adx = this.calculateRMA(dx, this.adxLength);

        return { diPlus, diMinus, adx };
    }

    /**
     * Calculate regime states for all candles
     * @param {Array} candles - Array of OHLC candles with timestamps
     * @returns {Array} - Array of candles with added indicators and states
     */
    calculateSignals(candles) {
        if (!candles || candles.length === 0) {
            return [];
        }

        // Extract close prices
        const closePrices = candles.map(c => c.close);

        // Calculate EMA
        const ema = this.calculateEMA(closePrices, this.emaLength);

        // Calculate ADX and directional indicators
        const { diPlus, diMinus, adx } = this.calculateADX(candles);

        // Add indicators to candles and determine regime
        const result = candles.map((candle, i) => {
            const close = candle.close;
            const emaVal = ema[i] !== null ? ema[i] : null;
            const adxVal = adx[i] || 0;
            const diPlusVal = diPlus[i] || 0;
            const diMinusVal = diMinus[i] || 0;

            // Determine regime (exact Pine Script logic)
            const isStrongTrend = adxVal > this.adxThreshold;
            const isPriceAboveEma = emaVal !== null && close > emaVal;
            const isPriceBelowEma = emaVal !== null && close < emaVal;
            const isUptrend = diPlusVal > diMinusVal && isPriceAboveEma;
            const isDowntrend = diMinusVal > diPlusVal && isPriceBelowEma;

            let state;
            if (isStrongTrend && isUptrend) {
                state = "STRONG_UPTREND";
            } else if (isUptrend && !isStrongTrend) {
                state = "WEAK_UPTREND";
            } else if (isStrongTrend && isDowntrend) {
                state = "STRONG_DOWNTREND";
            } else if (isDowntrend && !isStrongTrend) {
                state = "WEAK_DOWNTREND";
            } else {
                state = "RANGING";
            }

            return {
                ...candle,
                ema: emaVal,
                diPlus: diPlusVal,
                diMinus: diMinusVal,
                adx: adxVal,
                state: state
            };
        });

        // Update current state
        if (result.length > 0) {
            this.currentState = result[result.length - 1].state;
        }

        return result;
    }

    /**
     * Get color for a regime state
     * @param {string} state - Regime state
     * @returns {string} - Hex color
     */
    static getRegimeColor(state) {
        const colors = {
            'STRONG_UPTREND': '#22c55e',
            'WEAK_UPTREND': '#065f46',
            'RANGING': '#d4c5a9',
            'WEAK_DOWNTREND': '#7f1d1d',
            'STRONG_DOWNTREND': '#f87171'
        };
        return colors[state] || colors['RANGING'];
    }
}

/**
 * Sound Generator for regime alerts
 */
class SoundGenerator {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
    }

    /**
     * Initialize Web Audio API context
     */
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    /**
     * Generate a tone at specified frequency
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {number} startTime - Start time
     * @returns {OscillatorNode} - Oscillator node
     */
    generateTone(frequency, duration, startTime) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        // Envelope to avoid clicks
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);

        return oscillator;
    }

    /**
     * Play sound for specific regime
     * @param {string} regime - Regime state
     */
    playSound(regime) {
        if (!this.enabled) return;

        try {
            this.initAudio();

            const now = this.audioContext.currentTime;

            // Define unique sounds for each regime
            switch (regime) {
                case "STRONG_UPTREND":
                    // High positive chord (C major: C-E-G)
                    this.generateTone(523, 0.4, now);
                    this.generateTone(659, 0.4, now);
                    this.generateTone(784, 0.4, now);
                    break;

                case "WEAK_UPTREND":
                    // Moderate positive (C-E)
                    this.generateTone(523, 0.3, now);
                    this.generateTone(659, 0.3, now);
                    break;

                case "RANGING":
                    // Neutral single tone
                    this.generateTone(440, 0.2, now);
                    break;

                case "WEAK_DOWNTREND":
                    // Warning (lower pitch)
                    this.generateTone(330, 0.3, now);
                    this.generateTone(392, 0.3, now);
                    break;

                case "STRONG_DOWNTREND":
                    // Urgent warning (low chord)
                    this.generateTone(262, 0.4, now);
                    this.generateTone(311, 0.4, now);
                    this.generateTone(349, 0.4, now);
                    break;
            }
        } catch (error) {
            console.error('Sound playback error:', error);
        }
    }

    /**
     * Enable/disable sound
     * @param {boolean} enabled - Whether sound is enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}