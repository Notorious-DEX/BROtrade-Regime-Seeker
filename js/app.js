/**
 * BROtrade Regime Seeker - Main Application
 * Live crypto charts with regime-based coloring
 */

// Theme colors
const THEME = {
    bg: '#0f0a1e',
    secondaryBg: '#1a0f2e',
    bull: '#10b981',
    bullDark: '#059669',
    bear: '#ef4444',
    bearDark: '#b91c1c',
    caution: '#d4c5a9',
    ema: '#8b5cf6',
    purpleLight: '#e0d4f7',
    purpleMid: '#8b7bb8',
    border: '#2d2d2d'
};

// Exchange API configurations
const EXCHANGES = {
    'binance.us': {
        name: 'Binance.US',
        url: 'https://api.binance.us/api/v3/klines',
        format: 'binance'
    },
    'binance.com': {
        name: 'Binance.com',
        url: 'https://api.binance.com/api/v3/klines',
        format: 'binance'
    },
    'kraken': {
        name: 'Kraken',
        url: 'https://api.kraken.com/0/public/OHLC',
        format: 'kraken'
    }
};

// Crypto tokens info
const CRYPTO_NAMES = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'BNB': 'Binance Coin',
    'SOL': 'Solana',
    'XRP': 'Ripple',
    'ADA': 'Cardano',
    'DOGE': 'Dogecoin',
    'AVAX': 'Avalanche',
    'MATIC': 'Polygon',
    'DOT': 'Polkadot'
};

// Timeframe display names
const TIMEFRAME_NAMES = {
    '1m': '1 min',
    '5m': '5 min',
    '15m': '15 min',
    '30m': '30 min',
    '1h': '1 hour',
    '4h': '4 hour',
    '1d': '1 day',
    '1w': '1 week',
    '1M': '1 month'
};

/**
 * Main Application Class
 */
class RegimeSeekerApp {
    constructor() {
        // Settings
        this.currentCrypto = 'BTC';
        this.currentTimeframe = '1h';
        this.currentExchange = 'binance.us';
        this.utcOffset = -6; // Default UTC-6
        this.updateInterval = 15; // seconds
        this.soundEnabled = true;
        this.regimeColorsEnabled = true;

        // State
        this.previousRegime = null;
        this.updateTimer = null;
        this.chart = null;
        this.candlestickSeries = null;
        this.emaSeries = null;
        this.backgroundSeries = []; // For regime background colors (array of area series)
        this.data = [];

        // Indicator and sound
        this.indicator = new FilteredSignalsIndicator();
        this.soundGenerator = new SoundGenerator();

        // Initialize
        this.initUI();
        this.fetchData();
        this.startAutoUpdate();
    }

    /**
     * Initialize UI controls and event listeners
     */
    initUI() {
        // Exchange selector
        document.getElementById('exchange').addEventListener('change', (e) => {
            this.currentExchange = e.target.value;
            this.fetchData();
        });

        // Crypto selector
        document.getElementById('crypto').addEventListener('change', (e) => {
            this.currentCrypto = e.target.value;
            this.fetchData();
        });

        // Timeframe selector
        document.getElementById('timeframe').addEventListener('change', (e) => {
            this.currentTimeframe = e.target.value;
            this.fetchData();
        });

        // UTC offset selector
        document.getElementById('utc-offset').addEventListener('change', (e) => {
            this.utcOffset = parseInt(e.target.value);
            this.updateChart();
        });

        // Update interval selector
        document.getElementById('update-interval').addEventListener('change', (e) => {
            this.updateInterval = parseInt(e.target.value);
            this.startAutoUpdate(); // Restart with new interval
        });

        // Sound toggle
        document.getElementById('sound-toggle').addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
            this.soundGenerator.setEnabled(this.soundEnabled);
        });

        // Regime colors toggle
        document.getElementById('colors-toggle').addEventListener('change', (e) => {
            this.regimeColorsEnabled = e.target.checked;
            this.updateChart();
        });

        // Reset view button
        document.getElementById('reset-view').addEventListener('click', () => {
            this.resetView();
        });
    }

    /**
     * Fetch data from selected exchange
     */
    async fetchData() {
        try {
            this.updateStatus('Fetching data...', 'loading');

            const exchange = EXCHANGES[this.currentExchange];
            let data;

            if (exchange.format === 'binance') {
                data = await this.fetchBinanceData(exchange.url);
            } else if (exchange.format === 'kraken') {
                data = await this.fetchKrakenData(exchange.url);
            }

            if (!data || data.length === 0) {
                throw new Error('No data received');
            }

            // Calculate indicators and regime states
            this.data = this.indicator.calculateSignals(data);

            // Check for regime change and play sound
            const currentRegime = this.indicator.currentState;
            if (this.previousRegime !== null && currentRegime !== this.previousRegime) {
                if (this.soundEnabled) {
                    this.soundGenerator.playSound(currentRegime);
                }
            }
            this.previousRegime = currentRegime;

            // Update chart
            this.updateChart();

            // Update status
            const lastUpdate = new Date().toLocaleTimeString();
            this.updateStatus(
                `Last update: ${lastUpdate} | State: ${currentRegime}`,
                currentRegime
            );

        } catch (error) {
            console.error('Fetch error:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Fetch data from Binance API
     * @param {string} url - API URL
     * @returns {Array} - OHLC data
     */
    async fetchBinanceData(url) {
        const params = new URLSearchParams({
            symbol: `${this.currentCrypto}USDT`,
            interval: this.currentTimeframe,
            limit: 200
        });

        const response = await fetch(`${url}?${params}`);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Increase update interval.');
            } else if (response.status === 451) {
                throw new Error(`${EXCHANGES[this.currentExchange].name} not available in your region.`);
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const jsonData = await response.json();

        // Convert Binance format to OHLC
        return jsonData.map(candle => ({
            time: candle[0] / 1000, // Convert to seconds
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    }

    /**
     * Fetch data from Kraken API
     * @param {string} url - API URL
     * @returns {Array} - OHLC data
     */
    async fetchKrakenData(url) {
        // Kraken interval mapping (in minutes)
        const intervalMap = {
            '1m': 1, '5m': 5, '15m': 15, '30m': 30,
            '1h': 60, '4h': 240, '1d': 1440, '1w': 10080, '1M': 43200
        };

        const params = new URLSearchParams({
            pair: `${this.currentCrypto}USD`,
            interval: intervalMap[this.currentTimeframe] || 60
        });

        const response = await fetch(`${url}?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const jsonData = await response.json();

        if (jsonData.error && jsonData.error.length > 0) {
            throw new Error(`Kraken API error: ${jsonData.error.join(', ')}`);
        }

        // Get first pair key from result
        const pairKey = Object.keys(jsonData.result)[0];
        const ohlcData = jsonData.result[pairKey];

        // Convert Kraken format to OHLC
        return ohlcData.map(candle => ({
            time: candle[0], // Already in seconds
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[6])
        }));
    }

    /**
     * Update chart with current data
     */
    updateChart() {
        if (!this.data || this.data.length === 0) {
            return;
        }

        // Create chart if it doesn't exist
        if (!this.chart) {
            this.createChart();
        }

        // Prepare candlestick data with regime colors
        const candleData = this.data.map(candle => {
            const color = this.regimeColorsEnabled
                ? FilteredSignalsIndicator.getRegimeColor(candle.state)
                : (candle.close >= candle.open ? THEME.bull : THEME.bear);

            return {
                time: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                color: color,
                borderColor: color,
                wickColor: color
            };
        });

        // Prepare EMA data
        const emaData = this.data
            .filter(candle => candle.ema !== null)
            .map(candle => ({
                time: candle.time,
                value: candle.ema
            }));

        // Update series
        this.candlestickSeries.setData(candleData);
        this.emaSeries.setData(emaData);

        // Update background colors (regime zones)
        if (this.regimeColorsEnabled) {
            this.updateRegimeBackgrounds();
        } else if (this.backgroundSeries && Array.isArray(this.backgroundSeries)) {
            // Clear backgrounds when toggle is off
            for (const series of this.backgroundSeries) {
                this.chart.removeSeries(series);
            }
            this.backgroundSeries = [];
        }

        // Update chart title
        this.updateChartTitle();
    }

    /**
     * Create chart and series
     */
    createChart() {
        const chartContainer = document.getElementById('chart');

        this.chart = LightweightCharts.createChart(chartContainer, {
            layout: {
                background: { color: THEME.secondaryBg },
                textColor: THEME.purpleLight,
            },
            grid: {
                vertLines: { color: THEME.border },
                horzLines: { color: THEME.border },
            },
            rightPriceScale: {
                borderColor: THEME.border,
            },
            timeScale: {
                borderColor: THEME.border,
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
        });

        // Create background area series (rendered first, so it's behind everything)
        // We'll use multiple area series, one for each regime zone
        this.backgroundSeries = [];

        // Create candlestick series
        this.candlestickSeries = this.chart.addCandlestickSeries({
            upColor: THEME.bull,
            downColor: THEME.bear,
            borderUpColor: THEME.bull,
            borderDownColor: THEME.bear,
            wickUpColor: THEME.bull,
            wickDownColor: THEME.bear,
        });

        // Create EMA line series
        this.emaSeries = this.chart.addLineSeries({
            color: THEME.ema,
            lineWidth: 2,
            title: 'EMA (50)',
        });

        // Auto-resize chart
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== chartContainer) {
                return;
            }
            const newRect = entries[0].contentRect;
            this.chart.applyOptions({ width: newRect.width, height: newRect.height });
        });

        resizeObserver.observe(chartContainer);
    }

    /**
     * Update regime background colors
     */
    updateRegimeBackgrounds() {
        if (!this.data || this.data.length === 0) {
            return;
        }

        // Clear existing background series
        if (this.backgroundSeries && Array.isArray(this.backgroundSeries)) {
            for (const series of this.backgroundSeries) {
                this.chart.removeSeries(series);
            }
            this.backgroundSeries = [];
        }

        // Calculate price range for the background
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        for (const candle of this.data) {
            if (candle.low < minPrice) minPrice = candle.low;
            if (candle.high > maxPrice) maxPrice = candle.high;
        }

        // Add padding to span full chart height
        const priceRange = maxPrice - minPrice;
        const fullHeight = maxPrice + priceRange * 0.5; // High value for top of chart

        // Get regime color with transparency
        const getRegimeColorWithAlpha = (state) => {
            const baseColor = FilteredSignalsIndicator.getRegimeColor(state);
            // Convert hex to rgba with 20% opacity
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, 0.2)`;
        };

        // Group consecutive candles by regime to create zones
        const regimeZones = [];
        let currentState = null;
        let zoneStart = 0;

        for (let i = 0; i < this.data.length; i++) {
            const candle = this.data[i];

            if (candle.state !== currentState) {
                // Save previous zone
                if (currentState !== null) {
                    regimeZones.push({
                        state: currentState,
                        startIdx: zoneStart,
                        endIdx: i - 1
                    });
                }

                // Start new zone
                currentState = candle.state;
                zoneStart = i;
            }
        }

        // Add final zone
        if (currentState !== null) {
            regimeZones.push({
                state: currentState,
                startIdx: zoneStart,
                endIdx: this.data.length - 1
            });
        }

        // Create an area series for each regime zone
        for (const zone of regimeZones) {
            const color = getRegimeColorWithAlpha(zone.state);

            // Create area series with no line, just fill
            const areaSeries = this.chart.addAreaSeries({
                lineColor: 'transparent',
                topColor: color,
                bottomColor: color,
                lineWidth: 0,
                priceScaleId: '', // Don't show on price scale
                lastValueVisible: false,
                priceLineVisible: false,
            });

            // Create data for this zone - spanning full height
            const zoneData = [];
            for (let i = zone.startIdx; i <= zone.endIdx; i++) {
                zoneData.push({
                    time: this.data[i].time,
                    value: fullHeight
                });
            }

            areaSeries.setData(zoneData);
            this.backgroundSeries.push(areaSeries);
        }

        // IMPORTANT: To ensure backgrounds are behind candlesticks,
        // we need to recreate the candlestick and EMA series
        // (series are rendered in order of creation)
        if (this.candlestickSeries && this.emaSeries) {
            // Save the current data
            const candleData = this.data.map(candle => {
                const color = FilteredSignalsIndicator.getRegimeColor(candle.state);
                return {
                    time: candle.time,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    color: color,
                    borderColor: color,
                    wickColor: color
                };
            });

            const emaData = this.data
                .filter(candle => candle.ema !== null)
                .map(candle => ({
                    time: candle.time,
                    value: candle.ema
                }));

            // Remove old series
            this.chart.removeSeries(this.candlestickSeries);
            this.chart.removeSeries(this.emaSeries);

            // Recreate candlestick series (now on top of backgrounds)
            this.candlestickSeries = this.chart.addCandlestickSeries({
                upColor: THEME.bull,
                downColor: THEME.bear,
                borderUpColor: THEME.bull,
                borderDownColor: THEME.bear,
                wickUpColor: THEME.bull,
                wickDownColor: THEME.bear,
            });

            // Recreate EMA series
            this.emaSeries = this.chart.addLineSeries({
                color: THEME.ema,
                lineWidth: 2,
                title: 'EMA (50)',
            });

            // Restore the data
            this.candlestickSeries.setData(candleData);
            this.emaSeries.setData(emaData);
        }
    }

    /**
     * Update chart title with current info
     */
    updateChartTitle() {
        const titleElement = document.getElementById('chart-title');
        const cryptoName = CRYPTO_NAMES[this.currentCrypto];
        const timeframeName = TIMEFRAME_NAMES[this.currentTimeframe];
        const currentState = this.indicator.currentState;

        titleElement.textContent = `${cryptoName} (${this.currentCrypto}/USDT) | ${timeframeName} | State: ${currentState}`;

        // Update title color based on regime
        titleElement.className = `chart-title ${currentState}`;
    }

    /**
     * Update status message
     * @param {string} message - Status message
     * @param {string} cssClass - CSS class for styling
     */
    updateStatus(message, cssClass = '') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${cssClass}`;
    }

    /**
     * Reset chart view to show all data
     */
    resetView() {
        if (this.chart) {
            this.chart.timeScale().fitContent();
        }
    }

    /**
     * Start auto-update timer
     */
    startAutoUpdate() {
        // Clear existing timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        // Start new timer
        this.updateTimer = setInterval(() => {
            this.fetchData();
        }, this.updateInterval * 1000);
    }

    /**
     * Stop auto-update timer
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('BROtrade Regime Seeker v0.10');
    console.log('Initializing...');

    try {
        window.app = new RegimeSeekerApp();
        console.log('Application started successfully');
    } catch (error) {
        console.error('Failed to start application:', error);
        document.getElementById('status').textContent = `Error: ${error.message}`;
        document.getElementById('status').className = 'status error';
    }
});

// Handle page visibility changes (pause updates when hidden)
document.addEventListener('visibilitychange', () => {
    if (window.app) {
        if (document.hidden) {
            console.log('Page hidden, pausing updates');
            window.app.stopAutoUpdate();
        } else {
            console.log('Page visible, resuming updates');
            window.app.startAutoUpdate();
            window.app.fetchData(); // Fetch immediately
        }
    }
});
