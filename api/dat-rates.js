// Simple in-memory token cache (lives for the duration of the serverless function warm instance)
let cachedToken = null;
let tokenExpiry = 0;

async function getDATToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${process.env.DAT_AUTH_URL}/access/v1/token/organization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.DAT_USERNAME,
      password: process.env.DAT_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`DAT auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.accessToken || data.access_token;
  // DAT tokens last 30 min — refresh 2 min early
  tokenExpiry = Date.now() + 28 * 60 * 1000;
  return cachedToken;
}

// Parse "City, ST" strings into DAT API format
function parseLocation(str) {
  if (!str) return null;
  const parts = str.split(',').map(s => s.trim());
  if (parts.length < 2) return null;
  return { city: parts[0], stateProv: parts[1] };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { origin, destination, equipmentCategory = 'VAN' } = req.body || {};

  const originParsed = parseLocation(origin);
  const destParsed = parseLocation(destination);

  if (!originParsed || !destParsed) {
    return res.status(400).json({ error: 'Invalid origin or destination format. Use "City, ST"' });
  }

  try {
    const token = await getDATToken();

    const rateRes = await fetch(`${process.env.DAT_API_URL}/linehaulrates/v1/forecasts/spot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        origin: originParsed,
        destination: destParsed,
        equipmentCategory,
        forecastPeriod: '8DAYS',
      }),
    });

    if (!rateRes.ok) {
      const err = await rateRes.text();
      throw new Error(`DAT Ratecast error ${rateRes.status}: ${err}`);
    }

    const data = await rateRes.json();

    // Pull the first perTrip forecast as the spot rate
    const perTrip = data?.forecasts?.perTrip?.[0];
    const perMile = data?.forecasts?.perMile?.[0];

    res.status(200).json({
      origin: data.origin,
      destination: data.destination,
      mileage: data.mileage,
      spotRatePerTrip: perTrip?.forecastUSD ?? null,
      spotRatePerMile: perMile?.forecastUSD ?? null,
      forecastDate: perTrip?.forecastDate ?? null,
      mae: perTrip?.mae ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
