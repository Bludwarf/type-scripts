# Installation

```shell
ssh blustation
cd /volume1/Logiciels/Synology/Scripts/
git fetch --all && git reset --hard origin/master
npm install
```

# Trier enregistrement

Créer un dossier `Par série`, puis un sous-dossier pour chaque série connue.

```shell
npm run trier-enregistrements -- /volume1/video/Enregistrements/
```

TODO :

- Problème de détection du renommage avec Columbo saisons 11, 12 et 13  :
    - `Columbo - s11e01 - Meurtre au champagne - TMC - 20-12-2025 21h00 02h20 (195).m2ts`
    - `Columbo - s12e02 - Face à face - TMC - 01-11-2025 21h00 02h15 (192).m2ts`
    - `Columbo - s13e01 - Une étrange association - TMC - 14-06-2025 21h00 02h20 (176).m2ts`
- Supprimer automatiquement les épisodes déjà présents dans `\\BluStation\video\Séries` (quelle que soit l'extension)

# Renommer enregistrement

À lancer en cas de changement de nommage.

```shell
npm run renommer-enregistrements -- /volume1/video/Enregistrements/
```

# cut-m2ts.ts

**DEPRECATED** : Utiliser simplement un fichier edl à côté de la vidéo pour
Kodi. [Source](https://kodi.wiki/view/Edit_decision_list)

---

# Freebox TV Watcher

```bash
npm run freebox-tv-watch
```

- `openSession` : Ouverture de session à configurer en suivant https://dev.freebox.fr/sdk/os/login/

## TODO

- [x] Ne pas faire de boucle dans le programme
- [x] Mise en place du cron
- [x] Utiliser la plage horaire la plus longue pour déclencher le cron le moins souvent possible => 14 jours
- [x] Afficher des logs pour suivre la recherche en temps réel (aide pour le debug)
- [x] Retrouver "Meurtres au paradis" diffusé le 03/08/2026 à 22h05, actuellement introuvable via [epg](https://github.com/iptv-org/epg)
- [x] Filtrer les chaînes dès la génération du guide.json par epg (sinon fichier énorme)

## Problème de quota

Résultat actuel :

```
fetchEpgForChannel i=0
fetchEpgForChannel i=1
Error: Freebox API 429 (rate_limit) sur http://mafreebox.freebox.fr/api/v16/tv/epg/by_time/1785277020 — body: {"msg":"Too many requests","success":false,"error_code":"rate_limit"}. Pas de retry automatique sur l'EPG : attends nettement plus longtemps (quelques dizaines de minutes) avant de relancer un test, plutôt que d'enchaîner.
    at fetchJson (C:\Users\bludw\Projets\Bludwarf\Scripts Synology\src\freebox-tv-watcher.ts:437:19)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async fetchEpgForChannel (C:\Users\bludw\Projets\Bludwarf\Scripts Synology\src\freebox-tv-watcher.ts:272:21)
    at async watchOnce (C:\Users\bludw\Projets\Bludwarf\Scripts Synology\src\freebox-tv-watcher.ts:374:26)
    at async main (C:\Users\bludw\Projets\Bludwarf\Scripts Synology\src\freebox-tv-watcher.ts:393:5)
```

Quand on regarde un exemple de RawEpgEntry, on dirait qu'on pourrait utiliser le next plutôt que d'itérer sur un cursor ?

Autre piste : appeler une API externe, pour faire la recherche puis appeler l'API Freebox, uniquement si nécessaire

## Notes techniques

Ouverture d'une session :

```powershell
$appToken = "<app_token>" # Utiliser le token sauvegardé par le script dans le fichier freebox-app-token.json

$login = Invoke-RestMethod -Method GET -Uri http://mafreebox.freebox.fr/api/v4/login/
$challenge = $login.result.challenge

$hmac = New-Object System.Security.Cryptography.HMACSHA1
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($appToken)
$hashBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($challenge))
$password = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""

$body = @{ app_id = "fr.bludwarf.tvwatcher"; password = $password } | ConvertTo-Json
$session = Invoke-RestMethod -Method POST -Uri http://mafreebox.freebox.fr/api/v4/login/session/ -Body $body -ContentType "application/json"
$sessionToken = $session.result.session_token
$headers = @{ 'X-Fbx-App-Auth' = $sessionToken }
```

Vérifier la version de l'API Freebox :

```powershell
Invoke-RestMethod -Method GET -Uri http://mafreebox.freebox.fr/api_version
```

Récupération d'un programme :

```powershell
$epg = Invoke-RestMethod -Method GET -Uri "http://mafreebox.freebox.fr/api/v16/tv/epg/by_time/$now" -Headers $headers
$epg.result.'uuid-webtv-404' | ConvertTo-Json -Depth 6
```

Exemple de résultat pour la version 16 :

```json
{
  "1785273600_9f6790a4": {
    "sub_title": "Meurtre à Hollywood",
    "next": "1785276300_90ae5e05",
    "id": "pluri_1729797702",
    "duration": 2700,
    "picture": "/api/latest/tv/img/epg/programs/100x77/EMI_6090817_AG.jpg",
    "desc": "Une star de la télévision a été assassinée. Al et Carrie s\u0027immergent dans le monde très particulier des vedettes, qui entretiennent parfois de bien curieuses obsessions. La victime faisait des envieux, ce qui donne déjà une liste de suspects conséquente. Les deux enquêteurs n\u0027ont plus qu\u0027à faire leur choix...",
    "picture_big": "/api/latest/tv/img/epg/programs/168x130/EMI_6090817_AG.jpg",
    "category_name": "Série/Feuilleton",
    "title": "Unforgettable",
    "prev": "1785270900_cc453875",
    "category": 3,
    "episode_number": 12,
    "season_number": 3,
    "date": 1785273600
  },
  "1785270900_cc453875": {
    "sub_title": "Derrière le masque",
    "next": "1785273600_9f6790a4",
    "id": "pluri_1729797711",
    "duration": 2700,
    "picture": "/api/latest/tv/img/epg/programs/100x77/EMI_12353313_AG.jpg",
    "desc": "En enquêtant sur un meurtre, Al et Carrie comprennent que la victime cachait de très nombreux secrets. Ils s\u0027intéressent notamment à l\u0027agence de rencontre haut de gamme qui l\u0027employait. Au fur et à mesure qu\u0027ils découvrent tous les aspects de la vie du défunt, la liste des suspects s\u0027allonge. Trouver le coupable ne sera pas facile. La mémoire infaillible de Carrie va une nouvelle fois se révéler très utile pour éclairer les nombreuses zones d\u0027ombre de cette affaire. Y a-t-il un lien entre l\u0027agence de rencontre et le meurtre ? Faut-il fouiller dans le passé de la victime pour connaître les motivations du coupable ?...",
    "picture_big": "/api/latest/tv/img/epg/programs/168x130/EMI_12353313_AG.jpg",
    "category_name": "Série/Feuilleton",
    "title": "Unforgettable",
    "prev": "1785267900_2f81678a",
    "category": 3,
    "episode_number": 11,
    "season_number": 3,
    "date": 1785270900
  }
}
```

Liste des chaînes :

```powershell
$channels = (Invoke-RestMethod -Method GET -Uri http://mafreebox.freebox.fr/api/v16/tv/channels/ -Headers $headers).result

$channels.PSObject.Properties |
    ForEach-Object { [PSCustomObject]@{ uuid = $_.Name; name = $_.Value.name } } |
    Sort-Object name |
    Format-Table -AutoSize
```
