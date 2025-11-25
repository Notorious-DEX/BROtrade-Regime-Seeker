/**
 * BROtrade Regime Seeker - Advanced Features Module
 * v0.16 - Multi-timeframe, Tips, Calculator, and more
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
        this.initPositionCalculator();
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
            positionCalc: false,
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
            'setting-position-calc': 'positionCalc',
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

        // Apply Tips Panel
        const tipsPanel = document.getElementById('tips-panel');
        if (this.settings.tipsPanel) {
            tipsPanel.classList.remove('collapsed');
            this.updateTipsContent();
        } else {
            tipsPanel.classList.add('collapsed');
        }

        // Apply Position Calculator
        const positionCalc = document.getElementById('position-calc');
        if (this.settings.positionCalc) {
            positionCalc.classList.remove('collapsed');
        } else {
            positionCalc.classList.add('collapsed');
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
        // This is a placeholder - integrate with actual exchange API
        // For now, return null (will be connected to app's fetch logic)
        return null;
    }

    // ================== TIPS PANEL ==================

    initTipsPanel() {
        const tipsToggle = document.getElementById('tips-toggle');
        const tipsPanel = document.getElementById('tips-panel');
        const tipsHeader = tipsPanel.querySelector('.tips-header');

        tipsHeader.addEventListener('click', () => {
            tipsPanel.classList.toggle('collapsed');
            tipsToggle.textContent = tipsPanel.classList.contains('collapsed') ? '▲' : '▼';
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
    }

    updateTipsContent(tab = 'current') {
        const content = document.getElementById('tips-content');
        const regime = this.app.currentRegime || 'RANGING';
        const regimeTitle = document.getElementById('tips-regime-title');

        regimeTitle.textContent = `CURRENT REGIME: ${regime.replace('_', ' ')}`;

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

    // ================== POSITION CALCULATOR ==================

    initPositionCalculator() {
        const calcToggle = document.getElementById('calc-toggle');
        const calcClose = document.getElementById('calc-close');
        const calcPanel = document.getElementById('position-calc');

        calcToggle.addEventListener('click', () => {
            calcPanel.classList.remove('collapsed');
            this.settings.positionCalc = true;
            this.saveSettings();
            this.updateCalculator();
        });

        calcClose.addEventListener('click', () => {
            calcPanel.classList.add('collapsed');
            this.settings.positionCalc = false;
            this.saveSettings();
        });

        // Input listeners
        const inputs = ['calc-capital', 'calc-risk-pct', 'calc-entry', 'calc-stop'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.updateCalculator());
            }
        });

        // Buttons
        document.getElementById('calc-copy')?.addEventListener('click', () => this.copyCalculatorValues());
        document.getElementById('calc-reset')?.addEventListener('click', () => this.resetCalculator());
    }

    updateCalculator() {
        const capital = parseFloat(document.getElementById('calc-capital').value) || 10000;
        const riskPct = parseFloat(document.getElementById('calc-risk-pct').value) || 2;
        const entry = parseFloat(document.getElementById('calc-entry').value) || 0;
        const stop = parseFloat(document.getElementById('calc-stop').value) || 0;

        const riskAmount = (capital * riskPct) / 100;
        document.getElementById('calc-risk-amount').textContent = riskAmount.toFixed(2);

        if (entry > 0 && stop > 0 && entry !== stop) {
            const stopPct = ((stop - entry) / entry) * 100;
            document.getElementById('calc-stop-pct').textContent = `${stopPct.toFixed(2)}%`;

            const stopDistance = Math.abs(entry - stop);
            const positionSize = riskAmount / stopDistance;

            // Update suggestions
            const conservative = positionSize * 0.67;
            const standard = positionSize;
            const aggressive = positionSize * 1.5;

            const symbol = this.app.currentCrypto || 'BTC';
            document.getElementById('calc-conservative').textContent =
                `${conservative.toFixed(4)} ${symbol}`;
            document.getElementById('calc-standard').textContent =
                `${standard.toFixed(4)} ${symbol}`;
            document.getElementById('calc-aggressive').textContent =
                `${aggressive.toFixed(4)} ${symbol}`;
        }

        // Update regime info
        const regime = this.app.currentRegime || 'RANGING';
        document.getElementById('calc-regime').textContent = regime.replace('_', ' ');
        document.getElementById('calc-atr').textContent = this.currentATR ?
            this.currentATR.toFixed(2) : '--';

        // Update regime tip
        const regimeTips = {
            'STRONG_UPTREND': 'Strong trend: Use wider stops (1.5-2x ATR), standard sizing OK',
            'WEAK_UPTREND': 'Weak trend: Moderate stops (1-1.5x ATR), conservative sizing',
            'RANGING': 'Choppy conditions: Tight stops (0.5-1x ATR), smaller positions or wait',
            'WEAK_DOWNTREND': 'Weak downtrend: Be cautious, tight stops recommended',
            'STRONG_DOWNTREND': 'Strong downtrend: Protect capital, wait for regime change'
        };

        document.getElementById('calc-regime-tip').textContent =
            regimeTips[regime] || 'Adjust position size based on market conditions';
    }

    copyCalculatorValues() {
        const values = {
            capital: document.getElementById('calc-capital').value,
            risk: document.getElementById('calc-risk-pct').value,
            entry: document.getElementById('calc-entry').value,
            stop: document.getElementById('calc-stop').value,
            standard: document.getElementById('calc-standard').textContent
        };

        const text = `Capital: $${values.capital}\nRisk: ${values.risk}%\nEntry: $${values.entry}\nStop: $${values.stop}\nPosition: ${values.standard}`;

        navigator.clipboard.writeText(text).then(() => {
            alert('Calculator values copied to clipboard!');
        });
    }

    resetCalculator() {
        document.getElementById('calc-capital').value = 10000;
        document.getElementById('calc-risk-pct').value = 2;
        document.getElementById('calc-entry').value = 43250;
        document.getElementById('calc-stop').value = 42500;
        this.updateCalculator();
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
        alert('Export functionality requires html2canvas library. Add <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script> to enable this feature.');

        // Future implementation with html2canvas:
        /*
        const chartSection = document.querySelector('.chart-section');
        const canvas = await html2canvas(chartSection);
        const link = document.createElement('a');
        link.download = `brotrade-chart-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        document.getElementById('export-modal').classList.add('hidden');
        */
    }
}

// Helper function to calculate regime for MTF data
function calculateRegimeForData(candles) {
    if (!candles || candles.length < 50) {
        return { currentState: 'RANGING', adx: 0 };
    }

    // Use the indicators module if available
    if (typeof calculateADX === 'function') {
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const closes = candles.map(c => c.close);

        const adxData = calculateADX(highs, lows, closes);
        const emaData = calculateEMA(closes, 50);

        const currentClose = closes[closes.length - 1];
        const currentEMA = emaData[emaData.length - 1];
        const currentADX = adxData.adx[adxData.adx.length - 1];
        const currentDIPlus = adxData.diPlus[adxData.diPlus.length - 1];
        const currentDIMinus = adxData.diMinus[adxData.diMinus.length - 1];

        let currentState = 'RANGING';

        if (currentDIPlus > currentDIMinus && currentClose > currentEMA) {
            currentState = currentADX > 25 ? 'STRONG_UPTREND' : 'WEAK_UPTREND';
        } else if (currentDIMinus > currentDIPlus && currentClose < currentEMA) {
            currentState = currentADX > 25 ? 'STRONG_DOWNTREND' : 'WEAK_DOWNTREND';
        }

        return { currentState, adx: currentADX };
    }

    return { currentState: 'RANGING', adx: 0 };
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
