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

    const price = parseFloat(latest.value).toFixed(3);
    const change = previous
      ? (parseFloat(latest.value) - parseFloat(previous.value)).toFixed(3)
      : null;

    res.status(200).json({ price, change, period: latest.period });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
