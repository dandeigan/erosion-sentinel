export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${process.env.EIA_API_KEY}&data[]=value&facets[series][]=EMD_EPD2D_PTE_NUS_DPG&frequency=weekly&sort[0][column]=period&sort[0][direction]=desc&length=2`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`EIA error: ${response.status}`);
    const json = await response.json();

    const rows = json?.response?.data || [];
    const latest = rows[0];
    const previous = rows[1];

    if (!latest) return res.status(200).json({ price: null, change: null, period: null });

    const price = parseFloat(latest.value);
    const change = previous
      ? (price - parseFloat(previous.value)).toFixed(3)
      : null;

    // Industry standard fuel surcharge formula
    // Baseline: $3.00/gal (pre-2021 trucking reference)
    // Surcharge % = ((current - baseline) / baseline) * 100
    const BASELINE_DIESEL = 3.00;
    const fuelSurchargePercent = ((price - BASELINE_DIESEL) / BASELINE_DIESEL) * 100;

    res.status(200).json({
      price: price.toFixed(3),
      change,
      period: latest.period,
      fuelSurchargePercent: parseFloat(fuelSurchargePercent.toFixed(1)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
