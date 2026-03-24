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

function extractRates(data) {
  const perTrip = data?.forecasts?.perTrip?.[0];
  const perMile = data?.forecasts?.perMile?.[0];
  return {
    perTrip: perTrip?.forecastUSD ?? null,
    perMile: perMile?.forecastUSD ?? null,
    maeHigh: perTrip?.mae?.highUSD ?? null,
    maeLow: perTrip?.mae?.lowUSD ?? null,
    forecastDate: perTrip?.forecastDate ?? null,
    mileage: data?.mileage ?? null,
    origin: data?.origin ?? null,
    destination: data?.destination ?? null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { origin, destination, equipmentCategory = 'VAN' } = req.body || {};

  const originParsed = parseLocation(origin);
  const destParsed = parseLocation(destination);

  if (!originParsed || !destParsed) {
    return res.status(400).json({ error: 'Invalid origin or destination. Use "City, ST" format.' });
  }

  try {
    const token = await getDATToken();
    const baseUrl = `${process.env.DAT_API_URL}/linehaulrates/v1/forecasts`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    const body = {
      origin: originParsed,
      destination: destParsed,
      equipmentCategory,
    };

    // Fetch spot (8DAYS) and contract (52WEEKS) in parallel
    const [spotRes, contractRes] = await Promise.all([
      fetch(`${baseUrl}/spot`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, forecastPeriod: '8DAYS' }),
      }),
      fetch(`${baseUrl}/contract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, forecastPeriod: '52WEEKS' }),
      }),
    ]);

    const [spotData, contractData] = await Promise.all([
      spotRes.ok ? spotRes.json() : null,
      contractRes.ok ? contractRes.json() : null,
    ]);

    res.status(200).json({
      spot: spotData ? extractRates(spotData) : null,
      contract: contractData ? extractRates(contractData) : null,
      equipmentCategory,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
