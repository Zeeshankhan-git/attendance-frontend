let API_BASE_URL = "https://attendance-backend-1-78u4.onrender.com/api";

let currentAction = 'attendance';
let geolocationWatchId = null;
let currentLat = 13.326389;
let currentLon = 77.128889;
let capturedImageWidth = 0;
let capturedImageHeight = 0;
let map = null;
let marker = null;
let lastFetchTime = { address: 0, weather: 0 };
const FETCH_DEBOUNCE_MS = 5000;

// Initialize on page load
window.addEventListener('load', () => {
  const canvas = document.getElementById("signaturePad");
  if (!canvas || !canvas.getContext) {
    showError('parametersError', 'Canvas not supported by this browser');
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.getElementById("startCameraBtn").classList.add("hidden");
    document.getElementById("cameraFallback").classList.remove("hidden");
    showError('parametersError', 'Camera not supported. Please upload an image.');
  }
  if (!navigator.geolocation) {
    showError('parametersError', 'Geolocation not supported by this browser');
    updateLocationDisplay(currentLat, currentLon);
    fetchAddress(currentLat, currentLon);
    fetchWeather(currentLat, currentLon);
  } else {
    startGeolocation();
  }
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    updateThemeIcon(true);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(error => console.error('Service Worker registration failed:', error));
  }
  showPage('loginPage');
  updateTimestamp();
});

// Show/hide pages
function showPage(pageId, action = null) {
  document.querySelectorAll("[data-page]").forEach(section => section.classList.add("hidden"));
  const targetPage = document.getElementById(pageId);
  if (!targetPage) {
    console.error(`Page with ID ${pageId} not found`);
    return;
  }
  targetPage.classList.remove("hidden");

  if (pageId === 'parametersPage') {
    currentAction = action || 'attendance';
    const username = sessionStorage.getItem("loggedInUser") || "User";
    document.getElementById("parametersTitle").innerText = `Mark ${currentAction.charAt(0).toUpperCase() + currentAction.slice(1)} for ${username}`;
    document.getElementById("submitBtn").innerText = `Submit ${currentAction.charAt(0).toUpperCase() + currentAction.slice(1)}`;
    resetParametersPage();
    startGeolocation();
  } else {
    stopGeolocation();
    const video = document.getElementById("cameraPreview");
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }
  if (pageId === 'homePage') {
    document.getElementById("usernameDisplay").innerText = sessionStorage.getItem("loggedInUser") || "User";
  }
  if (pageId === 'landingPage') {
    document.getElementById("landingUsername").innerText = sessionStorage.getItem("loggedInUser") || "User";
  }
  if (pageId === 'adminPage') {
    fetchAdminRecords();
  }
  if (pageId === 'signupPage' || pageId === 'loginPage') {
    clearErrors();
  }
}

// Theme toggle
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.innerHTML = isDark
      ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
      : '<path d="M12 2v2m0 16v2m10-10h-2m-16 0H2m17.07-7.07l-1.42 1.42M5.35 17.65l-1.42 1.42M17.65 17.65l-1.42-1.42M5.35 5.35l-1.42-1.42M12 6a6 6 0 100 12 6 6 0 000-12z"/>';
  }
}

// Update timestamp
function updateTimestamp() {
  const timestampEl = document.getElementById("timestamp");
  if (timestampEl) {
    setInterval(() => {
      timestampEl.innerText = new Date().toLocaleString('en-US', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      });
    }, 1000);
  }
}

// Geolocation
function startGeolocation() {
  if (navigator.geolocation) {
    geolocationWatchId = navigator.geolocation.watchPosition(
      position => {
        currentLat = position.coords.latitude;
        currentLon = position.coords.longitude;
        updateLocationDisplay(currentLat, currentLon);
        fetchAddress(currentLat, currentLon);
        fetchWeather(currentLat, currentLon);
      },
      error => {
        showError('parametersError', `Geolocation error: ${error.message}`);
        updateLocationDisplay(currentLat, currentLon);
        fetchAddress(currentLat, currentLon);
        fetchWeather(currentLat, currentLon);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }
}

function stopGeolocation() {
  if (geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }
}

function updateLocationDisplay(lat, lon) {
  const locationEl = document.getElementById("location");
  if (locationEl) locationEl.innerText = convertToDMS(lat, lon);
}

// Error handling
function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.innerText = message;
    errorEl.classList.remove("hidden");
  }
}

function clearErrors() {
  ['signupError', 'loginError', 'parametersError', 'locationError'].forEach(id => {
    const errorEl = document.getElementById(id);
    if (errorEl) {
      errorEl.innerText = '';
      errorEl.classList.add('hidden');
    }
  });
}

// Reset parameters page
function resetParametersPage() {
  const video = document.getElementById("cameraPreview");
  const img = document.getElementById("capturedImage");
  const captureBtn = document.getElementById("captureBtn");
  const startCameraBtn = document.getElementById("startCameraBtn");
  const clearBtn = document.getElementById("clearBtn");
  const descriptionBox = document.getElementById("descriptionBox");
  const cameraFallback = document.getElementById("cameraFallback");

  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  if (video) video.classList.remove("hidden");
  if (img) {
    img.classList.add("hidden");
    img.src = "";
  }
  if (captureBtn) captureBtn.classList.add("hidden");
  if (startCameraBtn) startCameraBtn.classList.remove("hidden");
  if (clearBtn) clearBtn.classList.add("hidden");
  if (cameraFallback) cameraFallback.classList.add("hidden");
  clearSignature();
  if (descriptionBox) descriptionBox.value = "";
  clearErrors();

  // Automatically start the camera
  startCamera();
}

// Signup
async function handleSignup() {
  const name = document.getElementById("signupUser")?.value.trim();
  const password = document.getElementById("signupPass")?.value.trim();

  if (!name || !password) {
    showError('signupError', 'Please enter both username and password');
    return;
  }
  if (name.length < 3) {
    showError('signupError', 'Username must be at least 3 characters');
    return;
  }
  if (password.length < 6) {
    showError('signupError', 'Password must be at least 6 characters');
    return;
  }

  const email = name;

  try {
    const body = new URLSearchParams({ email, password, name }).toString();

    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const text = await response.text();

    if (response.ok) {
      alert("Signup successful!");
      document.getElementById("signupUser").value = "";
      document.getElementById("signupPass").value = "";
      showPage('loginPage');
    } else {
      showError('signupError', text || 'Signup failed');
    }
  } catch (err) {
    showError('signupError', 'Cannot connect to server. Ensure backend is running.');
  }
}

// Login
async function handleLogin() {
  const username = document.getElementById("loginUser")?.value.trim();
  const password = document.getElementById("loginPass")?.value.trim();

  if (!username || !password) {
    showError('loginError', 'Please enter both username and password');
    return;
  }

  const email = username;

  try {
    const body = new URLSearchParams({ email, password }).toString();

    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const text = await response.text();

    if (response.ok) {
      sessionStorage.setItem("loggedInUser", email);
      sessionStorage.setItem("isAdmin", "false");
      document.getElementById("loginUser").value = "";
      document.getElementById("loginPass").value = "";
      showPage('landingPage');
    } else {
      showError('loginError', text || 'Login failed');
    }
  } catch (err) {
    showError('loginError', 'Cannot connect to server. Ensure backend is running.');
  }
}

// Logout
function logout() {
  sessionStorage.removeItem("loggedInUser");
  sessionStorage.removeItem("isAdmin");
  clearSignature();
  stopGeolocation();
  const video = document.getElementById("cameraPreview");
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  showPage("loginPage");
}

// Admin records
async function fetchAdminRecords() {
  const recordsDiv = document.getElementById("adminRecords");
  if (!recordsDiv) return;

  if (sessionStorage.getItem("isAdmin") !== "true") {
    recordsDiv.innerHTML = "<p>You do not have admin access.</p>";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/records`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (response.ok && data.status === 'success') {
      recordsDiv.innerHTML = data.records?.length
        ? data.records.map(record => `
          <p><strong>User:</strong> ${record.username} | <strong>Action:</strong> ${record.action} | <strong>Time:</strong> ${new Date(record.timestamp).toLocaleString()}</p>
        `).join('')
        : "<p>No records found.</p>";
    } else {
      recordsDiv.innerHTML = "<p>Failed to load records.</p>";
    }
  } catch (err) {
    recordsDiv.innerHTML = "<p>Error: Cannot connect to server.</p>";
  }
}

// Submit attendance/exit
async function submitAction() {
  const username = sessionStorage.getItem("loggedInUser");
  const location = document.getElementById("location")?.innerText;
  const signature = document.getElementById("signaturePad")?.toDataURL("image/png");
  const image = document.getElementById("capturedImage")?.src || "";
  const description = document.getElementById("descriptionBox")?.value.trim() || "";
  const endpoint = currentAction === 'attendance' ? '/attendance' : '/exit';

  if (!username) {
    showError('parametersError', 'Please login first');
    return;
  }
  if (!location || location === 'Fetching...' || location.includes('Unable')) {
    showError('parametersError', 'Location not available');
    return;
  }
  const canvas = document.getElementById("signaturePad");
  const emptyCanvas = document.createElement("canvas");
  emptyCanvas.width = canvas.width;
  emptyCanvas.height = canvas.height;
  if (canvas.toDataURL('image/png') === emptyCanvas.toDataURL('image/png')) {
    showError('parametersError', 'Please provide a signature');
    return;
  }
  if (!image) {
    showError('parametersError', 'Please capture a selfie');
    return;
  }
  console.log(`Submitting with image dimensions: ${capturedImageWidth}x${capturedImageHeight}`);

  const submissionData = {
    username,
    location: `${currentLat},${currentLon}`,
    latitude: currentLat,
    longitude: currentLon,
    signature,
    image,
    description
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submissionData)
    });
    const data = await response.json();
    if (response.ok && data.status === 'success') {
      alert(`${currentAction === 'attendance' ? 'Attendance' : 'Exit'} marked successfully!`);
      resetParametersPage();
      showPage('homePage');
    } else {
      showError('parametersError', data.message || 'Submission failed');
    }
  } catch (err) {
    showError('parametersError', 'Cannot connect to server');
  }
}

// Modal handling
function closeModal() {
  const modal = document.getElementById("mismatchModal");
  if (modal) modal.classList.add("hidden");
}

function openLocationModal() {
  const modal = document.getElementById("locationModal");
  if (modal) {
    modal.classList.remove("hidden");
    document.getElementById("customLocationName").value = "";
    document.getElementById("selectedLat").innerText = "Click on map";
    document.getElementById("selectedLon").innerText = "Click on map";
    document.getElementById("customLatitude").value = "";
    document.getElementById("customLongitude").value = "";
    clearErrors();
    initializeMap();
  }
}

function closeLocationModal() {
  const modal = document.getElementById("locationModal");
  if (modal) {
    modal.classList.add("hidden");
    if (map) {
      map.remove();
      map = null;
      marker = null;
    }
    clearErrors();
  }
}

function initializeMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  map = L.map('map').setView([currentLat, currentLon], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
    document.getElementById("selectedLat").innerText = lat.toFixed(6);
    document.getElementById("selectedLon").innerText = lng.toFixed(6);
    document.getElementById("customLatitude").value = lat;
    document.getElementById("customLongitude").value = lng;
  });

  // Add initial marker at current location
  marker = L.marker([currentLat, currentLon]).addTo(map);
  document.getElementById("selectedLat").innerText = currentLat.toFixed(6);
  document.getElementById("selectedLon").innerText = currentLon.toFixed(6);
  document.getElementById("customLatitude").value = currentLat;
  document.getElementById("customLongitude").value = currentLon;
}

async function saveCustomLocation() {
  const locationName = document.getElementById("customLocationName")?.value.trim();
  const latitude = parseFloat(document.getElementById("customLatitude")?.value);
  const longitude = parseFloat(document.getElementById("customLongitude")?.value);

  if (!locationName) {
    showError('locationError', 'Please enter a location name');
    return;
  }
  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    showError('locationError', 'Please select a valid location on the map');
    return;
  }
  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    showError('locationError', 'Please select a valid location on the map');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/save-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: sessionStorage.getItem("loggedInUser"),
        name: locationName,
        latitude,
        longitude
      })
    });
    const data = await response.json();
    if (response.ok && data.status === 'success') {
      currentLat = latitude;
      currentLon = longitude;
      updateLocationDisplay(currentLat, currentLon);
      fetchAddress(currentLat, currentLon);
      fetchWeather(currentLat, currentLon);
      alert(`Location "${locationName}" saved successfully!`);
      closeLocationModal();
    } else {
      showError('locationError', data.message || 'Failed to save location');
    }
  } catch (err) {
    console.error('Save location error:', err);
    showError('locationError', 'Cannot connect to server');
  }
}

// Utility functions
function convertToDMS(lat, lon) {
  const toDMS = (coord, isLat) => {
    const abs = Math.abs(coord);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = Math.floor((abs - deg - min / 60) * 3600);
    const dir = coord >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
    return `${deg}°${min}'${sec}"${dir}`;
  };
  return `${toDMS(lat, true)} ${toDMS(lon, false)}`;
}

async function fetchAddress(lat, lon) {
  const addressEl = document.getElementById("address");
  if (!addressEl) return;
  const now = Date.now();
  if (now - lastFetchTime.address < FETCH_DEBOUNCE_MS) return;
  lastFetchTime.address = now;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    addressEl.innerText = data.display_name || "Not available";
  } catch (err) {
    console.error('Address fetch error:', err);
    addressEl.innerText = "Error fetching address";
    setTimeout(() => addressEl.innerText = "Not available", 1000);
  }
}

async function fetchWeather(lat, lon) {
  const weatherEl = document.getElementById("weather");
  if (!weatherEl) return;
  const now = Date.now();
  if (now - lastFetchTime.weather < FETCH_DEBOUNCE_MS) return;
  lastFetchTime.weather = now;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}¤t_weather=true`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    if (data.current_weather) {
      const { temperature, weathercode } = data.current_weather;
      const weatherDesc = {
        0: 'Clear',
        1: 'Mostly Clear',
        2: 'Partly Cloudy',
        3: 'Overcast',
        61: 'Rain',
        80: 'Showers'
      }[weathercode] || 'Unknown';
      weatherEl.innerText = `${temperature}°C, ${weatherDesc}`;
    } else {
      weatherEl.innerText = "Weather data unavailable";
    }
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    weatherEl.innerText = "Unable to fetch weather";
    setTimeout(() => fetchWeather(lat, lon), 10000);
  }
}

function openGoogleMaps() {
  if (currentLat && currentLon) {
    window.open(`https://www.google.com/maps?q=${currentLat},${currentLon}`, '_blank');
  } else {
    showError('parametersError', 'Location not available');
  }
}

// Camera handling
async function startCamera() {
  const video = document.getElementById("cameraPreview");
  const captureBtn = document.getElementById("captureBtn");
  const startCameraBtn = document.getElementById("startCameraBtn");
  const clearBtn = document.getElementById("clearBtn");
  const cameraFallback = document.getElementById("cameraFallback");

  if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('parametersError', 'Camera not supported. Please upload an image.');
    video.classList.add("hidden");
    cameraFallback.classList.remove("hidden");
    return;
  }

  try {
    // Dynamically set video constraints based on device orientation
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;
    const constraints = {
      video: {
        facingMode: "user",
        width: { ideal: isPortrait ? 480 : 640, max: 1280 },
        height: { ideal: isPortrait ? 640 : 480, max: 720 },
        aspectRatio: isPortrait ? 0.75 : 1.3333 // 3:4 for portrait, 4:3 for landscape
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      video.classList.remove("hidden");
      captureBtn.classList.remove("hidden");
      startCameraBtn.classList.add("hidden");
      clearBtn.classList.add("hidden");
      cameraFallback.classList.add("hidden");
      console.log(`Camera resolution: ${video.videoWidth}x${video.videoHeight}`);
    };
  } catch (err) {
    showError('parametersError', `Camera error: ${err.message}`);
    if (err.name === 'NotAllowedError') {
      showError('parametersError', 'Camera access denied. Please allow camera permissions.');
    }
    console.error('Camera initialization failed:', err);
    video.classList.add("hidden");
    cameraFallback.classList.remove("hidden");
  }
}

async function captureImage() {
  const video = document.getElementById("cameraPreview");
  const img = document.getElementById("capturedImage");
  const captureBtn = document.getElementById("captureBtn");
  const startCameraBtn = document.getElementById("startCameraBtn");
  const clearBtn = document.getElementById("clearBtn");

  if (!video || !img || !video.srcObject) {
    showError('parametersError', 'Camera not started');
    return;
  }

  const width = video.videoWidth;
  const height = video.videoHeight;

  if (width < 320 || height < 240) {
    showError('parametersError', `Please capture a valid selfie (min 320x240). Current: ${width}x${height}`);
    return;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;

  // Detect device orientation
  const isDevicePortrait = window.matchMedia("(orientation: portrait)").matches;
  const isVideoPortrait = height > width;

  // Adjust for mobile devices
  if (/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    // Mirror horizontally (front camera is typically mirrored)
    ctx.scale(-1, 1);
    // Adjust rotation based on device and video orientation
    if (isDevicePortrait && !isVideoPortrait) {
      ctx.rotate((90 * Math.PI) / 180);
      canvas.width = height;
      canvas.height = width;
    } else if (!isDevicePortrait && isVideoPortrait) {
      ctx.rotate((-90 * Math.PI) / 180);
      canvas.width = height;
      canvas.height = width;
    }
    ctx.translate(-width / 2, -height / 2);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, width, height);
  }

  img.src = canvas.toDataURL("image/png");
  img.classList.remove("hidden");
  video.classList.add("hidden");
  captureBtn.classList.add("hidden");
  startCameraBtn.classList.add("hidden");
  clearBtn.classList.remove("hidden");

  capturedImageWidth = canvas.width;
  capturedImageHeight = canvas.height;
  console.log(`Captured image dimensions set: ${capturedImageWidth}x${capturedImageHeight}`);

  video.srcObject.getTracks().forEach(track => track.stop());
  video.srcObject = null;
}

function clearImage() {
  const img = document.getElementById("capturedImage");
  const captureBtn = document.getElementById("captureBtn");
  const clearBtn = document.getElementById("clearBtn");
  const cameraFallback = document.getElementById("cameraFallback");

  if (img) {
    img.src = "";
    img.classList.add("hidden");
  }
  captureBtn.classList.remove("hidden");
  clearBtn.classList.add("hidden");
  cameraFallback.classList.add("hidden");
  capturedImageWidth = 0;
  capturedImageHeight = 0;
  startCamera();
}

// Camera fallback for devices without WebRTC
document.getElementById("cameraFallback").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.getElementById("capturedImage");
      img.src = reader.result;
      img.classList.remove("hidden");
      document.getElementById("cameraPreview").classList.add("hidden");
      document.getElementById("captureBtn").classList.add("hidden");
      document.getElementById("clearBtn").classList.remove("hidden");
      document.getElementById("cameraFallback").classList.add("hidden");
      const tempImg = new Image();
      tempImg.src = reader.result;
      tempImg.onload = () => {
        capturedImageWidth = tempImg.width;
        capturedImageHeight = tempImg.height;
        console.log(`Fallback image dimensions: ${capturedImageWidth}x${capturedImageHeight}`);
      };
    };
    reader.readAsDataURL(file);
  }
});

// Handle orientation changes
window.addEventListener('orientationchange', () => {
  const video = document.getElementById("cameraPreview");
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    setTimeout(startCamera, 200); // Increased delay to ensure orientation stabilizes
  }
});

// Signature handling
const canvas = document.getElementById("signaturePad");
const ctx = canvas ? canvas.getContext("2d") : null;
let isDrawing = false, lastX = 0, lastY = 0;

if (canvas && ctx) {
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);
  canvas.addEventListener("touchstart", startDrawingTouch, { passive: false });
  canvas.addEventListener("touchmove", drawTouch, { passive: false });
  canvas.addEventListener("touchend", stopDrawing);

  function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }

  function draw(e) {
    if (!isDrawing) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function startDrawingTouch(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    [lastX, lastY] = [touch.clientX - rect.left, touch.clientY - rect.top];
    isDrawing = true;
  }

  function drawTouch(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left, y = touch.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
    [lastX, lastY] = [x, y];
  }
}

function clearSignature() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  const descriptionBox = document.getElementById("descriptionBox");
  if (descriptionBox) descriptionBox.value = "";
}