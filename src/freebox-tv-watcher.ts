/**
 * freebox-tv-watcher.ts
 *
 * Surveille un guide TV externe (JSON, généré quotidiennement par un outil
 * comme iptv-org/epg) et programme automatiquement l'enregistrement d'un
 * film/série dont le titre matche une watchlist, via l'API PVR de la
 * Freebox.
 *
 * On n'appelle PLUS l'EPG de la Freebox (/tv/epg/...) : cet endpoint est
 * sévèrement rate-limité (429 "rate_limit" persistant, voir historique du
 * projet) et surtout inutile ici — POST /pvr/programmed/ n'a besoin que de
 * channel_uuid + start + end + name, jamais de l'id de programme Freebox.
 * Seul /tv/channels/ (jamais vu rate-limité) sert encore, et une seule fois,
 * pour connaître les channel_uuid.
 *
 * Ne gère PAS le déplacement des fichiers enregistrés (déjà couvert par
 * ton script existant qui vide la clé USB chaque matin).
 *
 * Requiert Node 18+ (fetch natif) et TypeScript (`ts-node` ou compilation).
 *   npm install --save-dev typescript ts-node @types/node
 *
 * Guide EPG externe : généré avec iptv-org/epg, ex. :
 *   npm run grab -- --sites=tv-programme.telecablesat.fr --json
 * Format confirmé sur un extrait réel : objet {date, channels, programs},
 * avec start/stop en millisecondes et titres dans programs[].titles[].value
 * (voir ExternalGuide plus bas). À exécuter périodiquement (cron) pour
 * rafraîchir le guide.json consommé par ce script.
 */

import {readFile, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {createHmac} from "node:crypto";
import {toDate} from "./date-utils";
import {pad} from "./string-utils";

// ---------------------------------------------------------------------------
// Logger — sorties lisibles (horodatage + icône + couleur), pour suivre le
// déroulement du script et faciliter le debug, sans dépendance externe.
// ---------------------------------------------------------------------------

const ANSI = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
};

function timestamp(): string {
    return new Date().toISOString().slice(11, 19); // HH:MM:SS
}

export const logger = {
    section(title: string): void {
        console.log(`\n${ANSI.bold}${ANSI.magenta}▶ ${title}${ANSI.reset}`);
    },
    info(message: string): void {
        console.log(`${ANSI.dim}[${timestamp()}]${ANSI.reset} ${ANSI.cyan}ℹ${ANSI.reset}  ${message}`);
    },
    success(message: string): void {
        console.log(`${ANSI.dim}[${timestamp()}]${ANSI.reset} ${ANSI.green}✔${ANSI.reset}  ${message}`);
    },
    warn(message: string): void {
        console.warn(`${ANSI.dim}[${timestamp()}]${ANSI.reset} ${ANSI.yellow}⚠${ANSI.reset}  ${message}`);
    },
    error(message: string): void {
        console.error(`${ANSI.dim}[${timestamp()}]${ANSI.reset} ${ANSI.red}✖${ANSI.reset}  ${message}`);
    },
    detail(message: string): void {
        // Pour le détail verbeux (ex. liste des programmes scannés), en plus
        // discret que info() pour ne pas noyer les événements importants.
        console.log(`${ANSI.dim}[${timestamp()}]   ${message}${ANSI.reset}`);
    },
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Hôte de la Freebox en local. Utilise le api_domain fourni par
 *  /api_version à la place si tu veux du HTTPS depuis l'extérieur. */
const FREEBOX_HOST = "http://mafreebox.freebox.fr";

/** Base URL de l'API, résolue dynamiquement au démarrage (voir resolveApiBase). */
let FREEBOX_API_BASE = "";

async function resolveApiBase(): Promise<string> {
    // NOTE : /api_version ne suit pas l'enveloppe {success, result} des autres
    // endpoints, d'où un fetch brut plutôt que fetchJson() ici.
    const res = await fetch(`${FREEBOX_HOST}/api_version`);
    const info = (await res.json()) as { api_version: string };
    const major = info.api_version.split(".")[0];
    return `${FREEBOX_HOST}/api/v${major}`;
}

/** Identité de l'application, déclarée une fois lors du premier appairage. */
const APP_INFO = {
    app_id: "fr.bludwarf.tvwatcher",
    app_name: "TV Watcher",
    app_version: "1.0.0",
    device_name: "NAS",
};

/** Fichier local où l'app_token (secret, obtenu une seule fois) est stocké. */
const TOKEN_FILE = "./freebox-app-token.json";

/** Chemin du guide.json généré périodiquement par un conteneur Docker
 *  éphémère (iptv-org/epg lancé en one-shot via le Planificateur de tâches
 *  du Synology, cf. `docker run --rm -v .../output:/epg/public ...`), pas
 *  par un serveur permanent.
 *  NOTE : ce chemin suppose que ce script tourne sur le même NAS que le
 *  volume de sortie. S'il tourne ailleurs, pointe vers le partage réseau
 *  correspondant (ex. un chemin SMB monté). */
const EPG_JSON_PATH = "/volume1/docker/epg/data/guide.json";

/** Chaînes à surveiller : nom → { channel_uuid Freebox, id de la chaîne
 *  dans le guide JSON externe }.
 *  TODO : freeboxUuid se récupère via GET /tv/channels/ (une seule fois,
 *  jamais vu rate-limité). epgChannelId correspond au xmltv_id du guide.json
 *  (ex. "Arte.de@France" observé pour Arte) — regarde le tableau `channels`
 *  du guide généré pour TF1/TMC/France 2, ou le fichier de config du site
 *  tv-programme.telecablesat.fr dans le dépôt iptv-org/epg. */
interface WatchedChannel {
    freeboxUuid: string;
    epgChannelId: string;
}

const WATCHED_CHANNELS: Record<string, WatchedChannel> = {
    // "France 2": {freeboxUuid: "uuid-webtv-201", epgChannelId: "France2.fr"},
    "France 2": {freeboxUuid: "uuid-webtv-201", epgChannelId: "France2.fr@SD"}, // site : programme-tv.net
    "TMC": {freeboxUuid: "uuid-webtv-497", epgChannelId: "TMC.fr@SD"}, // site : programme-tv.net
};

/** Titres recherchés dans l'EPG. Comparaison insensible à la casse,
 *  simple "includes" par défaut — remplace par une regex si besoin. */
const WATCHLIST: string[] = [
    "Columbo",
    "Enquêtes au paradis",
    "Meurtres au paradis",
    "Mystères au paradis", // Avec Kris Marshall
];

/** Marges avant/après l'enregistrement (en secondes), sinon utilise la
 *  config PVR par défaut de la Freebox (voir GET /pvr/config/). */
const MARGIN_BEFORE = 60;
const MARGIN_AFTER = 5 * 60;

/** Délai minimum entre deux appels à l'API Freebox (ms). Comme on n'appelle
 *  plus l'EPG, un throttle simple et généreux suffit largement. */
const MIN_REQUEST_INTERVAL_MS = 1000;

/** Nombre max de tentatives en cas de 429 avant d'abandonner l'appel. */
const MAX_429_RETRIES = 3;

/** Base du backoff exponentiel si la réponse 429 ne fournit pas de header
 *  Retry-After (tentative n → DEFAULT_429_BACKOFF_MS * 2^n). */
const DEFAULT_429_BACKOFF_MS = 5_000;

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

interface StoredToken {
    app_token: string;
    track_id: number;
}

interface Session {
    sessionToken: string;
}

async function loadOrCreateAppToken(): Promise<string> {
    if (existsSync(TOKEN_FILE)) {
        const raw = await readFile(TOKEN_FILE, "utf-8");
        return (JSON.parse(raw) as StoredToken).app_token;
    }

    // 1. Demande d'autorisation : à valider physiquement sur l'écran tactile
    //    du Freebox Server (ou l'appli Freebox Connect selon le modèle).
    const authorizeRes = await fetchJson<{
        result: { app_token: string; track_id: number };
    }>(`${FREEBOX_API_BASE}/login/authorize/`, {
        method: "POST",
        body: JSON.stringify(APP_INFO),
    });

    const {app_token, track_id} = authorizeRes.result;

    logger.info("Valide la demande d'appairage sur l'écran de la Freebox...");

    // 2. Poll du statut jusqu'à validation (ou timeout/refus)
    let status = "pending";
    while (status === "pending") {
        await sleep(2000);
        const trackRes = await fetchJson<{ result: { status: string } }>(
            `${FREEBOX_API_BASE}/login/authorize/${track_id}`
        );
        status = trackRes.result.status; // pending | granted | denied | timeout
    }

    if (status !== "granted") {
        throw new Error(`Appairage non accordé (status=${status})`);
    }

    await writeFile(
        TOKEN_FILE,
        JSON.stringify({app_token, track_id} satisfies StoredToken, null, 2)
    );

    return app_token;
}

async function openSession(appToken: string): Promise<Session> {
    // 1. Récupère le challenge courant
    const loginRes = await fetchJson<{ result: { challenge: string } }>(
        `${FREEBOX_API_BASE}/login/`
    );
    const {challenge} = loginRes.result;

    // 2. Signe le challenge avec l'app_token (HMAC-SHA1, résultat en hex)
    const password = createHmac("sha1", appToken).update(challenge).digest("hex");

    // 3. Ouvre la session
    const sessionRes = await fetchJson<{ result: { session_token: string } }>(
        `${FREEBOX_API_BASE}/login/session/`,
        {
            method: "POST",
            body: JSON.stringify({app_id: APP_INFO.app_id, password}),
        }
    );

    return {sessionToken: sessionRes.result.session_token};
}

// ---------------------------------------------------------------------------
// Programme (représentation commune, indépendante de la source)
// ---------------------------------------------------------------------------

/**
 * @example {
 *   id: 'pluri_1730513584',
 *   title: 'Rendez-vous en terre inconnue',
 *   sub_title: 'Avec Kendji Girac chez les Turkana',
 *   start: 1785265800,
 *   duration: 11760
 * }
 */
export interface EpgProgram {
    id: string;
    title: string;
    sub_title?: string;
    start: number; // timestamp unix (en secondes)
    duration: number; // secondes
}

/**
 * On utilise le même format que les fichiers générés par la Freebox
 * @example "France 2 - Rendez-vous en terre inconnue (Avec Kendji Girac chez les Turkana) - 28-07-2026 21h09 03h22 (202).m2ts"
 * @param epgProgram
 */
export function epgProgramToString(epgProgram: EpgProgram): string {
    const startDate = toDate(epgProgram.start);

    const day = pad(startDate.getDate(), 2);
    const month = pad(startDate.getMonth() + 1, 2);
    const year = startDate.getFullYear();
    const hours = pad(startDate.getHours(), 2);
    const minutes = pad(startDate.getMinutes(), 2);
    const dateTime = `${day}-${month}-${year} ${hours}h${minutes}`;

    const durationHours = Math.floor(epgProgram.duration / 3600);
    const durationMinutes = Math.round(epgProgram.duration % 3600 / 60); // TODO round fait par Freebox ?
    const durationString = pad(durationHours, 2) + "h" + pad(durationMinutes, 2);

    return `${epgProgram.title} - ${dateTime} ${durationString}`; // TODO nombre entre parenthèses ?
}

export function matchesWatchlist(program: EpgProgram, watchlist: string[] = WATCHLIST): boolean {
    const haystack = `${program.title} ${program.sub_title ?? ""}`.toLowerCase();
    return watchlist.some((title) => haystack.includes(title.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Guide EPG externe (JSON local, généré hors de ce script)
// ---------------------------------------------------------------------------

/**
 * Forme réelle d'un guide.json généré par iptv-org/epg (vérifiée sur un
 * extrait produit avec --sites=tv-programme.telecablesat.fr --json).
 */
interface ExternalGuide {
    date: string;
    channels: ExternalChannel[];
    programs: ExternalEpgProgramRaw[];
}

interface ExternalChannel {
    xmltv_id: string; // ex. "Arte.de@France" — c'est ça, epgChannelId
    name: string;
}

interface ExternalTitle {
    value: string;
    lang: string;
}

export interface ExternalEpgProgramRaw {
    channel: string; // référence ExternalChannel.xmltv_id
    start: number; // timestamp unix EN MILLISECONDES
    stop: number; // timestamp unix EN MILLISECONDES
    titles: ExternalTitle[];
    subTitles: ExternalTitle[];
}

async function loadExternalEpg(path: string): Promise<ExternalEpgProgramRaw[]> {
    const raw = await readFile(path, "utf-8");
    const guide = JSON.parse(raw) as ExternalGuide;
    return guide.programs;
}

export function toEpgProgram(external: ExternalEpgProgramRaw): EpgProgram {
    const start = Math.floor(external.start / 1000);
    const stop = Math.floor(external.stop / 1000);
    return {
        id: `${external.channel}_${start}`, // synthétique : jamais envoyé à la Freebox
        title: external.titles[0]?.value ?? "(sans titre)",
        sub_title: external.subTitles[0]?.value,
        start,
        duration: stop - start,
    };
}

// ---------------------------------------------------------------------------
// Programmation des enregistrements (PVR)
// ---------------------------------------------------------------------------

export interface PrecordSummary {
    channel_uuid: string;
    start: number;
    end: number;
}

async function fetchExistingPrecords(session: Session): Promise<PrecordSummary[]> {
    const res = await fetchJson<{ result: PrecordSummary[] }>(
        `${FREEBOX_API_BASE}/pvr/programmed/`,
        {headers: authHeaders(session)}
    );
    return res.result || [];
}

export function alreadyProgrammed(
    existing: PrecordSummary[],
    channelUuid: string,
    start: number
): boolean {
    return existing.some(
        (p) => p.channel_uuid === channelUuid && p.start === start
    );
}

async function scheduleRecording(
    session: Session,
    channelUuid: string,
    channelTitle: string,
    program: EpgProgram
): Promise<void> {
    const start = program.start - MARGIN_BEFORE;
    const end = program.start + program.duration + MARGIN_AFTER;

    await fetchJson(`${FREEBOX_API_BASE}/pvr/programmed/`, {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({
            channel_uuid: channelUuid,
            start,
            end,
            name: program.title,
            subname: program.sub_title ?? "",
            broadcast_type: "tv",
            // media / path omis -> utilise le support de stockage par défaut
            // (la clé USB déjà branchée, si c'est le seul support connu)
        }),
    });

    logger.success(`Programmé : "${program.title}" sur ${channelTitle}`);
}

// ---------------------------------------------------------------------------
// Boucle principale
// ---------------------------------------------------------------------------

async function watchOnce(session: Session): Promise<void> {
    logger.section("Surveillance TV");

    const existing = await fetchExistingPrecords(session);
    logger.info(`${existing.length} enregistrement(s) déjà programmé(s) sur la Freebox`);

    const externalPrograms = await loadExternalEpg(EPG_JSON_PATH);
    logger.info(`${externalPrograms.length} programme(s) chargé(s) depuis le guide externe`);

    for (const [channelTitle, {freeboxUuid, epgChannelId}] of Object.entries(WATCHED_CHANNELS)) {
        const programs = externalPrograms
            .filter((p) => p.channel === epgChannelId)
            .map(toEpgProgram);

        logger.info(`${channelTitle} (${epgChannelId}) : ${programs.length} programme(s) au guide`);

        for (const program of programs) {
            logger.detail(channelTitle + " - " + epgProgramToString(program));

            if (!matchesWatchlist(program)) continue;

            if (alreadyProgrammed(existing, freeboxUuid, program.start - MARGIN_BEFORE)) {
                logger.info(`Déjà programmé, ignoré : "${program.title}" sur ${channelTitle}`);
                continue;
            }

            await scheduleRecording(session, freeboxUuid, channelTitle, program);
        }
    }
}

async function main(): Promise<void> {
    FREEBOX_API_BASE = await resolveApiBase();

    const appToken = await loadOrCreateAppToken();
    const session = await openSession(appToken);

    await watchOnce(session);
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function authHeaders(session: Session): Record<string, string> {
    return {"X-Fbx-App-Auth": session.sessionToken};
}

let lastRequestAt = 0;

async function throttle(): Promise<void> {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
}

async function fetchJson<T>(url: string, init?: RequestInit, attempt = 0): Promise<T> {
    await throttle();

    const res = await fetch(url, {
        ...init,
        headers: {"Content-Type": "application/json", ...(init?.headers ?? {})},
    });

    if (res.status === 429) {
        if (attempt >= MAX_429_RETRIES) {
            const bodyText = await res.text().catch(() => "<illisible>");
            throw new Error(
                `Freebox API 429 (rate_limit) sur ${url} — body: ${bodyText}. Abandon après ${attempt} tentative(s).`
            );
        }
        const retryAfterHeader = res.headers.get("Retry-After");
        const bodyText = await res.text().catch(() => "<illisible>");
        const backoffMs = retryAfterHeader
            ? Number(retryAfterHeader) * 1000
            : DEFAULT_429_BACKOFF_MS * 2 ** attempt;
        logger.warn(
            `429 sur ${url} (Retry-After=${retryAfterHeader ?? "absent"}, body=${bodyText}), ` +
            `nouvelle tentative dans ${backoffMs}ms (tentative ${attempt + 1}/${MAX_429_RETRIES})`
        );
        await sleep(backoffMs);
        return fetchJson<T>(url, init, attempt + 1);
    }

    if (!res.ok) {
        const bodyText = await res.text().catch(() => "<illisible>");
        throw new Error(`Freebox API ${res.status} ${res.statusText} (${url}) — body: ${bodyText}`);
    }
    const json = (await res.json()) as { success: boolean; result: unknown };
    if (!json.success) {
        throw new Error(`Freebox API a renvoyé success=false (${url})`);
    }

    return json as T;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ne s'exécute que si ce fichier est lancé directement (ts-node), jamais à
// l'import — indispensable pour pouvoir importer les fonctions pures de ce
// module depuis freebox-tv-watcher.test.ts sans déclencher de vrais appels
// réseau. `require.main === module` est l'équivalent CommonJS de la
// vérification ESM (`import.meta.url === ...`) — cohérent avec
// "module": "commonjs" dans tsconfig.json et l'exécution via ts-node.
if (require.main === module) {
    main().catch((err) => {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
}
