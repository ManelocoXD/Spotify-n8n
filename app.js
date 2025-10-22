 // =================================================================
        // CONFIGURACIÓN
        // =================================================================
        const N8N_SEARCH_WEBHOOK = 'https://n8n-server.griffin-paridae.ts.net/webhook/Busqueda';
        const N8N_ADD_WEBHOOK = 'https://n8n-server.griffin-paridae.ts.net/webhook/Añadir';
        // =================================================================
        // EVENT LISTENERS
        // =================================================================
        document.getElementById('search-button').addEventListener('click', searchSong);
        
        document.getElementById('song-query').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchSong();
            }
        });

        // =================================================================
        // BÚSQUEDA
        // =================================================================
        async function searchSong() {
            const query = document.getElementById('song-query').value.trim();
            
            if (!query) {
                showStatus('Por favor escribe el nombre de una canción', 'warning');
                return;
            }

            const resultsDiv = document.getElementById('results');
            const searchButton = document.getElementById('search-button');
            const statusElement = document.getElementById('status');
            
            // Deshabilitar botón mientras se busca
            searchButton.disabled = true;
            searchButton.innerHTML = '<span class="spinner">⏳</span> Buscando...';
            
            resultsDiv.innerHTML = '<li class="loading"><span class="spinner">🔍</span> Buscando en Spotify...</li>';
            statusElement.textContent = '';

            try {
                const response = await fetch(N8N_SEARCH_WEBHOOK, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        query: query
                    })
                });

                if (!response.ok) {
                    throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                console.log('Respuesta de n8n:', data);
                
                // El workflow devuelve directamente el array de tracks o un objeto con tracks
                const tracks = Array.isArray(data) ? data : (data.tracks || []);
                
                if (tracks.length === 0) {
                    resultsDiv.innerHTML = '<li>😕 No se encontraron canciones con ese nombre</li>';
                    showStatus('Intenta con otro término de búsqueda', 'warning');
                } else {
                    // Siempre mostrar resultados para que el usuario elija
                    renderResults(tracks);
                    showStatus(`Se encontraron ${tracks.length} resultado(s). Selecciona la canción:`, 'info');
                }

            } catch (error) {
                console.error('Error:', error);
                resultsDiv.innerHTML = '';
                
                if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                    showStatus('❌ No se puede conectar con el servidor. Verifica que n8n esté en línea', 'error');
                } else {
                    showStatus(`❌ Error: ${error.message}`, 'error');
                }
            } finally {
                searchButton.disabled = false;
                searchButton.innerHTML = '🔍 Buscar';
            }
        }

        // =================================================================
        // RENDERIZAR RESULTADOS
        // =================================================================
        // =================================================================
        // RENDERIZAR RESULTADOS (VERSIÓN CORREGIDA)
        // =================================================================
        function renderResults(tracks) {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '';

            if (!tracks || tracks.length === 0) {
                resultsDiv.innerHTML = '<li>No se encontraron canciones.</li>';
                return;
            }

            // 'tracks' es el array de JSON que recibimos
            tracks.forEach(track => {
                const li = document.createElement('li');
                
                // 1. Procesamos los artistas
                // track.artists es un array de objetos, los unimos en un string
                const artistNames = track.artists.map(artist => artist.name).join(', ');

                // 2. Procesamos el nombre del álbum
                // track.album es un objeto, sacamos su 'name'
                const albumName = track.album.name;

                // 3. Procesamos la carátula
                // track.album.images es un array, usamos la imagen mediana (índice 1) o la pequeña (índice 2)
                const albumArtUrl = (track.album.images && track.album.images.length > 0)
                                    ? track.album.images[1].url // Índice 1 es 300x300px
                                    : ''; // Fallback por si no hay imagen

                // 4. Construimos el HTML con las variables correctas
                li.innerHTML = `
                    <div class="track-info">
                        ${albumArtUrl ? `<img src="${albumArtUrl}" alt="Album" class="album-art">` : ''}
                        <div class="track-details">
                            <div class="track-name">${escapeHtml(track.name)}</div>
                            <div class="track-artist">${escapeHtml(artistNames)}</div>
                            ${albumName ? `<div class="track-album">${escapeHtml(albumName)}</div>` : ''}
                        </div>
                    </div>
                    <button class="send-button">✓ Añadir</button>
                `;
                
                resultsDiv.appendChild(li);

                // 5. Asignamos el listener al botón
                li.querySelector('.send-button').addEventListener('click', () => {
                    // Pasamos el URI de la canción, el nombre y el string de artistas
                    addToQueue(track.uri, track.name, artistNames);
                });
            });
        }
        // =================================================================
        // AÑADIR A COLA (selección manual)
        // =================================================================
        async function addToQueue(uri, name, artist) {
            const statusElement = document.getElementById('status');
            const resultsDiv = document.getElementById('results');
            
            statusElement.className = 'info';
            statusElement.textContent = `⏳ Añadiendo "${name}" a la cola...`;

            try {
                const response = await fetch(N8N_ADD_WEBHOOK, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        uri: uri
                    })
                });

                if (!response.ok) {
                    throw new Error(`Error del servidor: ${response.status}`);
                }

                // Respuesta exitosa (puede ser 204 No Content o JSON)
                resultsDiv.innerHTML = '';
                showStatus(`✅ ¡Perfecto! "${name}" se ha añadido a la cola`, 'success');
                document.getElementById('song-query').value = '';

            } catch (error) {
                console.error('Error:', error);
                showStatus(`❌ Error al añadir la canción: ${error.message}`, 'error');
            }
        }

        // =================================================================
        // UTILIDADES
        // =================================================================
        function showStatus(message, type) {
            const statusElement = document.getElementById('status');
            statusElement.className = type;
            statusElement.textContent = message;
        }

        // ESTA ES LA VERSIÓN CORREGIDA
function escapeHtml(text) {
    // ¡NUEVO! Comprueba si el texto es nulo, indefinido o no es un string
    if (typeof text !== 'string') {
        return ''; // Devuelve una cadena vacía en lugar de 'crashear'
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}