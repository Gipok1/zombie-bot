// Na początku pliku, po innych importach, dodaj moduł 'http':
const http = require('http');

const { Client, GatewayIntentBits, TextChannel } = require('discord.js');
const Gamedig = require('gamedig');
require('dotenv').config(); // Wczytaj zmienne środowiskowe z pliku .env

// Pobierz zmienne środowiskowe
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = process.env.CS16_SERVER_IP;
const SERVER_PORT = parseInt(process.env.CS16_SERVER_PORT);
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID; // ID kanału, gdzie ma być wyświetlany status
const UPDATE_INTERVAL_MINUTES = parseInt(process.env.UPDATE_INTERVAL_MINUTES || '3'); // Częstotliwość aktualizacji w minutach, domyślnie 3

// NOWA ZMIENNA ŚRODOWISKOWA: ID poprzedniej wiadomości statusu
const PREVIOUS_STATUS_MESSAGE_ID = process.env.PREVIOUS_STATUS_MESSAGE_ID;

// Zmienna globalna do przechowywania obiektu wiadomości statusu
let statusMessage = null;

// Inicjalizacja klienta Discorda
// Potrzebujemy intencji Guilds oraz GuildMessages, aby bot mógł wysyłać i edytować wiadomości.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,         // Do operacji na serwerach Discorda
        GatewayIntentBits.GuildMessages   // Do wysyłania i edytowania wiadomości
        // GatewayIntentBits.MessageContent NIE jest potrzebne, ponieważ nie przetwarzamy komend od użytkowników.
    ],
});

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
                // Nick gracza będzie teraz używany bezpośrednio.
                // Jeśli nick zawiera podkreślenia (np. Player_Name), Discord może wyświetlić go jako kursywa.
                const playerName = p.name;

                let playerStats = [];

                // Zabójstwa (score)
                if (p.score !== undefined) {
                    playerStats.push(`Fragi: ${p.score}`);
                }

                // Czas na serwerze (konwersja z sekund na minity)
                if (p.time !== undefined) {
                    const totalSeconds = Math.floor(p.time);
                    const totalMinutes = Math.round(totalSeconds / 60); // Całkowita liczba minut

                    const hours = Math.floor(totalMinutes / 60); // Ile pełnych godzin
                    const remainingMinutes = totalMinutes % 60;  // Ile minut pozostaje po odjęciu godzin
                    
                    let timeString;
                    // NOWA LOGIKA: Jeśli godziny to 0, wyświetl tylko minuty
                    if (hours === 0) {
                        timeString = `${remainingMinutes}m`;
                    } else {
                        timeString = `${hours}h ${remainingMinutes}m`;
                    }
                    playerStats.push(`Czas: ${timeString}`); // Używamy przygotowanego stringu czasu
                }

                // Łączymy statystyki
                if (playerStats.length > 0) {
                    playerListContent += `• ${playerName} (${playerStats.join(' | ')})\n`; // Używamy playerName
                } else {
                    playerListContent += `• ${playerName}\n`; // Używamy playerName
                }
            });

            if (serverInfo.players.length > maxPlayersToShow) {
                playerListContent += `\n(+${serverInfo.players.length - maxPlayersToShow} więcej...)\n`;
            }

            // Konstruujemy całą sekcję z listą graczy w bloku kodu
            playerListSection = `\n**Gracze Online:**\n\`\`\`\n${playerListContent}\`\`\``;

        } else {
            // Jeśli brak graczy, również umieszczamy to w bloku kodu
            playerListSection = '\n**Gracze online:**\n```\nBrak graczy online.\n```';
        }

        const response = `>>> **Serwer CS 1.6 Status**\n`
                         + `⭐ **Nazwa:** ${serverInfo.name}\n`
                         + `🗺️ **Mapa:** ${serverInfo.map}\n`
                         + `👥 **Gracze:** ${serverInfo.players.length}/${serverInfo.maxplayers}\n`
                         + `🔗 **Adres:** \`${SERVER_IP}:${SERVER_PORT}\``
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
            + `🔗 **Adres:** \`${SERVER_IP}:${SERVER_PORT}\`\n`
            + `**_Ostatnia aktualizacja: ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Warsaw' })}_***` // Zmieniono format czasu również tutaj!
        );
    }
}

// Zdarzenie: Bot jest gotowy i zalogowany
client.once('ready', async () => {
    console.log(`✅ Bot zalogowany jako ${client.user.tag}!`);
    console.log(`Bot będzie automatycznie aktualizować wiadomość statusu co ${UPDATE_INTERVAL_MINUTES} minuty.`);

    // WALIDACJA ZMIENNYCH ŚRODOWISKOWYCH:
    if (!TOKEN || !SERVER_IP || isNaN(SERVER_PORT) || !STATUS_CHANNEL_ID || isNaN(UPDATE_INTERVAL_MINUTES)) {
        console.error('BŁĄD: Brakuje lub są nieprawidłowe wymagane zmienne środowiskowe (.env). Upewnij się, że plik .env zawiera DISCORD_TOKEN, CS16_SERVER_IP, CS16_SERVER_PORT, STATUS_CHANNEL_ID i UPDATE_INTERVAL_MINUTES.');
        process.exit(1);
    }

    // --- ROZWIĄZANIE PROBLEMU Z HOSTINGIEM ---
    const HOSTING_PORT = process.env.PORT || 3000;
    const hostingWebServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot Discord dziala i jest zdrowy.\n');
    });
    hostingWebServer.listen(HOSTING_PORT, () => {
        console.log(`Prosty serwer webowy (do kontroli hostingu) nasłuchuje na porcie ${HOSTING_PORT}`);
        console.log('Ten serwer służy wyłącznie do sprawdzania stanu przez platformę hostingową. Funkcjonalność bota Discord NIE jest od niego zależna.');
    });
    // --- KONIEC KODU ROZWIĄZUJĄCEGO PROBLEM Z HOSTINGIEM ---


    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);

    if (!channel || !(channel instanceof TextChannel)) {
        console.error(`BŁĄD: Nie można znaleźć kanału o ID: ${STATUS_CHANNEL_ID} lub nie jest to kanał tekstowy.`);
        return;
    }

    // ***** LOGIKA: Szukanie i aktualizowanie istniejącej wiadomości *****
    if (PREVIOUS_STATUS_MESSAGE_ID) {
        try {
            const fetchedMessage = await channel.messages.fetch(PREVIOUS_STATUS_MESSAGE_ID);
            statusMessage = fetchedMessage;
            console.log(`Znaleziono poprzednią wiadomość statusu o ID: ${PREVIOUS_STATUS_MESSAGE_ID}. Będę ją aktualizować.`);
        } catch (error) {
            console.warn(`⚠️ Nie udało się znaleźć lub odczytać poprzedniej wiadomości o ID: ${PREVIOUS_STATUS_MESSAGE_ID}. Możliwe, że została usunięta lub ID jest błędne. Wysyłam nową wiadomość.`);
            statusMessage = await channel.send('Inicjuję automatyczny status serwera...');
            console.log(`Wysłano nową wiadomość statusu o ID: ${statusMessage.id}. PROSZĘ ZAKTUALIZOWAĆ LUB DODAĆ ZMIENNĄ PREVIOUS_STATUS_MESSAGE_ID W PLIKU .env I USTAWIĆ JĄ NA: ${statusMessage.id}`);
        }
    } else {
        statusMessage = await channel.send('Inicjuję automatyczny status serwera...');
        console.log(`Wysłano początkową wiadomość statusu w kanale ${channel.name} (ID: ${statusMessage.id}). ABY ZAPOBIEGAĆ WYSYŁANIU NOWYCH WIADOMOŚCI PO RESTARCIE, PROSZĘ DODAĆ ZMIENNĄ PREVIOUS_STATUS_MESSAGE_ID W PLIKU .env I USTAWIĆ JĄ NA: ${statusMessage.id}`);
    }
    // ***** KONIEC LOGIKI *****


    // Natychmiastowa pierwsza aktualizacja
    await updateServerStatusMessage();

    // Ustaw interwał dla regularnych aktualizacji
    setInterval(updateServerStatusMessage, UPDATE_INTERVAL_MINUTES * 60 * 1000);
});

// Logowanie bota do Discorda
client.login(TOKEN);
