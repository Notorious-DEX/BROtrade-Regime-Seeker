/**
 * BROtrade Regime Seeker - Volume Profile
 * Implements anchored volume profile with value area calculation
 */

class VolumeProfile {
    constructor(config = {}) {
        this.valueAreaPercent = config.valueAreaPercent || 68; // Default 68% value area
        this.numBins = config.numBins || 100; // Number of price levels to divide range into

        // Purple color scheme for volume profile
        this.colors = {
            valueAreaHigh: '#a78bfa',   // Brighter purple for bullish value area
            valueAreaLow: '#6b46c1',    // Darker purple for bearish value area
            outsideValue: '#4c1d95'     // Very dark purple for outside value area
        };
    }

    /**
     * Calculate volume profile from candle data
     * @param {Array} candles - Array of OHLC candles with volume
     * @returns {Object} - Volume profile data with POC, VAH, VAL
     */
    calculate(candles) {
        if (!candles || candles.length === 0) {
            return null;
        }

        // Find price range
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        for (const candle of candles) {
            minPrice = Math.min(minPrice, candle.low);
            maxPrice = Math.max(maxPrice, candle.high);
        }

        // Create price bins
        const priceStep = (maxPrice - minPrice) / this.numBins;
        const volumeByPrice = new Array(this.numBins).fill(0);
        const priceLevels = [];

        for (let i = 0; i < this.numBins; i++) {
            priceLevels.push(minPrice + (i * priceStep));
        }

        // Distribute volume across price levels
        for (const candle of candles) {
            // For each candle, distribute its volume across the price range it covers
            const candleRange = candle.high - candle.low;

            if (candleRange === 0) {
                // If no range, assign all volume to close price
                const binIndex = Math.floor((candle.close - minPrice) / priceStep);
                const safeIndex = Math.max(0, Math.min(this.numBins - 1, binIndex));
                volumeByPrice[safeIndex] += candle.volume;
            } else {
                // Distribute volume proportionally across the candle's price range
                const lowBin = Math.floor((candle.low - minPrice) / priceStep);
                const highBin = Math.floor((candle.high - minPrice) / priceStep);

                for (let i = lowBin; i <= highBin; i++) {
                    if (i >= 0 && i < this.numBins) {
                        // Calculate what portion of this bin is covered by the candle
                        const binLow = priceLevels[i];
                        const binHigh = i < this.numBins - 1 ? priceLevels[i + 1] : maxPrice;

                        const overlapLow = Math.max(binLow, candle.low);
                        const overlapHigh = Math.min(binHigh, candle.high);
                        const overlapRatio = (overlapHigh - overlapLow) / candleRange;

                        volumeByPrice[i] += candle.volume * overlapRatio;
                    }
                }
            }
        }

        // Find Point of Control (POC) - price level with highest volume
        let pocIndex = 0;
        let maxVolume = 0;

        for (let i = 0; i < this.numBins; i++) {
            if (volumeByPrice[i] > maxVolume) {
                maxVolume = volumeByPrice[i];
                pocIndex = i;
            }
        }

        const poc = priceLevels[pocIndex];
        const totalVolume = volumeByPrice.reduce((sum, vol) => sum + vol, 0);

        // Calculate Value Area (68% of volume around POC)
        const targetVolume = totalVolume * (this.valueAreaPercent / 100);
        let valueAreaVolume = volumeByPrice[pocIndex];
        let vahIndex = pocIndex;
        let valIndex = pocIndex;

        // Expand from POC until we reach target volume
        while (valueAreaVolume < targetVolume && (vahIndex < this.numBins - 1 || valIndex > 0)) {
            const volumeAbove = vahIndex < this.numBins - 1 ? volumeByPrice[vahIndex + 1] : 0;
            const volumeBelow = valIndex > 0 ? volumeByPrice[valIndex - 1] : 0;

            if (volumeAbove >= volumeBelow && vahIndex < this.numBins - 1) {
                vahIndex++;
                valueAreaVolume += volumeAbove;
            } else if (valIndex > 0) {
                valIndex--;
                valueAreaVolume += volumeBelow;
            } else if (vahIndex < this.numBins - 1) {
                vahIndex++;
                valueAreaVolume += volumeAbove;
            } else {
                break;
            }
        }

        const vah = priceLevels[vahIndex];
        const val = priceLevels[valIndex];

        // Prepare histogram data for rendering
        const maxVolumeForScale = Math.max(...volumeByPrice);
        const histogramData = [];

        for (let i = 0; i < this.numBins; i++) {
            const price = priceLevels[i];
            const volume = volumeByPrice[i];

            if (volume === 0) continue;

            // Determine color based on position relative to value area and POC
            let color;
            if (i >= valIndex && i <= vahIndex) {
                // Inside value area
                if (i >= pocIndex) {
                    color = this.colors.valueAreaHigh; // Above POC = bullish
                } else {
                    color = this.colors.valueAreaLow;  // Below POC = bearish
                }
            } else {
                // Outside value area
                color = this.colors.outsideValue;
            }

            histogramData.push({
                price: price,
                volume: volume,
                normalizedVolume: volume / maxVolumeForScale,
                color: color,
                isPOC: i === pocIndex,
                isValueArea: i >= valIndex && i <= vahIndex
            });
        }

        return {
            histogramData: histogramData,
            poc: poc,
            vah: vah,
            val: val,
            totalVolume: totalVolume,
            valueAreaVolume: valueAreaVolume,
            maxVolume: maxVolumeForScale,
            priceRange: { min: minPrice, max: maxPrice }
        };
    }

    /**
     * Get color for a specific price level
     * @param {number} price - Price level
     * @param {Object} profile - Volume profile data
     * @returns {string} - Hex color
     */
    getColorForPrice(price, profile) {
        if (!profile) return this.colors.outsideValue;

        const isInValueArea = price >= profile.val && price <= profile.vah;

        if (isInValueArea) {
            return price >= profile.poc
                ? this.colors.valueAreaHigh
                : this.colors.valueAreaLow;
        } else {
            return this.colors.outsideValue;
        }
    }
}
