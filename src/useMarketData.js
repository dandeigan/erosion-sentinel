import { useState, useEffect, useCallback } from 'react';

export function useMarketData(projects = [], onDieselUpdate = null) {
  const [diesel, setDiesel] = useState({ price: null, change: null, period: null, fuelSurchargePercent: null, loading: true });
  const [laneRates, setLaneRates] = useState({});

  const fetchDiesel = useCallback(async () => {
    try {
      const res = await fetch('/api/diesel');
      const data = await res.json();
      if (data.price) {
        setDiesel({ ...data, loading: false });
        if (data.fuelSurchargePercent != null && onDieselUpdate) {
          onDieselUpdate(data.fuelSurchargePercent);
        }
      }
    } catch {
      setDiesel(d => ({ ...d, loading: false }));
    }
  }, [onDieselUpdate]);

  const fetchLaneRate = useCallback(async (project) => {
    try {
      const res = await fetch('/api/dat-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: project.origin,
          destination: project.destination,
          equipmentCategory: 'VAN',
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setLaneRates(prev => ({ ...prev, [project.id]: data }));
      }
    } catch {
      // silently fail — fall back to manual data
    }
  }, []);

  const fetchAllLaneRates = useCallback(() => {
    projects.forEach(p => fetchLaneRate(p));
  }, [projects, fetchLaneRate]);

  useEffect(() => {
    fetchDiesel();
    const dieselInterval = setInterval(fetchDiesel, 5 * 60 * 1000);
    return () => clearInterval(dieselInterval);
  }, [fetchDiesel]);

  useEffect(() => {
    if (projects.length > 0) {
      fetchAllLaneRates();
      const rateInterval = setInterval(fetchAllLaneRates, 10 * 60 * 1000);
      return () => clearInterval(rateInterval);
    }
  }, [projects.length]);

  return { diesel, laneRates };
}
