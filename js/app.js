/**
 * BROtrade Regime Seeker - Main Application
 * Live crypto charts with regime-based coloring
 */

// Theme colors
const THEME = {
    bg: '#0f0a1e',
    secondaryBg: '#1a0f2e',
    bull: '#22c55e',
    bullDark: '#065f46',
    bear: '#f87171',
    bearDark: '#7f1d1d',
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

// Crypto tokens info - Top 50 (non-stablecoin, non-wrapped)
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
    'DOT': 'Polkadot',
    'TRX': 'Tron',
    'LINK': 'Chainlink',
    'TON': 'Toncoin',
    'SHIB': 'Shiba Inu',
    'UNI': 'Uniswap',
    'LTC': 'Litecoin',
    'ATOM': 'Cosmos',
    'XLM': 'Stellar',
    'XMR': 'Monero',
    'BCH': 'Bitcoin Cash',
    'NEAR': 'NEAR Protocol',
    'APT': 'Aptos',
    'ARB': 'Arbitrum',
    'OP': 'Optimism',
    'FIL': 'Filecoin',
    'VET': 'VeChain',
    'ALGO': 'Algorand',
    'HBAR': 'Hedera',
    'ETC': 'Ethereum Classic',
    'INJ': 'Injective',
    'RUNE': 'THORChain',
    'SAND': 'The Sandbox',
    'MANA': 'Decentraland',
    'AXS': 'Axie Infinity',
    'GALA': 'Gala',
    'FTM': 'Fantom',
    'AAVE': 'Aave',
    'GRT': 'The Graph',
    'IMX': 'Immutable X',
    'MKR': 'Maker',
    'SNX': 'Synthetix',
    'LDO': 'Lido DAO',
    'EGLD': 'MultiversX',
    'EOS': 'EOS',
    'XTZ': 'Tezos',
    'THETA': 'Theta Network',
    'CRV': 'Curve DAO',
    'ZEC': 'Zcash',
    'DASH': 'Dash',
    'KAVA': 'Kava'
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
        this.volumeProfileEnabled = true;

        // Advanced Filters
        this.volumeFilterEnabled = false;
        this.volumeMultiplier = 2.0;

        // State
        this.previousRegime = null;
        this.updateTimer = null;
        this.chart = null;
        this.candlestickSeries = null;
        this.emaSeries = null;
        this.volumeProfileSeries = null;
        this.data = [];
        this.isInitialLoad = true; // Track if this is the first data load

        // Indicator and sound
        this.indicator = new FilteredSignalsIndicator();
        this.soundGenerator = new SoundGenerator();

        // Volume Profile
        this.volumeProfile = new VolumeProfile({ valueAreaPercent: 68, numBins: 100 });

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
            this.isInitialLoad = true; // Force fitContent when exchange changes
            this.fetchData();
        });

        // Crypto selector
        document.getElementById('crypto').addEventListener('change', (e) => {
            this.currentCrypto = e.target.value;
            this.isInitialLoad = true; // Force fitContent when crypto changes
            this.fetchData();
        });

        // Timeframe selector
        document.getElementById('timeframe').addEventListener('change', (e) => {
            this.currentTimeframe = e.target.value;
            this.isInitialLoad = true; // Force fitContent when timeframe changes
            this.fetchData();
        });

        // UTC offset selector
        document.getElementById('utc-offset').addEventListener('change', (e) => {
            this.utcOffset = parseInt(e.target.value);
            this.isInitialLoad = true; // Force fitContent when UTC offset changes
            this.updateChart();
        });

        // Update interval selector
        document.getElementById('update-interval').addEventListener('change', (e) => {
            this.updateInterval = parseInt(e.target.value);
            this.startAutoUpdate(); // Restart with new interval
        });

        // NOTE: Sound, Regime Colors, Volume Filter controls removed
        // These settings are now managed through the Settings panel (features.js)

        // Reset view button
        document.getElementById('reset-view').addEventListener('click', () => {
            this.resetView();
        });

        // Crypto addresses dropdown
        this.initAddressesDropdown();
    }

    /**
     * Update indicator configuration with current settings
     */
    updateIndicatorConfig() {
        this.indicator = new FilteredSignalsIndicator({
            volumeFilterEnabled: this.volumeFilterEnabled,
            volumeMultiplier: this.volumeMultiplier
        });
    }

    /**
     * Initialize crypto addresses dropdown
     */
    initAddressesDropdown() {
        const addressesBtn = document.getElementById('addresses-btn');
        const addressesDropdown = document.getElementById('addresses-dropdown');
        const copyButtons = document.querySelectorAll('.copy-btn');

        // Toggle dropdown
        addressesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addressesDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!addressesDropdown.contains(e.target) && e.target !== addressesBtn) {
                addressesDropdown.classList.remove('show');
            }
        });

        // Copy address to clipboard
        copyButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const address = btn.getAttribute('data-address');

                try {
                    await navigator.clipboard.writeText(address);

                    // Visual feedback
                    btn.classList.add('copied');
                    const originalTitle = btn.getAttribute('title');
                    btn.setAttribute('title', 'Copied!');

                    setTimeout(() => {
                        btn.classList.remove('copied');
                        btn.setAttribute('title', originalTitle);
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                    alert('Failed to copy address. Please copy manually.');
                }
            });
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

            // Update indicator config
            this.updateIndicatorConfig();

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
     * Create volume profile overlay
     */
    createVolumeProfileOverlay() {
        const chartContainer = document.getElementById('chart');

        // Create overlay container
        const overlay = document.createElement('div');
        overlay.id = 'volume-profile-overlay';
        overlay.style.position = 'absolute';
        overlay.style.right = '60px'; // Position just left of price axis
        overlay.style.top = '0';
        overlay.style.bottom = '30px'; // Account for time axis
        overlay.style.width = '120px';
        overlay.style.pointerEvents = 'none'; // Allow chart interactions
        overlay.style.zIndex = '1';

        chartContainer.appendChild(overlay);
        this.volumeProfileOverlay = overlay;
    }

    /**
     * Update volume profile display
     */
    updateVolumeProfile() {
        if (!this.data || this.data.length === 0 || !this.volumeProfileOverlay) {
            return;
        }

        // Clear profile if disabled
        if (!this.volumeProfileEnabled) {
            this.volumeProfileOverlay.innerHTML = '';
            return;
        }

        // Calculate volume profile
        const profile = this.volumeProfile.calculate(this.data);

        if (!profile) {
            return;
        }

        // Get chart dimensions
        const chartHeight = this.volumeProfileOverlay.clientHeight;
        const chartWidth = this.volumeProfileOverlay.clientWidth;

        // Clear existing profile
        this.volumeProfileOverlay.innerHTML = '';

        // Get price range from data
        const priceMin = profile.priceRange.min;
        const priceMax = profile.priceRange.max;
        const priceRange = priceMax - priceMin;

        if (priceRange === 0) return;

        // Create SVG for volume profile
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.overflow = 'visible';

        // Draw histogram bars
        for (const bar of profile.histogramData) {
            // Convert price to pixel Y coordinate (inverted because Y increases downward)
            const priceNormalized = (bar.price - priceMin) / priceRange;
            const y = chartHeight - (priceNormalized * chartHeight); // Invert Y axis

            // Calculate bar height based on number of bins
            const barHeight = Math.max(chartHeight / profile.histogramData.length, 2);

            // Calculate bar width based on volume
            const barWidth = bar.normalizedVolume * chartWidth * 0.9; // 90% max width

            // Create rectangle
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', '0');
            rect.setAttribute('y', y - barHeight / 2);
            rect.setAttribute('width', barWidth);
            rect.setAttribute('height', barHeight);
            rect.setAttribute('fill', bar.color);
            rect.setAttribute('opacity', bar.isValueArea ? '0.7' : '0.4');

            // Add glow effect for POC
            if (bar.isPOC) {
                rect.setAttribute('stroke', '#ffffff');
                rect.setAttribute('stroke-width', '1');
                rect.setAttribute('opacity', '0.9');
            }

            svg.appendChild(rect);
        }

        this.volumeProfileOverlay.appendChild(svg);
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

        // Calculate UTC offset in seconds
        const offsetSeconds = this.utcOffset * 3600;

        // Prepare candlestick data with regime colors and adjusted timestamps
        const candleData = this.data.map(candle => {
            const color = this.regimeColorsEnabled
                ? FilteredSignalsIndicator.getRegimeColor(candle.state)
                : (candle.close >= candle.open ? THEME.bull : THEME.bear);

            return {
                time: candle.time + offsetSeconds,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                color: color,
                borderColor: color,
                wickColor: color
            };
        });

        // Prepare EMA data with adjusted timestamps
        // Only include candles where EMA has been calculated (not null)
        const emaData = [];
        for (const candle of this.data) {
            if (candle.ema !== null) {
                emaData.push({
                    time: candle.time + offsetSeconds,
                    value: candle.ema
                });
            }
        }

        // Update series
        this.candlestickSeries.setData(candleData);
        this.emaSeries.setData(emaData);

        // Update volume profile
        this.updateVolumeProfile();

        // Only fit content on initial load or when user changes settings
        // This preserves zoom/pan position during auto-updates
        if (this.isInitialLoad) {
            this.chart.timeScale().fitContent();
            this.isInitialLoad = false;
        }

        // Update background colors (regime zones)
        if (this.regimeColorsEnabled) {
            this.updateRegimeBackgrounds();
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
                mode: 0, // Normal mode
                autoScale: true,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                borderColor: THEME.border,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 12,
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
        });

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
            title: 'Regime Trend',
        });

        // Create volume profile overlay container
        this.createVolumeProfileOverlay();

        // Auto-resize chart
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== chartContainer) {
                return;
            }
            const newRect = entries[0].contentRect;
            this.chart.applyOptions({ width: newRect.width, height: newRect.height });
        });

        resizeObserver.observe(chartContainer);

        // Update volume profile on zoom/pan
        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            if (this.data && this.data.length > 0) {
                this.updateVolumeProfile();
            }
        });

        // Add double-click zoom on price scale (TradingView-style)
        chartContainer.addEventListener('dblclick', (event) => {
            const rect = chartContainer.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const width = rect.width;

            // Check if click is on the right side (price scale area)
            // Price scale is typically ~60px wide on the right
            if (x > width - 60) {
                // Auto-fit the price scale
                this.chart.timeScale().fitContent();
            }
        });
    }

    /**
     * Update regime background colors
     */
    updateRegimeBackgrounds() {
        if (!this.data || this.data.length === 0) {
            return;
        }

        // Group consecutive candles by regime
        const regimeZones = [];
        let currentState = null;
        let startTime = null;

        for (let i = 0; i < this.data.length; i++) {
            const candle = this.data[i];

            if (candle.state !== currentState) {
                // Save previous zone
                if (currentState !== null) {
                    regimeZones.push({
                        state: currentState,
                        startTime: startTime,
                        endTime: candle.time
                    });
                }

                // Start new zone
                currentState = candle.state;
                startTime = candle.time;
            }
        }

        // Add final zone
        if (currentState !== null) {
            regimeZones.push({
                state: currentState,
                startTime: startTime,
                endTime: this.data[this.data.length - 1].time + 3600 // Extend to right
            });
        }

        // Apply background colors using time scale marks (workaround)
        // Note: Lightweight Charts doesn't support background zones natively,
        // so we use the candlestick colors to indicate regimes
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
    console.log('BROtrade Regime Seeker v0.23');
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
