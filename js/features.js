/**
 * BROtrade Regime Seeker - Advanced Features Module
 * v0.19 - Fixed market data toggles, timeframe mismatch, removed event markers
 */

// Feature Manager Class
class FeatureManager {
    constructor(app) {
        this.app = app;
        this.settings = this.loadSettings();
        this.mtfData = {};
        this.currentATR = null;

        this.init();
    }

    init() {
        this.initSettings();
        this.initMTFPanel();
        this.initTipsPanel();
        this.initExportModal();
        this.initMarketData();
        this.applySettings();
        this.startIndicatorUpdates();
    }

    startIndicatorUpdates() {
        // Update indicators every 5 seconds
        setInterval(() => {
            if (this.settings.stormWarning) {
                this.updateStormWarning();
            }
            if (this.settings.confluenceBadge) {
                this.updateConfluenceBadge();
            }
        }, 5000);
    }

    // ================== SETTINGS MANAGEMENT ==================

    loadSettings() {
        const defaults = {
            regimeColors: true,
            showEMA: true,
            atrBands: false,
            sound: true,
            volumeFilter: false,
            volumeMultiplier: 2,
            fearGreed: true,
            btcDom: true,
            showADX: true,
            confluenceBadge: false,
            stormWarning: false
        };

        const saved = localStorage.getItem('brotrade_settings');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    saveSettings() {
        localStorage.setItem('brotrade_settings', JSON.stringify(this.settings));
    }

    initSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        const settingsClose = document.getElementById('settings-close');

        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.toggle('show');
        });

        settingsClose.addEventListener('click', () => {
            settingsPanel.classList.remove('show');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
                settingsPanel.classList.remove('show');
            }
        });

        // Bind all setting checkboxes
        const settingInputs = {
            'setting-regime-colors': 'regimeColors',
            'setting-show-ema': 'showEMA',
            'setting-atr-bands': 'atrBands',
            'setting-sound': 'sound',
            'setting-volume-filter': 'volumeFilter',
            'setting-fear-greed': 'fearGreed',
            'setting-btc-dom': 'btcDom',
            'setting-show-adx': 'showADX',
            'setting-confluence-badge': 'confluenceBadge',
            'setting-storm-warning': 'stormWarning'
        };

        Object.entries(settingInputs).forEach(([id, key]) => {
            const element = document.getElementById(id);
            if (element) {
                element.checked = this.settings[key];
                element.addEventListener('change', () => {
                    this.settings[key] = element.checked;
                    this.saveSettings();
                    this.applySettings();
                });
            }
        });

        // Volume multiplier
        const volumeMultSelect = document.getElementById('setting-volume-mult');
        if (volumeMultSelect) {
            volumeMultSelect.value = this.settings.volumeMultiplier;
            volumeMultSelect.addEventListener('change', () => {
                this.settings.volumeMultiplier = parseFloat(volumeMultSelect.value);
                this.saveSettings();
                this.applySettings();
            });
        }
    }

    applySettings() {
        // ===== CHART DISPLAY SETTINGS =====

        // Regime Colors
        if (this.app) {
            this.app.regimeColorsEnabled = this.settings.regimeColors;
            if (this.app.data && this.app.data.length > 0) {
                this.app.updateChart();
            }
        }

        // EMA Toggle
        if (this.app && this.app.emaSeries) {
            this.app.emaSeries.applyOptions({
                visible: this.settings.showEMA
            });
        }

        // ATR Bands Toggle
        if (this.settings.atrBands) {
            this.createATRBands();
        } else {
            this.removeATRBands();
        }

        // ===== INDICATORS SETTINGS =====

        // Sound
        if (this.app) {
            this.app.soundEnabled = this.settings.sound;
            if (this.app.soundGenerator) {
                this.app.soundGenerator.setEnabled(this.settings.sound);
            }
        }

        // Volume Filter
        if (this.app) {
            this.app.volumeFilterEnabled = this.settings.volumeFilter;
            this.app.volumeMultiplier = this.settings.volumeMultiplier;
            // Re-process data with new volume filter settings
            if (this.app.data && this.app.data.length > 0 && this.app.indicator) {
                this.app.indicator.volumeFilterEnabled = this.settings.volumeFilter;
                this.app.indicator.volumeMultiplier = this.settings.volumeMultiplier;
                this.app.indicator.processData(this.app.data);
                this.app.updateChart();
            }
        }

        // ===== MARKET DATA SETTINGS =====

        // Apply Fear & Greed / BTC Dominance / ADX
        const marketInfo = document.getElementById('market-info');
        const fearGreedDisplay = document.getElementById('fear-greed-display');
        const btcDomDisplay = document.getElementById('btc-dom-display');
        const adxDisplay = document.getElementById('adx-display');

        // Show/hide individual items based on settings using classList
        if (fearGreedDisplay) {
            if (this.settings.fearGreed) {
                fearGreedDisplay.classList.remove('hidden');
            } else {
                fearGreedDisplay.classList.add('hidden');
            }
        }
        if (btcDomDisplay) {
            if (this.settings.btcDom) {
                btcDomDisplay.classList.remove('hidden');
            } else {
                btcDomDisplay.classList.add('hidden');
            }
        }
        if (adxDisplay) {
            if (this.settings.showADX) {
                adxDisplay.classList.remove('hidden');
            } else {
                adxDisplay.classList.add('hidden');
            }
        }

        // Show container if any item is enabled
        if (marketInfo) {
            const anyEnabled = this.settings.fearGreed || this.settings.btcDom || this.settings.showADX;
            if (anyEnabled) {
                marketInfo.classList.remove('hidden');
            } else {
                marketInfo.classList.add('hidden');
            }
        }

        // Apply Confluence Badge
        if (this.settings.confluenceBadge) {
            this.updateConfluenceBadge();
        } else {
            const badge = document.getElementById('confluence-badge');
            if (badge) badge.classList.add('hidden');
        }

        // Apply Storm Warning
        if (this.settings.stormWarning) {
            this.updateStormWarning();
        } else {
            this.removeStormWarning();
        }

        // Sync with legacy controls
        this.syncLegacyControls();
    }

    updateConfluenceBadge() {
        // Don't show badge if setting is disabled
        if (!this.settings.confluenceBadge) {
            const badge = document.getElementById('confluence-badge');
            if (badge) badge.classList.add('hidden');
            return;
        }

        if (!this.mtfData || Object.keys(this.mtfData).length === 0) {
            return;
        }

        const regimes = Object.values(this.mtfData).map(d => d.currentState);
        const uptrends = regimes.filter(r => r && r.includes('UPTREND')).length;
        const downtrends = regimes.filter(r => r && r.includes('DOWNTREND')).length;
        const total = regimes.length;

        const badge = document.getElementById('confluence-badge');
        const badgeContent = badge ? badge.querySelector('.confluence-badge-content') : null;
        const badgeText = document.getElementById('confluence-badge-text');
        const badgeCount = document.getElementById('confluence-badge-count');

        if (!badge || !badgeContent || !badgeText || !badgeCount) return;

        if (uptrends >= Math.ceil(total * 0.6)) {
            badge.classList.remove('hidden');
            // Special text for 100% confluence
            if (uptrends === total) {
                badgeText.textContent = 'UPTREND CONFIRMED';
                badgeCount.textContent = `${uptrends}/${total} ↑`;
            } else {
                badgeText.textContent = 'HIGH CONFLUENCE';
                badgeCount.textContent = `${uptrends}/${total} BULLISH ↑`;
            }
            badgeContent.classList.add('bullish');
            badgeContent.classList.remove('bearish');
        } else if (downtrends >= Math.ceil(total * 0.6)) {
            badge.classList.remove('hidden');
            // Special text for 100% confluence
            if (downtrends === total) {
                badgeText.textContent = 'DOWNTREND CONFIRMED';
                badgeCount.textContent = `${downtrends}/${total} ↓`;
            } else {
                badgeText.textContent = 'HIGH CONFLUENCE';
                badgeCount.textContent = `${downtrends}/${total} BEARISH ↓`;
            }
            badgeContent.classList.add('bearish');
            badgeContent.classList.remove('bullish');
        } else {
            badge.classList.add('hidden');
        }
    }

    updateStormWarning() {
        if (!this.app || !this.app.data || this.app.data.length === 0) return;

        // Get the latest candle data
        const latestCandle = this.app.data[this.app.data.length - 1];
        const adx = latestCandle.adx || 0;
        const diPlus = latestCandle.diPlus || 0;
        const diMinus = latestCandle.diMinus || 0;

        // Storm Warning: Very high ADX (>50) with diverging DI lines
        const isStorm = adx > 50 && Math.abs(diPlus - diMinus) > 30;

        if (isStorm) {
            this.showStormWarning();
        } else {
            this.removeStormWarning();
        }
    }

    showStormWarning() {
        let warning = document.getElementById('storm-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'storm-warning';
            warning.className = 'storm-warning';
            warning.innerHTML = `
                <div class="storm-warning-content">
                    <span class="storm-icon">⚠️</span>
                    <span class="storm-text">STORM WARNING: Extreme Volatility Detected</span>
                </div>
            `;
            const chartSection = document.querySelector('.chart-section');
            if (chartSection) {
                chartSection.appendChild(warning);
            }
        }
        warning.classList.remove('hidden');
    }

    removeStormWarning() {
        const warning = document.getElementById('storm-warning');
        if (warning) {
            warning.classList.add('hidden');
        }
    }

    createATRBands() {
        if (!this.app || !this.app.chart || !this.app.data) return;

        // Check if ATR data is available on candles
        const hasATR = this.app.data.some(candle => candle.atr !== undefined && candle.atr !== null);
        if (!hasATR) {
            console.warn('ATR data not available on candles');
            return;
        }

        // Remove existing bands if any
        this.removeATRBands();

        // Create upper and lower band series
        this.atrUpperBand = this.app.chart.addLineSeries({
            color: 'rgba(139, 92, 246, 0.3)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'ATR Upper',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        this.atrLowerBand = this.app.chart.addLineSeries({
            color: 'rgba(139, 92, 246, 0.3)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'ATR Lower',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        // Calculate and set band data
        this.updateATRBands();
    }

    updateATRBands() {
        if (!this.atrUpperBand || !this.atrLowerBand || !this.app || !this.app.data) return;

        const offsetSeconds = this.app.utcOffset * 3600;
        const bandData = this.app.data
            .filter(candle => candle.atr)
            .map(candle => {
                const atr = candle.atr;
                const middle = (candle.high + candle.low) / 2;
                return {
                    time: candle.time + offsetSeconds,
                    upper: middle + (atr * 2),
                    lower: middle - (atr * 2)
                };
            });

        const upperData = bandData.map(d => ({ time: d.time, value: d.upper }));
        const lowerData = bandData.map(d => ({ time: d.time, value: d.lower }));

        this.atrUpperBand.setData(upperData);
        this.atrLowerBand.setData(lowerData);
    }

    removeATRBands() {
        if (this.atrUpperBand && this.app && this.app.chart) {
            this.app.chart.removeSeries(this.atrUpperBand);
            this.atrUpperBand = null;
        }
        if (this.atrLowerBand && this.app && this.app.chart) {
            this.app.chart.removeSeries(this.atrLowerBand);
            this.atrLowerBand = null;
        }
    }

    syncLegacyControls() {
        // Legacy controls have been removed - all settings now managed through settings panel
        // This function is kept for potential future use
    }

    // ================== MULTI-TIMEFRAME PANEL ==================

    initMTFPanel() {
        const mtfToggle = document.getElementById('mtf-toggle');
        const mtfClose = document.getElementById('mtf-close');
        const mtfPanel = document.getElementById('mtf-panel');

        mtfToggle.addEventListener('click', () => {
            mtfPanel.classList.remove('collapsed');
            this.settings.mtfPanel = true;
            this.saveSettings();
            if (!this.mtfInitialized) {
                this.startMTFUpdates();
                this.mtfInitialized = true;
            }
        });

        mtfClose.addEventListener('click', () => {
            mtfPanel.classList.add('collapsed');
            this.settings.mtfPanel = false;
            this.saveSettings();
        });
    }

    async startMTFUpdates() {
        const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
        await this.updateMTFData(timeframes);

        // Update every 30 seconds
        setInterval(() => this.updateMTFData(timeframes), 30000);
    }

    async updateMTFData(timeframes) {
        const symbol = this.app.currentCrypto || 'BTC';
        const exchange = this.app.currentExchange || 'binance.us';

        const mtfContainer = document.getElementById('mtf-timeframes');
        mtfContainer.innerHTML = '';

        for (const tf of timeframes) {
            try {
                // Fetch data for this timeframe
                const data = await this.fetchTimeframeData(exchange, symbol, tf);

                if (data && data.length > 50) {
                    // Calculate regime
                    const regimeData = calculateRegimeForData(data);
                    this.mtfData[tf] = {
                        currentState: regimeData.currentState,
                        adx: regimeData.adx
                    };

                    // Create MTF item
                    const item = this.createMTFItem(tf, regimeData);
                    mtfContainer.appendChild(item);
                }
            } catch (error) {
                console.error(`Error fetching ${tf} data:`, error);
            }
        }

        // Update confluence
        this.updateConfluence();
    }

    createMTFItem(timeframe, regime) {
        const item = document.createElement('div');
        item.className = 'mtf-tf-item';

        if (timeframe === this.app.currentTimeframe) {
            item.classList.add('current');
        }

        const currentRegime = regime.currentState || 'RANGING';

        item.innerHTML = `
            <div class="mtf-tf-label">${timeframe}</div>
            <div class="mtf-tf-regime ${currentRegime}">
                ${this.getRegimeShortName(currentRegime)}
            </div>
            <div class="mtf-tf-strength">
                <div class="mtf-tf-strength-fill" style="width: ${Math.min(regime.adx || 0, 100)}%"></div>
            </div>
        `;

        item.addEventListener('click', () => {
            // Switch to this timeframe
            document.getElementById('timeframe').value = timeframe;
            this.app.currentTimeframe = timeframe;
            this.app.fetchData();
        });

        return item;
    }

    getRegimeShortName(regime) {
        const names = {
            'STRONG_UPTREND': 'STRONG ↑',
            'WEAK_UPTREND': 'WEAK ↑',
            'RANGING': 'RANGING',
            'WEAK_DOWNTREND': 'WEAK ↓',
            'STRONG_DOWNTREND': 'STRONG ↓'
        };
        return names[regime] || regime;
    }

    updateConfluence() {
        const regimes = Object.values(this.mtfData).map(d => d.currentState);

        const uptrends = regimes.filter(r => r && (r.includes('UPTREND'))).length;
        const downtrends = regimes.filter(r => r && (r.includes('DOWNTREND'))).length;
        const total = regimes.length;

        let confluencePercent = 0;
        let confluenceType = 'neutral';
        let confluenceText = 'No confluence';

        // Always calculate percentage, even if below 60%
        if (uptrends > downtrends && uptrends > 0) {
            confluencePercent = (uptrends / total) * 100;
            confluenceType = uptrends >= Math.ceil(total * 0.6) ? 'bullish' : 'neutral';
            // Special text for 100% confluence
            if (uptrends === total) {
                confluenceText = `${uptrends}/${total} Uptrend Confirmed`;
            } else {
                confluenceText = `${uptrends}/${total} Bullish${uptrends >= Math.ceil(total * 0.6) ? ' Aligned' : ''}`;
            }
        } else if (downtrends > uptrends && downtrends > 0) {
            confluencePercent = (downtrends / total) * 100;
            confluenceType = downtrends >= Math.ceil(total * 0.6) ? 'bearish' : 'neutral';
            // Special text for 100% confluence
            if (downtrends === total) {
                confluenceText = `${downtrends}/${total} Downtrend Confirmed`;
            } else {
                confluenceText = `${downtrends}/${total} Bearish${downtrends >= Math.ceil(total * 0.6) ? ' Aligned' : ''}`;
            }
        }

        // Update MTF panel confluence
        const confluenceFill = document.getElementById('confluence-fill');
        const confluenceTextElem = document.getElementById('confluence-text');
        const confluenceTip = document.getElementById('confluence-tip');

        if (confluenceFill) {
            // Ensure minimum 5% width for visibility
            const displayPercent = Math.max(confluencePercent, confluencePercent > 0 ? 5 : 0);
            confluenceFill.style.width = `${displayPercent}%`;
            confluenceFill.className = `confluence-fill ${confluenceType}`;
        }

        if (confluenceTextElem) {
            confluenceTextElem.textContent = `${Math.round(confluencePercent)}%`;
        }

        if (confluenceTip) {
            confluenceTip.textContent = confluenceText;
        }

        // Update badge (only show if >= 60%)
        if (this.settings.confluenceBadge) {
            this.updateConfluenceBadge();
        }
    }

    async fetchTimeframeData(exchange, symbol, timeframe) {
        try {
            const exchangeConfig = {
                'binance.us': {
                    url: 'https://api.binance.us/api/v3/klines',
                    format: 'binance'
                },
                'binance.com': {
                    url: 'https://api.binance.com/api/v3/klines',
                    format: 'binance'
                },
                'kraken': {
                    url: 'https://api.kraken.com/0/public/OHLC',
                    format: 'kraken'
                }
            };

            const config = exchangeConfig[exchange];
            if (!config) return null;

            let data;
            if (config.format === 'binance') {
                const pair = `${symbol}USDT`;
                const response = await fetch(`${config.url}?symbol=${pair}&interval=${timeframe}&limit=200`);
                if (!response.ok) return null;
                const rawData = await response.json();

                data = rawData.map(candle => ({
                    time: candle[0] / 1000,
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                }));
            } else if (config.format === 'kraken') {
                const pair = symbol === 'BTC' ? 'XBTUSD' : `${symbol}USD`;
                const intervalMap = {
                    '1m': 1, '5m': 5, '15m': 15, '30m': 30,
                    '1h': 60, '4h': 240, '1d': 1440, '1w': 10080, '1M': 21600
                };

                const response = await fetch(`${config.url}?pair=${pair}&interval=${intervalMap[timeframe]}`);
                if (!response.ok) return null;
                const rawData = await response.json();

                if (rawData.error && rawData.error.length > 0) return null;
                const ohlcData = rawData.result[Object.keys(rawData.result)[0]];

                data = ohlcData.map(candle => ({
                    time: candle[0],
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[6])
                }));
            }

            return data;
        } catch (error) {
            console.error(`Error fetching ${timeframe} data:`, error);
            return null;
        }
    }

    // ================== TIPS PANEL ==================

    initTipsPanel() {
        const tipsToggleBtn = document.getElementById('tips-toggle-btn');
        const tipsClose = document.getElementById('tips-close');
        const tipsPanel = document.getElementById('tips-panel');

        tipsToggleBtn.addEventListener('click', () => {
            tipsPanel.classList.remove('collapsed');
            this.settings.tipsPanel = true;
            this.saveSettings();
            this.updateTipsContent();
        });

        tipsClose.addEventListener('click', () => {
            tipsPanel.classList.add('collapsed');
            this.settings.tipsPanel = false;
            this.saveSettings();
        });

        // Tabs
        const tabs = document.querySelectorAll('.tips-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.updateTipsContent(tab.dataset.tab);
            });
        });

        // Update tips every 5 seconds to catch regime changes
        setInterval(() => {
            if (this.settings.tipsPanel) {
                this.updateTipsContent();
            }
        }, 5000);
    }

    // Public method to be called when regime changes
    onRegimeChange(newRegime) {
        if (this.settings.tipsPanel) {
            this.updateTipsContent();
        }
    }

    updateTipsContent(tab = 'current') {
        const content = document.getElementById('tips-content');
        const regime = this.app?.indicator?.currentState || 'RANGING';
        const regimeTitle = document.getElementById('tips-regime-title');

        regimeTitle.textContent = regime.replace('_', ' ');

        const tipsData = this.getTipsData(regime);

        if (tab === 'current') {
            content.innerHTML = `
                <div class="tips-section">
                    <h4>✅ DO:</h4>
                    <ul class="tips-list">
                        ${tipsData.do.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
                <div class="tips-section">
                    <h4>❌ DON'T:</h4>
                    <ul class="tips-list">
                        ${tipsData.dont.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
                <div class="tips-section">
                    <h4>⚠️ WATCH FOR:</h4>
                    <ul class="tips-list">
                        ${tipsData.watch.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else if (tab === 'mistakes') {
            content.innerHTML = `
                <div class="tips-section">
                    <h4>Common Mistakes in ${regime.replace('_', ' ')}</h4>
                    <ul class="tips-list">
                        ${tipsData.mistakes.map((m, i) => `
                            <li><strong>${i + 1}. ${m.title}:</strong> ${m.description}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else if (tab === 'learn') {
            content.innerHTML = `
                <div class="tips-section">
                    <h4>Understanding Indicators</h4>
                    <p><strong>ADX (${this.app.currentADX || '--'}):</strong> Measures trend strength. Above 25 = strong trend.</p>
                    <p><strong>DI+ / DI-:</strong> Shows which direction has control. When DI+ > DI-, bulls lead.</p>
                    <p><strong>EMA (50):</strong> Moving average showing trend direction. Price above = bullish bias.</p>
                </div>
            `;
        }
    }

    getTipsData(regime) {
        const tips = {
            'STRONG_UPTREND': {
                do: [
                    'Look for pullbacks to EMA as entry points',
                    'Use trailing stops to ride the trend',
                    'Let winners run - trend may continue',
                    'Focus on higher timeframe direction'
                ],
                dont: [
                    'Fight the trend with counter-positions',
                    'Use tight profit targets',
                    'Over-trade on minor pullbacks',
                    'Ignore volume confirmation'
                ],
                watch: [
                    'ADX declining more than 15% = weakening trend',
                    'Price crossing below EMA',
                    'DI+ and DI- converging (< 5 points)',
                    'Volume surge with reversal candle'
                ],
                mistakes: [
                    { title: 'Taking Profits Too Early', description: 'Let strong trends run instead of exiting at first +5%' },
                    { title: 'Buying at Resistance', description: 'Wait for pullbacks instead of FOMO buying at highs' },
                    { title: 'Ignoring Regime Changes', description: 'Tighten stops when regime weakens' }
                ]
            },
            'WEAK_UPTREND': {
                do: [
                    'Take profits at resistance levels',
                    'Use moderate position sizes',
                    'Watch for regime strengthening or reversal',
                    'Confirm moves with volume'
                ],
                dont: [
                    'Assume trend will strengthen',
                    'Hold through range-bound action',
                    'Ignore warning signs of reversal',
                    'Over-leverage weak trends'
                ],
                watch: [
                    'ADX increasing = trend strengthening',
                    'ADX decreasing = potential ranging',
                    'Price struggling near EMA',
                    'DI crossovers'
                ],
                mistakes: [
                    { title: 'Treating as Strong Trend', description: 'Weak trends need tighter management' },
                    { title: 'Not Taking Profits', description: 'Weak trends can reverse quickly' },
                    { title: 'Ignoring Confluences', description: 'Check higher timeframes for confirmation' }
                ]
            },
            'RANGING': {
                do: [
                    'Trade range boundaries',
                    'Use tight stops',
                    'Take quick profits',
                    'Wait for breakout confirmation before trending strategies'
                ],
                dont: [
                    'Chase breakouts without confirmation',
                    'Use trend-following strategies',
                    'Over-trade choppy conditions',
                    'Hold losing positions hoping for trend'
                ],
                watch: [
                    'Volume expansion = potential breakout',
                    'ADX rising above 25',
                    'Price breaking support/resistance with conviction',
                    'Tightening range = volatility squeeze'
                ],
                mistakes: [
                    { title: 'Trend Trading in Ranging Market', description: 'Use range strategies instead' },
                    { title: 'Wide Stops', description: 'Ranging markets need tight risk management' },
                    { title: 'Not Waiting for Breakout', description: 'False breakouts are common in ranging conditions' }
                ]
            },
            'WEAK_DOWNTREND': {
                do: [
                    'Consider short positions or staying aside',
                    'Take profits at support levels',
                    'Use tight stops on long positions',
                    'Watch for potential reversal signals'
                ],
                dont: [
                    'Try to catch falling knives',
                    'Average down on losing longs',
                    'Assume quick V-bottom reversal',
                    'Ignore volume confirmation'
                ],
                watch: [
                    'ADX increasing = trend strengthening (danger)',
                    'Price bouncing off support',
                    'DI- weakening vs DI+',
                    'Higher timeframe support levels'
                ],
                mistakes: [
                    { title: 'Bottom Fishing Too Early', description: 'Wait for regime change confirmation' },
                    { title: 'Not Using Stops', description: 'Weak downtrends can become strong' },
                    { title: 'Fighting the Trend', description: 'Trend is your friend - even down' }
                ]
            },
            'STRONG_DOWNTREND': {
                do: [
                    'Stay aside or consider shorts if experienced',
                    'Protect capital - preservation is key',
                    'Wait for clear regime change',
                    'Use wide stops if forced to hold'
                ],
                dont: [
                    'Try to catch the bottom',
                    'Hold onto losing long positions',
                    'Add to losing positions',
                    'Fight the strong downtrend'
                ],
                watch: [
                    'ADX declining = trend weakening',
                    'Price crossing above EMA',
                    'DI- and DI+ converging',
                    'Volume declining (exhaustion)'
                ],
                mistakes: [
                    { title: 'Buying the Dip', description: 'Strong downtrends keep going down' },
                    { title: 'Not Cutting Losses', description: 'Exit quickly when regime turns bearish' },
                    { title: 'Overleveraging', description: 'Strong moves can liquidate positions fast' }
                ]
            }
        };

        return tips[regime] || tips['RANGING'];
    }

    // ================== MARKET DATA (F&G, BTC.D) ==================

    initMarketData() {
        this.fetchFearGreedIndex();
        this.fetchBTCDominance();
        this.updateADX();

        // Update every 5 minutes for F&G and BTC Dom
        setInterval(() => {
            this.fetchFearGreedIndex();
            this.fetchBTCDominance();
        }, 300000);

        // Update ADX every 5 seconds (tied to chart updates)
        setInterval(() => {
            this.updateADX();
        }, 5000);
    }

    updateADX() {
        if (!this.app || !this.app.data || this.app.data.length === 0) {
            return;
        }

        // Get the latest ADX value from the most recent candle
        const latestCandle = this.app.data[this.app.data.length - 1];
        const adx = latestCandle.adx;

        if (adx !== undefined && adx !== null) {
            const adxValue = document.getElementById('adx-value');
            if (adxValue) {
                adxValue.textContent = adx.toFixed(1);

                // Update tooltip
                const adxDisplay = document.getElementById('adx-display');
                if (adxDisplay) {
                    adxDisplay.title = `Average Directional Index: ${adx.toFixed(2)} ${adx > 25 ? '(Strong Trend)' : '(Weak Trend)'}`;
                }
            }
        }
    }

    async fetchFearGreedIndex() {
        try {
            const response = await fetch('https://api.alternative.me/fng/');
            const data = await response.json();

            if (data && data.data && data.data[0]) {
                const value = data.data[0].value;
                const classification = data.data[0].value_classification;

                document.getElementById('fear-greed-value').textContent = value;

                const display = document.getElementById('fear-greed-display');
                display.classList.remove('fear', 'greed');
                if (value < 45) {
                    display.classList.add('fear');
                } else if (value > 55) {
                    display.classList.add('greed');
                }

                display.title = `Fear & Greed Index: ${value} (${classification})`;
            }
        } catch (error) {
            console.error('Error fetching Fear & Greed Index:', error);
            document.getElementById('fear-greed-value').textContent = '--';
        }
    }

    async fetchBTCDominance() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/global');
            const data = await response.json();

            if (data && data.data && data.data.market_cap_percentage) {
                const btcDom = data.data.market_cap_percentage.btc;
                document.getElementById('btc-dom-value').textContent = `${btcDom.toFixed(1)}%`;
                document.getElementById('btc-dom-display').title = `Bitcoin Dominance: ${btcDom.toFixed(2)}%`;
            }
        } catch (error) {
            console.error('Error fetching BTC Dominance:', error);
            document.getElementById('btc-dom-value').textContent = '--';
        }
    }

    // ================== EXPORT MODAL ==================

    initExportModal() {
        const exportBtn = document.getElementById('export-chart-btn');
        const exportModal = document.getElementById('export-modal');
        const exportClose = document.getElementById('export-modal-close');
        const exportCancel = document.getElementById('export-cancel');
        const exportDownload = document.getElementById('export-download');

        exportBtn.addEventListener('click', () => {
            exportModal.classList.remove('hidden');
        });

        exportClose.addEventListener('click', () => {
            exportModal.classList.add('hidden');
        });

        exportCancel.addEventListener('click', () => {
            exportModal.classList.add('hidden');
        });

        exportDownload.addEventListener('click', () => {
            this.exportChart();
        });

        // Close on backdrop click
        exportModal.addEventListener('click', (e) => {
            if (e.target === exportModal) {
                exportModal.classList.add('hidden');
            }
        });
    }

    async exportChart() {
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas library not loaded. Please refresh the page.');
            return;
        }

        try {
            // Get options
            const format = document.querySelector('input[name="export-format"]:checked')?.value || 'png';
            const resolution = document.querySelector('input[name="export-resolution"]:checked')?.value || 'screen';
            const includeBranding = document.getElementById('export-branding')?.checked || false;
            const includeDateTime = document.getElementById('export-datetime')?.checked || false;
            const includeInfo = document.getElementById('export-info')?.checked || false;

            // Get the chart section
            const chartSection = document.querySelector('.chart-section');

            // Add export overlay if needed
            let exportOverlay = null;
            if (includeBranding || includeDateTime || includeInfo) {
                exportOverlay = document.createElement('div');
                exportOverlay.style.cssText = `
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    background: rgba(26, 15, 46, 0.9);
                    padding: 10px 15px;
                    border-radius: 5px;
                    border: 1px solid #8b5cf6;
                    font-family: 'Segoe UI', sans-serif;
                    color: #e0d4f7;
                    z-index: 9999;
                `;

                let overlayHTML = '';
                if (includeBranding) {
                    overlayHTML += '<div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">🎯 BROtrade Regime Seeker v0.19</div>';
                }
                if (includeInfo) {
                    const symbol = this.app?.currentCrypto || 'BTC';
                    const timeframe = this.app?.currentTimeframe || '1h';
                    const regime = this.app?.indicator?.currentState || 'RANGING';
                    overlayHTML += `<div style="font-size: 12px; margin-bottom: 2px;">${symbol}/USDT | ${timeframe} | ${regime.replace('_', ' ')}</div>`;
                }
                if (includeDateTime) {
                    const now = new Date().toLocaleString();
                    overlayHTML += `<div style="font-size: 11px; color: #8b7bb8;">${now}</div>`;
                }

                exportOverlay.innerHTML = overlayHTML;
                chartSection.style.position = 'relative';
                chartSection.appendChild(exportOverlay);
            }

            // Set scale based on resolution
            let scale = 1;
            if (resolution === 'high') scale = 2;
            if (resolution === 'social') scale = 1.5;

            // Capture with html2canvas
            const canvas = await html2canvas(chartSection, {
                scale: scale,
                backgroundColor: '#1a0f2e',
                logging: false,
                useCORS: true
            });

            // Remove overlay
            if (exportOverlay) {
                chartSection.removeChild(exportOverlay);
            }

            // Convert to desired format
            const imageType = format === 'jpg' ? 'image/jpeg' : 'image/png';
            const imageData = canvas.toDataURL(imageType, 0.95);

            // Create download link
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().split('T')[0];
            const symbol = this.app?.currentCrypto || 'BTC';
            const timeframe = this.app?.currentTimeframe || '1h';
            link.download = `brotrade-${symbol}-${timeframe}-${timestamp}.${format}`;
            link.href = imageData;
            link.click();

            // Close modal
            document.getElementById('export-modal').classList.add('hidden');

            console.log('Chart exported successfully!');
        } catch (error) {
            console.error('Error exporting chart:', error);
            alert('Error exporting chart. Please try again.');
        }
    }
}

// Helper function to calculate regime for MTF data
function calculateRegimeForData(candles) {
    if (!candles || candles.length < 50) {
        return { currentState: 'RANGING', adx: 0 };
    }

    try {
        // Create a temporary indicator instance
        const tempIndicator = new FilteredSignalsIndicator();

        // Process the data using calculateSignals
        const processedData = tempIndicator.calculateSignals(candles);

        if (processedData && processedData.length > 0) {
            const lastCandle = processedData[processedData.length - 1];
            return {
                currentState: lastCandle.state || 'RANGING',
                adx: lastCandle.adx || 0
            };
        }

        return {
            currentState: tempIndicator.currentState || 'RANGING',
            adx: 0
        };
    } catch (error) {
        console.error('Error calculating regime:', error);
        return { currentState: 'RANGING', adx: 0 };
    }
}

// Initialize features when app is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for main app to initialize
    setTimeout(() => {
        if (window.app) {
            window.features = new FeatureManager(window.app);
            console.log('Advanced features initialized');
        }
    }, 1000);
});
