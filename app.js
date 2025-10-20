// =================================================================
// ⚠️ 1. CONFIGURACIÓN FINAL ⚠️
// =================================================================

const CLIENT_ID = 'd3f296d31beff403db8139d10c5abfee3'; // Tu ID de cliente
const REDIRECT_URI = 'https://spotifyjam.vercel.app/'; // Tu URL de Vercel
const N8N_WEBHOOK_URL = 'https://n8n-server.griffin-paridae.ts.net/webhook/11dccc2e-717d-4de5-a35f-1066589c1a86'; // Tu URL de Webhook de n8n

let accessToken = '';

// =================================================================
// 2. AUTENTICACIÓN (Flujo de Concesión Implícita) - CORREGIDO
// =================================================================

document.getElementById('login-spotify').addEventListener('click', () => {
    const scopes = 'user-read-private user-read-email';
    
    // ✅ URL DE AUTORIZACIÓN OFICIAL DE SPOTIFY
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${REDIRECT_URI}&scope=${scopes}`;
    
    window.location = authUrl;
});

/**
 * Comprueba el hash de la URL para obtener el token después de la redirección de Spotify.
 * @returns {boolean} True si se encuentra el token.
 */
function checkAuthCallback() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    
    if (token) {
        accessToken = token;
        document.getElementById('auth-status').innerHTML = '<span class="success">✅ Conectado a Spotify.</span>';
        document.getElementById('search-container').style.display = 'flex';
        // Limpia el token de la URL sin recargar
        window.history.pushState("", document.title, window.location.pathname); 
        return true;
    }
    return false;
}

// Llama a la función al cargar la página
if (!checkAuthCallback()) {
    // Si no hay token, muestra el botón de login
    document.getElementById('auth-status').innerHTML += '<p style="color:#b3b3b3;">Debes iniciar sesión con Spotify para buscar canciones.</p>';
}

// =================================================================
// 3. BÚSQUEDA EN SPOTIFY (Usando el token temporal)
// =================================================================

document.getElementById('search-button').addEventListener('click', async () => {
    const query = document.getElementById('song-query').value.trim();
    if (!query || !accessToken) return;

    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<li>Buscando...</li>';
    document.getElementById('status').textContent = '';

    try {
        // ✅ CORRECCIÓN DE LA URL DE BÚSQUEDA
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 401) {
             document.getElementById('status').className = 'error';
             document.getElementById('status').textContent = '⚠️ Token de Spotify expirado. Por favor, inicia sesión de nuevo.';
             document.getElementById('login-spotify').style.display = 'block';
             return;
        }

        const data = await response.json();
        renderResults(data.tracks.items);

    } catch (error) {
        console.error('Error al buscar en Spotify:', error);
        resultsDiv.innerHTML = '<li style="color: red;">Error al realizar la búsqueda.</li>';
    }
});

/**
 * Muestra los resultados de la búsqueda de Spotify en la lista.
 * @param {Array} tracks Lista de objetos de canciones de Spotify.
 */
function renderResults(tracks) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    if (tracks.length === 0) {
        resultsDiv.innerHTML = '<li>No se encontraron canciones.</li>';
        return;
    }

    tracks.forEach(track => {
        const li = document.createElement('li');
        const artistNames = track.artists.map(artist => artist.name).join(', ');
        
        li.innerHTML = `
            <div>
                <strong>${track.name}</strong> - ${artistNames}
            </div>
            <button class="send-button" data-uri="${track.uri}">Enviar a n8n</button>
        `;
        
        resultsDiv.appendChild(li);

        // Añadir el listener al botón de "Enviar a n8n"
        li.querySelector('.send-button').addEventListener('click', () => {
            sendToN8n(track.uri, track.name, artistNames);
        });
    });
}

// =================================================================
// 4. ENVÍO AL WEBHOOK DE N8N
// =================================================================

/**
 * Envía el URI exacto de la canción al Webhook de n8n.
 * @param {string} uri El identificador único de la canción (spotify:track:...).
 * @param {string} name El nombre de la canción.
 * @param {string} artist El nombre del artista.
 */
async function sendToN8n(uri, name, artist) {
    const statusElement = document.getElementById('status');
    statusElement.className = '';
    statusElement.textContent = `Enviando "${name}" a tu flujo de n8n...`;

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // Este es el dato CLAVE que n8n necesita para añadir la canción
                trackUri: uri, 
                songName: name,
                artistName: artist
            })
        });

        if (response.ok) {
            statusElement.className = 'success';
            statusElement.textContent = `✅ ¡Éxito! "${name}" ha sido enviada a n8n.`;
        } else {
            const errorText = await response.text();
            statusElement.className = 'error';
            statusElement.textContent = `❌ Error de n8n (${response.status}): Falló la automatización. ${errorText}`;
        }

    } catch (error) {
        console.error('Error al enviar al webhook de n8n:', error);
        statusElement.className = 'error';
        statusElement.textContent = '❌ Error de conexión al webhook. Revisa la URL de n8n.';
    }
}