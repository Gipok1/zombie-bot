// Funkcja do pobierania informacji o serwerze i aktualizacji wiadomości statusu
async function updateServerStatusMessage() {
    if (!statusMessage) {
        console.error('❌ Wiadomość statusu nie została zainicjowana. Nie można zaktualizować.');
        return;
    }

    try {
        const serverInfo = await Gamedig.query({
            type: 'cs16',
            host: SERVER_IP,
            port: SERVER_PORT,
            timeout: 5000 // Czas oczekiwania na odpowiedź serwera (5 sekund)
        });

        let playerListContent = ''; // Zawartość, która znajdzie się WEWNĄTRZ bloku kodu
        let playerListSection = ''; // Cała sekcja z listą graczy, włącznie z nagłówkiem i blokiem kodu

        if (serverInfo.players && serverInfo.players.length > 0) {
            // Sortujemy graczy np. według punktacji (jeśli dostępna), a potem alfabetycznie
            const sortedPlayers = serverInfo.players.sort((a, b) => {
                // Jeśli obie mają punkty, sortuj według punktów malejąco
                if (a.score !== undefined && b.score !== undefined) {
                    return b.score - a.score;
                }
                // W przeciwnym razie sortuj alfabetycznie po nazwie
                return a.name.localeCompare(b.name);
            });

            const maxPlayersToShow = 25; // Zwiększono limit wyświetlanych graczy!
            const playersToShow = sortedPlayers.slice(0, maxPlayersToShow);

            playersToShow.forEach(p => {
                // === ZMIANA TUTAJ: USUNIĘTO ESCAPE'OWANIE UNDERSCORE'ÓW ===
                // const escapedName = p.name.replace(/_/g, '\\_'); // Ta linia jest teraz zbędna
                const playerName = p.name; // Używamy oryginalnej nazwy gracza

                let playerStats = [];

                // Zabójstwa (score)
                if (p.score !== undefined) {
                    playerStats.push(`Fragi: ${p.score}`);
                }
                // Śmierci (deaths)
                if (p.deaths !== undefined) {
                    playerStats.push(`Smierci: ${p.deaths}`);
                }
                // Czas na serwerze (konwersja z sekund na minuty)
                if (p.time !== undefined) {
                    const totalSeconds = Math.floor(p.time);
                    // Zaokrąglamy do najbliższej pełnej minuty
                    const totalMinutes = Math.round(totalSeconds / 60);

                    playerStats.push(`Czas: ${totalMinutes}min.`);
                }

                // Łączymy statystyki
                if (playerStats.length > 0) {
                    playerListContent += `• ${playerName} (${playerStats.join(' | ')})\n`; // Używamy playerName
                } else {
                    playerListContent += `• ${playerName}\n`; // Używamy playerName, jeśli brak statystyk
                }
            });

            if (serverInfo.players.length > maxPlayersToShow) {
                playerListContent += `\n(+${serverInfo.players.length - maxPlayersToShow} więcej...)\n`;
            }

            // Konstruujemy całą sekcję z listą graczy w bloku kodu
            playerListSection = `\n**Gracze online:**\n\`\`\`\n${playerListContent}\`\`\``;

        } else {
            // Jeśli brak graczy, również umieszczamy to w bloku kodu
            playerListSection = '\n**Gracze online:**\n```\nBrak graczy online.\n```';
        }

        const response = `>>> **Serwer CS 1.6 Status**\n`
                             + `⭐ **Nazwa:** ${serverInfo.name}\n`
                             + `🗺️ **Mapa:** ${serverInfo.map}\n`
                             + `👥 **Gracze:** ${serverInfo.players.length}/${serverInfo.maxplayers}\n`
                             + `🔗 **Adres:** \`<span class="math-inline">\{SERVER\_IP\}\:</span>{SERVER_PORT}\``
                             + `${playerListSection}\n` // Używamy nowej zmiennej zawierającej blok kodu
                             + `_Ostatnia aktualizacja: ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Warsaw' })}_`; // Zmieniono format czasu!

        await statusMessage.edit(response);
        console.log('✅ Status serwera w wiadomości zaktualizowany pomyślnie.');

    } catch (error) {
        console.error('❌ Wystąpił błąd podczas pobierania informacji o serwerze CS 1.6:', error.message);
        // Zaktualizuj wiadomość, aby pokazać, że serwer jest offline lub wystąpił błąd
        await statusMessage.edit(
            `>>> **Serwer CS 1.6 Status**\n`
            + `🔴 **Status:** Offline lub brak odpowiedzi\n`
            + `🔗 **Adres:** \`<span class="math-inline">\{SERVER\_IP\}\:</span>{SERVER_PORT}\`\n`
            + `_Ostatnia aktualizacja: ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Warsaw' })}_` // Zmieniono format czasu również tutaj!
        );
    }
}
