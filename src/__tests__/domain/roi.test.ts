import { describe, it, expect } from 'vitest';
import { computeRiderROI, computeAggregateROI, formatROI, formatROICompact } from '@/domain/stats/roi';

describe('ROI calculations', () => {
  describe('computeRiderROI', () => {
    it('calculates ROI as Σ points / Σ prix', () => {
      const roi = computeRiderROI({ 
        pointsTotal: 150, 
        purchasePriceTotal: 35 
      });
      expect(roi).toBeCloseTo(150 / 35);
    });

    it('handles zero points', () => {
      const roi = computeRiderROI({ 
        pointsTotal: 0, 
        purchasePriceTotal: 100 
      });
      expect(roi).toBe(0);
    });

    it('protects against division by zero with minDivisor', () => {
      const roi = computeRiderROI({ 
        pointsTotal: 50, 
        purchasePriceTotal: 0 
      });
      expect(roi).toBe(50); // minDivisor=1 by default
    });

    it('handles null/undefined values', () => {
      const roi = computeRiderROI({ 
        pointsTotal: null, 
        purchasePriceTotal: undefined 
      });
      expect(roi).toBe(0);
    });

    it('handles custom minDivisor', () => {
      const roi = computeRiderROI({ 
        pointsTotal: 100, 
        purchasePriceTotal: 0 
      }, 10);
      expect(roi).toBe(10); // 100 / max(10, 0) = 100 / 10
    });
  });

  describe('computeAggregateROI', () => {
    it('calculates aggregate ROI as Σ points / Σ prix (not average of ratios)', () => {
      const riders = [
        { pointsTotal: 100, purchasePriceTotal: 10 }, // individual ratio: 10
        { pointsTotal: 50, purchasePriceTotal: 25 }   // individual ratio: 2
      ];
      const roiAgg = computeAggregateROI(riders);
      
      // Correct: (100+50) / (10+25) = 150 / 35 ≈ 4.2857
      expect(roiAgg).toBeCloseTo(150 / 35);
      
      // Incorrect would be: (10 + 2) / 2 = 6
      const wrongAverage = (10 + 2) / 2;
      expect(roiAgg).not.toBeCloseTo(wrongAverage);
    });

    it('handles empty array', () => {
      const roi = computeAggregateROI([]);
      expect(roi).toBe(0);
    });

    it('handles mixed null/undefined values', () => {
      const riders = [
        { pointsTotal: 100, purchasePriceTotal: 20 },
        { pointsTotal: null, purchasePriceTotal: undefined },
        { pointsTotal: 50, purchasePriceTotal: 10 }
      ];
      const roi = computeAggregateROI(riders);
      expect(roi).toBeCloseTo(150 / 30); // 5
    });

    it('protects against division by zero', () => {
      const riders = [
        { pointsTotal: 100, purchasePriceTotal: 0 },
        { pointsTotal: 50, purchasePriceTotal: 0 }
      ];
      const roi = computeAggregateROI(riders);
      expect(roi).toBe(150); // with default minDivisor=1
    });
  });

  describe('formatROI', () => {
    it('formats with default unit and 3 digits', () => {
      const formatted = formatROI(4.28571428571);
      expect(formatted).toBe('4.286 pts/crédit');
    });

    it('formats with custom unit', () => {
      const formatted = formatROI(4.28571428571, 'points/€');
      expect(formatted).toBe('4.286 points/€');
    });

    it('formats with custom digits', () => {
      const formatted = formatROI(4.28571428571, 'pts/crédit', 2);
      expect(formatted).toBe('4.29 pts/crédit');
    });
  });

  describe('formatROICompact', () => {
    it('formats without unit with 2 digits by default', () => {
      const formatted = formatROICompact(4.28571428571);
      expect(formatted).toBe('4.29');
    });

    it('formats with custom digits', () => {
      const formatted = formatROICompact(4.28571428571, 3);
      expect(formatted).toBe('4.286');
    });
  });
});
