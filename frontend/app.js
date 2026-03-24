// ── Your backend server address ──────────────────
// While developing on your laptop, this stays as is.
// When you deploy to Render later, you'll change this
// to your Render URL e.g. https://skycheck.onrender.com
const BACKEND = 'https://skycheck-vfdm.onrender.com';

// ── Helpers ──────────────────────────────────────
function showError(msg) {
  document.getElementById('error-msg').textContent = msg;
}

// renderCard() is unchanged — it still just fills the
// HTML elements with whatever data it receives.
function renderCard(data) {
  showError('');
  document.getElementById('card-city').textContent = data.city;
  document.getElementById('card-condition').textContent = data.condition;
  document.getElementById('card-temp').textContent = data.temp;
  document.getElementById('stat-humidity').textContent = data.humidity;
  document.getElementById('stat-wind').textContent = data.wind;
  document.getElementById('stat-high').textContent = data.high;
  document.getElementById('stat-low').textContent = data.low;
  document.getElementById('weather-card').style.display = 'block';
}

// ── Shared: call backend and show result ──────────
// Both handleSearch and handleLocation use this.
// "async" means this function can wait for the server
// to reply without freezing the whole page.
async function fetchAndShow(url) {
  try {
    const response = await fetch(url);  // send request, wait for reply
    const data = await response.json(); // read the JSON from the reply

    if (!response.ok) {
      // Server replied with an error (e.g. city not found)
      showError(data.error || 'Something went wrong.');
      return;
    }

    // Format and display the data
    renderCard({
      city: `${data.city}, ${data.country}`,
      condition: data.condition,
      temp: `${data.temp}°C`,
      humidity: `${data.humidity}%`,
      wind: `${data.wind} km/h`,
      high: `${data.high}°C`,
      low: `${data.low}°C`
    });

  } catch (err) {
    // This fires if the backend server isn't running at all
    showError('Cannot reach the server. Is server.py running?');
  }
}

// ── Search by city name ──────────────────────────
function handleSearch() {
  const city = document.getElementById('city-input').value.trim();
  if (!city) { showError('Please enter a city name.'); return; }
  showError('');
  fetchAndShow(`${BACKEND}/weather?city=${city}`);
}

// ── Use my location ──────────────────────────────
function handleLocation() {
  if (!navigator.geolocation) { showError('Geolocation not supported.'); return; }

  document.getElementById('location-btn').textContent = '📍 Detecting...';

  navigator.geolocation.getCurrentPosition(
    // Success: got coordinates
    function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      document.getElementById('location-btn').textContent = '📍 Use my location';
      // Call the coords endpoint on your backend
      fetchAndShow(`${BACKEND}/weather-by-coords?lat=${lat}&lon=${lon}`);
    },
    // Error: user denied permission
    function () {
      document.getElementById('location-btn').textContent = '📍 Use my location';
      showError('Location access denied. Please type a city instead.');
    }
  );
}

// ── Wire up buttons ──────────────────────────────
document.getElementById('search-btn').addEventListener('click', handleSearch);
document.getElementById('location-btn').addEventListener('click', handleLocation);
document.getElementById('city-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleSearch();
});