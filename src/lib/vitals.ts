import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

type Metric = { name: string; value: number; rating: string };

function logVital({ name, value, rating }: Metric) {
  if (import.meta.env.DEV) {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '🔴';
    console.log(`${emoji} ${name}: ${Math.round(value)}ms [${rating}]`);
  }
}

export function measureWebVitals() {
  onCLS(logVital);
  onINP(logVital);
  onLCP(logVital);
  onFCP(logVital);
  onTTFB(logVital);
}
