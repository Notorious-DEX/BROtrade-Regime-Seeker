/**
 * BROtrade Regime Seeker - Advanced Features Module
 * v0.17 - Functional settings, MTF panel repositioned, and more
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
            mtfPanel: false,
            tipsPanel: false,
            fearGreed: true,
            btcDom: true,
            confluenceBadge: false,
            stormWarning: false,
            eventMarkers: false,
            tooltips: true
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
            'setting-mtf-panel': 'mtfPanel',
            'setting-tips-panel': 'tipsPanel',
            'setting-fear-greed': 'fearGreed',
            'setting-btc-dom': 'btcDom',
            'setting-confluence-badge': 'confluenceBadge',
            'setting-storm-warning': 'stormWarning',
            'setting-event-markers': 'eventMarkers',
            'setting-tooltips': 'tooltips'
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

        // ===== PANELS & TOOLS SETTINGS =====

        // Apply MTF Panel
        const mtfPanel = document.getElementById('mtf-panel');
        if (this.settings.mtfPanel) {
            mtfPanel.classList.remove('collapsed');
            if (!this.mtfInitialized) {
                this.startMTFUpdates();
                this.mtfInitialized = true;
            }
        } else {
            mtfPanel.classList.add('collapsed');
        }

        // Apply Tips Panel (now on right side)
        const tipsPanel = document.getElementById('tips-panel');
        if (this.settings.tipsPanel) {
            tipsPanel.classList.remove('collapsed');
            this.updateTipsContent();
        } else {
            tipsPanel.classList.add('collapsed');
        }

        // Apply Fear & Greed / BTC Dominance
        const marketInfo = document.getElementById('market-info');
        if (this.settings.fearGreed || this.settings.btcDom) {
            marketInfo.style.display = 'flex';
            document.getElementById('fear-greed-display').style.display =
                this.settings.fearGreed ? 'inline' : 'none';
            document.getElementById('btc-dom-display').style.display =
                this.settings.btcDom ? 'inline' : 'none';
        } else {
            marketInfo.style.display = 'none';
        }

        // Apply Confluence Badge
        if (this.settings.confluenceBadge) {
            this.updateConfluenceBadge();
        } else {
            document.getElementById('confluence-badge').classList.add('hidden');
        }

        // Sync with legacy controls
        this.syncLegacyControls();
    }

    createATRBands() {
        if (!this.app || !this.app.chart || !this.app.data) return;

        // Calculate ATR if not already done
        if (!this.app.indicator || !this.app.indicator.atr) {
            console.warn('ATR data not available');
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
        // Sync with existing controls in the UI
        const soundToggle = document.getElementById('sound-toggle');
        const colorsToggle = document.getElementById('colors-toggle');
        const volumeFilterToggle = document.getElementById('volume-filter-toggle');
        const volumeMultiplier = document.getElementById('volume-multiplier');

        if (soundToggle) soundToggle.checked = this.settings.sound;
        if (colorsToggle) colorsToggle.checked = this.settings.regimeColors;
        if (volumeFilterToggle) volumeFilterToggle.checked = this.settings.volumeFilter;
        if (volumeMultiplier) volumeMultiplier.value = this.settings.volumeMultiplier;

        // Add listeners to sync settings when legacy controls change (one-time setup)
        if (!this.legacyListenersAdded) {
            if (soundToggle) {
                soundToggle.addEventListener('change', (e) => {
                    this.settings.sound = e.target.checked;
                    this.saveSettings();
                    document.getElementById('setting-sound').checked = e.target.checked;
                });
            }

            if (colorsToggle) {
                colorsToggle.addEventListener('change', (e) => {
                    this.settings.regimeColors = e.target.checked;
                    this.saveSettings();
                    document.getElementById('setting-regime-colors').checked = e.target.checked;
                });
            }

            if (volumeFilterToggle) {
                volumeFilterToggle.addEventListener('change', (e) => {
                    this.settings.volumeFilter = e.target.checked;
                    this.saveSettings();
                    document.getElementById('setting-volume-filter').checked = e.target.checked;
                });
            }

            if (volumeMultiplier) {
                volumeMultiplier.addEventListener('change', (e) => {
                    this.settings.volumeMultiplier = parseFloat(e.target.value);
                    this.saveSettings();
                    document.getElementById('setting-volume-mult').value = e.target.value;
                });
            }

            this.legacyListenersAdded = true;
        }
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
                    const regime = calculateRegimeForData(data);
                    this.mtfData[tf] = { regime, adx: regime.adx };

                    // Create MTF item
                    const item = this.createMTFItem(tf, regime);
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
        const regimes = Object.values(this.mtfData).map(d => d.regime.currentState);

        const uptrends = regimes.filter(r => r && (r.includes('UPTREND'))).length;
        const downtrends = regimes.filter(r => r && (r.includes('DOWNTREND'))).length;
        const total = regimes.length;

        let confluencePercent = 0;
        let confluenceType = 'neutral';
        let confluenceText = 'No confluence';

        if (uptrends >= Math.ceil(total * 0.6)) {
            confluencePercent = (uptrends / total) * 100;
            confluenceType = 'bullish';
            confluenceText = `${uptrends}/${total} Bullish Aligned`;
        } else if (downtrends >= Math.ceil(total * 0.6)) {
            confluencePercent = (downtrends / total) * 100;
            confluenceType = 'bearish';
            confluenceText = `${downtrends}/${total} Bearish Aligned`;
        }

        // Update MTF panel confluence
        const confluenceFill = document.getElementById('confluence-fill');
        const confluenceTextElem = document.getElementById('confluence-text');
        const confluenceTip = document.getElementById('confluence-tip');

        if (confluenceFill) {
            confluenceFill.style.width = `${confluencePercent}%`;
            confluenceFill.className = `confluence-fill ${confluenceType}`;
        }

        if (confluenceTextElem) {
            confluenceTextElem.textContent = `${Math.round(confluencePercent)}%`;
        }

        if (confluenceTip) {
            confluenceTip.textContent = confluenceText;
        }

        // Update badge
        if (this.settings.confluenceBadge) {
            this.updateConfluenceBadge(confluencePercent, confluenceType, confluenceText);
        }
    }

    updateConfluenceBadge(percent, type, text) {
        const badge = document.getElementById('confluence-badge');
        const badgeContent = badge.querySelector('.confluence-badge-content');
        const badgeText = document.getElementById('confluence-badge-text');
        const badgeCount = document.getElementById('confluence-badge-count');

        if (percent >= 60) {
            badge.classList.remove('hidden');
            badgeContent.className = `confluence-badge-content ${type}`;
            badgeText.textContent = 'HIGH CONFLUENCE';
            badgeCount.textContent = text.toUpperCase();
        } else {
            badge.classList.add('hidden');
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

        // Update every 5 minutes
        setInterval(() => {
            this.fetchFearGreedIndex();
            this.fetchBTCDominance();
        }, 300000);
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
                    overlayHTML += '<div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">🎯 BROtrade Regime Seeker v0.17</div>';
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

        // Process the data
        tempIndicator.processData(candles);

        return {
            currentState: tempIndicator.currentState || 'RANGING',
            adx: tempIndicator.adx || 0
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
