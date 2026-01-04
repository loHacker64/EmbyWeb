# 🔧 Istruzioni per Aggiornare l'App

Il codice è stato corretto nel repository, ma l'applicazione in esecuzione sta servendo una versione vecchia.

## Opzione 1: Se stai usando il server di sviluppo (npm start)

```bash
# 1. Ferma il server (Ctrl+C se è in esecuzione)
# 2. Pulisci la cache
rm -rf node_modules/.cache
# 3. Riavvia il server
npm start
```

Poi **apri il browser** e:
- Premi `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac) per forzare il refresh senza cache
- Oppure apri DevTools (F12) > Network > spunta "Disable cache" e ricarica

## Opzione 2: Se stai servendo una build di produzione

```bash
# 1. Reinstalla le dipendenze (se necessario)
npm install

# 2. Crea una nuova build pulita
rm -rf build/
npm run build

# 3. Servi la nuova build
# (usa il comando che stai usando per servire l'app)
```

## Opzione 3: Se stai accedendo da un server remoto

```bash
# Sul server dove gira l'app:
cd /path/to/EmbyWeb
git pull origin claude/explore-embyweb-OJPpT
npm install
rm -rf build/ node_modules/.cache
npm run build
# Riavvia il server web
```

## Verifica che funzioni

Dopo aver riavviato, apri la console del browser (F12) e dovresti vedere:

```
🎬 Video URL: https://ilmioserver.diskstation.me:8096/Videos/304344/stream?api_key=...&AudioStreamIndex=2
```

**SENZA** `.mp4`, `Container`, `DeviceId`, o `MediaSourceId` nell'URL!

---

## Cosa è stato fixato

✅ Rimosso `stream.mp4` → ora usa `/stream`
✅ Rimossi parametri `Container`, `DeviceId`, `MediaSourceId`
✅ URL semplificato che funziona con Emby
✅ Selezione traccia audio funzionante
✅ Sottotitoli supportati
