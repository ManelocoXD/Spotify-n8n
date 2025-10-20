// =================================================================
// ⚠️ CONFIGURACIÓN - VERIFICA ESTOS VALORES ⚠️
// =================================================================

const CLIENT_ID = 'd3f296d31bef403db8139d10c5ebfee3';
const REDIRECT_URI = 'https://spotifyjam.vercel.app/'; // ⚠️ DEBE coincidir EXACTAMENTE con Spotify Dashboard
const N8N_WEBHOOK_URL = 'https://n8n-server.griffin-paridae.ts.net/webhook/11dccc2e-717d-4de5-a35f-1066589c1a86';

let accessToken = '';

// =================================================================
// HELPER: Generar cadena aleatoria para PKCE
// =================================================================
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// =================================================================
// HELPER: Crear hash SHA256 para PKCE
// =================================================================
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

// =================================================================
// HELPER: Codificar en base64url
// =================================================================
function base64urlencode(a) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// =================================================================
// 1. AUTENTICACIÓN CON PKCE (Método Recomendado por Spotify 2024)
// =================================================================

document.getElementById('login-spotify').addEventListener('click', async () => {
    console.log('🔵 Iniciando proceso de login...');
    console.log('📍 CLIENT_ID:', CLIENT_ID);
    console.log('📍 REDIRECT_URI:', REDIRECT_URI);
    
    try {
        // Generar code_verifier y code_challenge para PKCE
        const codeVerifier = generateRandomString(64);
        const hashed = await sha256(codeVerifier);
        const codeChallenge = base64urlencode(hashed);
        
        // Guardar code_verifier en localStorage para usarlo después
        localStorage.setItem('code_verifier', codeVerifier);
        
        const scopes = 'user-read-private user-read-email';
        
        // Construir URL de autorización con PKCE
        const authUrl = new URL('https://accounts.spotify.com/authorize');
        const params = {
            client_id: CLIENT_ID,
            response_type: 'code',
            redirect_uri: REDIRECT_URI,
            scope: scopes,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge
        };
        
        authUrl.search = new URLSearchParams(params).toString();
        
        console.log('✅ Redirigiendo a Spotify...');
        console.log('🔗 URL:', authUrl.toString());
        
        // Redirigir a Spotify
        window.location.href = authUrl.toString();
        
    } catch (error) {
        console.error('❌ Error al generar autorización:', error);
        alert('Error al iniciar sesión. Revisa la consola del navegador (F12).');
    }
});

// =================================================================
// 2. INTERCAMBIO DE CÓDIGO POR TOKEN (Callback de Spotify)
// =================================================================

async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    
    if (error) {
        console.error('❌ Error de Spotify:', error);
        document.getElementById('auth-status').innerHTML = `<span class="error">❌ Error: ${error}</span>`;
        return false;
    }
    
    if (code) {
        console.log('🔵 Código de autorización recibido');
        
        const codeVerifier = localStorage.getItem('code_verifier');
        
        if (!codeVerifier) {
            console.error('❌ No se encontró code_verifier');
            return false;
        }
        
        try {
            // Intercambiar código por token
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: codeVerifier
                })
            });
            
            const data = await response.json();
            
            if (data.access_token) {
                accessToken = data.access_token;
                
                // Guardar token y tiempo de expiración
                const expiresAt = Date.now() + (data.expires_in * 1000);
                localStorage.setItem('spotify_access_token', accessToken);
                localStorage.setItem('spotify_token_expires_at', expiresAt);
                
                console.log('✅ Token obtenido exitosamente');
                
                // Limpiar code_verifier
                localStorage.removeItem('code_verifier');
                
                // Limpiar URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Actualizar UI
                updateUIAfterLogin();
                return true;
            } else {
                console.error('❌ Error al obtener token:', data);
                document.getElementById('auth-status').innerHTML = '<span class="error">❌ Error al obtener token</span>';
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error en el intercambio de token:', error);
            document.getElementById('auth-status').innerHTML = '<span class="error">❌ Error de conexión</span>';
            return false;
        }
    }
    
    return false;
}

// =================================================================
// 3. VERIFICAR TOKEN EXISTENTE AL CARGAR LA PÁGINA
// =================================================================

function checkExistingToken() {
    const storedToken = localStorage.getItem('spotify_access_token');
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    
    if (storedToken && expiresAt) {
        if (Date.now() < parseInt(expiresAt)) {
            console.log('✅ Token válido encontrado en localStorage');
            accessToken = storedToken;
            updateUIAfterLogin();
            return true;
        } else {
            console.log('⚠️ Token expirado, limpiando...');
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_token_expires_at');
        }
    }
    
    return false;
}

// =================================================================
// 4. ACTUALIZAR UI DESPUÉS DEL LOGIN
// =================================================================

function updateUIAfterLogin() {
    document.getElementById('auth-status').innerHTML = '<span class="success">✅ Conectado a Spotify</span>';
    document.getElementById('login-spotify').style.display = 'none';
    document.getElementById('search-container').style.display = 'flex';
}

// =================================================================
// 5. INICIALIZACIÓN AL CARGAR LA PÁGINA
// =================================================================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('🔵 Inicializando aplicación...');
    
    // Primero verificar si hay un token guardado
    if (checkExistingToken()) {
        return;
    }
    
    // Luego verificar si venimos del callback de Spotify
    const hasCallback = await handleCallback();
    
    if (!hasCallback) {
        console.log('ℹ️ No hay sesión activa. Mostrando botón de login.');
        document.getElementById('auth-status').innerHTML += '<p style="color:#b3b3b3;">Debes iniciar sesión con Spotify para buscar canciones.</p>';
    }
});

// =================================================================
// 6. BÚSQUEDA EN SPOTIFY
// =================================================================

document.getElementById('search-button').addEventListener('click', async () => {
    const query = document.getElementById('song-query').value.trim();
    
    if (!query) {
        alert('Por favor escribe el nombre de una canción');
        return;
    }
    
    if (!accessToken) {
        alert('Debes iniciar sesión primero');
        return;
    }

    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<li>Buscando...</li>';
    document.getElementById('status').textContent = '';

    try {
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (response.status === 401) {
            console.error('❌ Token expirado');
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_token_expires_at');
            accessToken = '';
            
            document.getElementById('status').className = 'error';
            document.getElementById('status').textContent = '⚠️ Token expirado. Por favor, inicia sesión de nuevo.';
            document.getElementById('login-spotify').style.display = 'block';
            document.getElementById('search-container').style.display = 'none';
            return;
        }

        const data = await response.json();
        renderResults(data.tracks.items);

    } catch (error) {
        console.error('❌ Error al buscar:', error);
        resultsDiv.innerHTML = '<li style="color: red;">Error al realizar la búsqueda.</li>';
    }
});

// Permitir búsqueda con Enter
document.getElementById('song-query').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('search-button').click();
    }
});

// =================================================================
// 7. RENDERIZAR RESULTADOS
// =================================================================

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

        li.querySelector('.send-button').addEventListener('click', () => {
            sendToN8n(track.uri, track.name, artistNames);
        });
    });
}

// =================================================================
// 8. ENVÍO AL WEBHOOK DE N8N
// =================================================================

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
            statusElement.textContent = `❌ Error de n8n (${response.status}): ${errorText}`;
        }

    } catch (error) {
        console.error('❌ Error al enviar a n8n:', error);
        statusElement.className = 'error';
        statusElement.textContent = '❌ Error de conexión al webhook.';
    }
}