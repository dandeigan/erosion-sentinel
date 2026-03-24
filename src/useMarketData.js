import { useState, useEffect } from 'react';

export function useMarketData() {
  const [diesel, setDiesel] = useState({ price: null, change: null, period: null, loading: true });

  const fetchDiesel = async () => {
    try {
      const res = await fetch('/api/diesel');
      const data = await res.json();
      if (data.price) setDiesel({ ...data, loading: false });
    } catch {
      setDiesel(d => ({ ...d, loading: false }));
    }
  };

  useEffect(() => {
    fetchDiesel();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDiesel, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { diesel };
}
