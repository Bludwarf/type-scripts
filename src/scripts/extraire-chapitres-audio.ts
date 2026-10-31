/**
 * Extrait l'audio d'un fichier vidéo ou audio et le découpe en un fichier par chapitre.
 *
 * PRÉREQUIS
 *   ffmpeg et ffprobe doivent être installés et accessibles dans le PATH.
 *   Téléchargement (Windows) : https://www.gyan.dev/ffmpeg/builds/
 *
 * USAGE (via npm run, les arguments du script se placent après "--")
 *   npm run extraire-chapitres-audio -- --input "video.mkv"
 *   npm run extraire-chapitres-audio -- --input "audio.mp3"
 *   npm run extraire-chapitres-audio -- --input "video.mkv" --format mp3
 *   npm run extraire-chapitres-audio -- --input "video.mkv" --output-dir "sortie" --track 1
 *   npm run extraire-chapitres-audio -- --input "video.mkv" --output-dir "sortie" --track 1 --album "Mon album"
 *   npm run extraire-chapitres-audio -- --input "video.mkv" --chapters-file "video.chapters.txt"
 *   npm run extraire-chapitres-audio -- --input "audio.mp3" --chapters-file "reperes.csv"
 *
 * --input accepte aussi bien un fichier vidéo (MKV, MP4, ...) qu'un fichier audio
 * (MP3, WAV, FLAC, ...) : le type est détecté d'après l'extension et adapte le nom du
 * dossier de sortie par défaut. Si --format n'est pas précisé et que l'entrée est déjà
 * un audio dans un format supporté (mp3, aac, flac, wav, ogg), ce format est repris tel
 * quel en sortie au lieu de "copy" (ex. audio.mp3 -> chapitres en .mp3).
 *
 * --chapters-file permet de fournir un découpage externe. Deux formats sont reconnus
 * d'après l'extension du fichier :
 *
 * - Format OGM/mkvmerge (extension .txt ou autre) :
 *     CHAPTER01=00:00:00.000
 *     CHAPTER01NAME=Titre du premier chapitre
 *     CHAPTER02=00:01:16.201
 *     CHAPTER02NAME=Titre du deuxième chapitre
 *
 * - Export de repères Adobe Audition (.csv ou .tsv, en réalité tabulé) :
 *     Name	Start	Duration	Time Format	Type	Description
 *     CHAPITRE II	0:36.826	0:00.000	decimal	Track
 *   Seule la colonne "Start" des repères de type "Track" est utilisée ; la fin de chaque
 *   chapitre est déduite du début du repère suivant (ou de la fin du fichier).
 *
 * Sans --chapters-file, les chapitres embarqués dans le fichier sont lus via ffprobe.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";

const SCRIPT_NAME = "extraire-chapitres-audio.ts";
const SCRIPT_VERSION = "2026.08.19";

const FORMATS = ["copy", "mp3", "aac", "flac", "wav", "ogg"] as const;
type Format = (typeof FORMATS)[number];

interface Chapter {
    start_time: string;
    end_time?: string;
    tags?: { title?: string };
}

// ---------------------------------------------------------------------------
// Affichage console
// ---------------------------------------------------------------------------

const COLORS = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
} as const;
const RESET = "\x1b[0m";

function log(message = "", color?: keyof typeof COLORS): void {
    console.log(color ? `${COLORS[color]}${message}${RESET}` : message);
}

function fail(message: string, hint?: string): never {
    log(message, "red");
    if (hint) log(hint, "yellow");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Outils externes
// ---------------------------------------------------------------------------

function checkTool(name: string): void {
    const result = spawnSync(name, ["-version"], { stdio: "ignore" });
    if (result.error) {
        fail(
            `Erreur : '${name}' est introuvable dans le PATH.`,
            "Installe ffmpeg depuis https://www.gyan.dev/ffmpeg/builds/ et ajoute son dossier 'bin' au PATH."
        );
    }
}

function ffprobe(args: string[]): string {
    const result = spawnSync("ffprobe", args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    return result.stdout ?? "";
}

function getFfmpegVersion(): string {
    const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
    const firstLine = (result.stdout ?? "").split(/\r?\n/)[0] ?? "";
    return /ffmpeg version (\S+)/.exec(firstLine)?.[1] ?? "inconnue";
}

function getDuration(inputPath: string): string {
    return ffprobe([
        "-i", inputPath,
        "-show_entries", "format=duration",
        "-v", "quiet",
        "-of", "csv=p=0",
    ]).trim();
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function getSafeName(name: string): string {
    const safe = name.replace(/[\\/:*?"<>|]/g, "_").trim();
    return safe === "" ? "sans_titre" : safe;
}

function readTextFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
        fail(`Erreur : fichier de chapitres introuvable : ${filePath}`);
    }
    // Retire un éventuel BOM UTF-8.
    return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

/** Convertit un timestamp Adobe Audition ("m:ss.mmm" ou "h:mm:ss.mmm") en secondes. */
function auditionTimeToSeconds(value: string): number {
    const parts = value.trim().split(":").map((p) => parseFloat(p));
    if (parts.some((p) => Number.isNaN(p))) {
        fail(`Erreur : timestamp Audition invalide : "${value}"`);
    }
    switch (parts.length) {
        case 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        case 2:
            return parts[0] * 60 + parts[1];
        default:
            return parts[0];
    }
}

/** Reformate un nombre de secondes en hh:mm:ss.mmm pour ffmpeg (-ss / -to). */
function secondsToTimestamp(totalSeconds: number): string {
    // On arrondit d'abord à la milliseconde pour éviter un "60.000" en secondes.
    const totalMs = Math.round(totalSeconds * 1000);
    const h = Math.floor(totalMs / 3_600_000);
    const m = Math.floor((totalMs % 3_600_000) / 60_000);
    const s = (totalMs % 60_000) / 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s
        .toFixed(3)
        .padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Lecture des chapitres
// ---------------------------------------------------------------------------

/**
 * Parse un fichier de chapitres OGM/mkvmerge et reconstruit des objets de la même
 * forme que ceux de `ffprobe -show_chapters` (start_time / end_time / tags.title).
 *
 * totalDuration sert de fin pour le DERNIER chapitre : sur certains MKV mal finalisés,
 * laisser ffmpeg lire jusqu'à l'EOF sans -to le fait tomber sur la zone corrompue en
 * fin de conteneur ("File extends beyond end of segment").
 */
function getChaptersFromOgmFile(filePath: string, totalDuration: string): Chapter[] {
    const starts = new Map<number, string>();
    const names = new Map<number, string>();

    for (const line of readTextFile(filePath).split(/\r?\n/)) {
        let match = /^CHAPTER(\d+)NAME=(.*)$/i.exec(line);
        if (match) {
            names.set(parseInt(match[1], 10), match[2].trim());
            continue;
        }
        match = /^CHAPTER(\d+)=(.*)$/i.exec(line);
        if (match) {
            starts.set(parseInt(match[1], 10), match[2].trim());
        }
    }

    const numbers = [...starts.keys()].sort((a, b) => a - b);
    if (numbers.length === 0) {
        fail(
            `Erreur : aucun chapitre reconnu dans ${filePath} (format attendu : CHAPTERxx=hh:mm:ss.mmm).`
        );
    }

    return numbers.map((n, idx) => ({
        start_time: starts.get(n)!,
        end_time:
            idx < numbers.length - 1 ? starts.get(numbers[idx + 1])! : totalDuration,
        tags: { title: names.get(n) ?? `chapitre_${n}` },
    }));
}

/**
 * Parse un export de repères Adobe Audition (fichier tabulé, malgré l'extension .csv).
 * Seuls les repères de type "Track" sont retenus ; la colonne "Duration" est ignorée.
 */
function getChaptersFromAuditionFile(filePath: string, totalDuration: string): Chapter[] {
    const lines = readTextFile(filePath)
        .split(/\r?\n/)
        .slice(1) // en-tête
        .filter((l) => l.trim() !== "");

    const unquote = (s: string) => s.trim().replace(/^"|"$/g, "").trim();
    const marks: { name: string; startSeconds: number }[] = [];

    for (const line of lines) {
        const cols = line.split("\t");
        if (cols.length < 2) continue;

        const name = unquote(cols[0]);
        const startRaw = unquote(cols[1]);
        if (startRaw === "") continue;

        if (cols.length >= 5) {
            const type = unquote(cols[4]);
            if (type && type !== "Track") continue;
        }

        marks.push({ name, startSeconds: auditionTimeToSeconds(startRaw) });
    }

    if (marks.length === 0) {
        fail(`Erreur : aucun repère de type 'Track' reconnu dans ${filePath}.`);
    }

    marks.sort((a, b) => a.startSeconds - b.startSeconds);

    return marks.map((mark, idx) => ({
        start_time: secondsToTimestamp(mark.startSeconds),
        end_time:
            idx < marks.length - 1
                ? secondsToTimestamp(marks[idx + 1].startSeconds)
                : totalDuration,
        tags: { title: mark.name },
    }));
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

function printUsage(): void {
    console.log(`Usage : npm run extraire-chapitres-audio -- --input <fichier> [options]

Options :
  -i, --input <fichier>          Fichier vidéo ou audio source (obligatoire)
  -o, --output-dir <dossier>     Dossier de sortie (défaut : <nom>_audio ou <nom>_chapitres)
  -f, --format <format>          copy | mp3 | aac | flac | wav | ogg (défaut : copy)
  -t, --track <n>                Index de la piste audio (défaut : 0)
      --album <nom>              Tag album à écrire dans chaque fichier
  -c, --chapters-file <fichier>  Chapitres externes (OGM/mkvmerge ou repères Audition .csv/.tsv)
  -h, --help                     Affiche cette aide`);
}

function main(): void {
    const { values } = parseArgs({
        options: {
            input: { type: "string", short: "i" },
            "output-dir": { type: "string", short: "o" },
            format: { type: "string", short: "f" },
            track: { type: "string", short: "t" },
            album: { type: "string" },
            "chapters-file": { type: "string", short: "c" },
            help: { type: "boolean", short: "h" },
        },
        allowPositionals: false,
    });

    if (values.help) {
        printUsage();
        return;
    }
    if (!values.input) {
        log("Erreur : l'option --input est obligatoire.\n", "red");
        printUsage();
        process.exit(1);
    }

    const inputPath = values.input;
    const album = values.album;
    const chaptersFile = values["chapters-file"];

    const formatExplicit = values.format !== undefined;
    let format: Format = "copy";
    if (formatExplicit) {
        if (!(FORMATS as readonly string[]).includes(values.format!)) {
            fail(`Erreur : format invalide "${values.format}" (attendu : ${FORMATS.join(", ")}).`);
        }
        format = values.format as Format;
    }

    const track = values.track !== undefined ? Number(values.track) : 0;
    if (!Number.isInteger(track) || track < 0) {
        fail(`Erreur : --track doit être un entier positif ou nul (reçu : "${values.track}").`);
    }

    checkTool("ffmpeg");
    checkTool("ffprobe");
    const ffmpegVersion = getFfmpegVersion();

    if (!fs.existsSync(inputPath)) {
        fail(`Erreur : fichier introuvable : ${inputPath}`);
    }

    // Détection audio/vidéo d'après l'extension, pour le nom du dossier de sortie
    // et le format de sortie par défaut.
    const audioExtensions = [
        ".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg",
        ".opus", ".wma", ".aiff", ".alac", ".ape", ".wv",
    ];
    const parsed = path.parse(path.resolve(inputPath));
    const inputExt = parsed.ext.toLowerCase();
    const isAudioInput = audioExtensions.includes(inputExt);

    if (!formatExplicit && isAudioInput) {
        const audioExtToFormat: Record<string, Format> = {
            ".mp3": "mp3",
            ".aac": "aac",
            ".flac": "flac",
            ".wav": "wav",
            ".ogg": "ogg",
        };
        const deduced = audioExtToFormat[inputExt];
        if (deduced) {
            format = deduced;
            log(`Format de sortie déduit du fichier d'entrée : ${format}`, "cyan");
        }
    }

    const outputDir =
        values["output-dir"] ??
        path.join(parsed.dir, parsed.name + (isAudioInput ? "_chapitres" : "_audio"));
    fs.mkdirSync(outputDir, { recursive: true });

    // Chapitres
    let chapters: Chapter[];
    if (chaptersFile) {
        const chaptersExt = path.extname(chaptersFile).toLowerCase();
        const duration = getDuration(inputPath);
        if (chaptersExt === ".csv" || chaptersExt === ".tsv") {
            log(`Lecture des chapitres (repères Adobe Audition) depuis : ${chaptersFile}`, "cyan");
            chapters = getChaptersFromAuditionFile(chaptersFile, duration);
        } else {
            log(`Lecture des chapitres (format OGM/mkvmerge) depuis : ${chaptersFile}`, "cyan");
            chapters = getChaptersFromOgmFile(chaptersFile, duration);
        }
    } else {
        log("Lecture des chapitres...", "cyan");
        const probeJson = ffprobe([
            "-i", inputPath,
            "-print_format", "json",
            "-show_chapters",
            "-loglevel", "error",
        ]);
        const probeData = JSON.parse(probeJson || "{}") as { chapters?: Chapter[] };
        chapters = probeData.chapters ?? [];

        if (chapters.length === 0) {
            log("Aucun chapitre trouvé. Extraction de l'audio complet en un seul fichier.", "yellow");
            chapters = [
                {
                    start_time: "0",
                    end_time: getDuration(inputPath),
                    tags: { title: parsed.name },
                },
            ];
        }
    }

    log(`${chapters.length} chapitre(s) détecté(s). Sortie dans : ${outputDir}\n`, "cyan");

    const ext = format === "copy" ? "mka" : format;
    const codecMap: Record<Exclude<Format, "copy">, string> = {
        mp3: "libmp3lame",
        aac: "aac",
        flac: "flac",
        wav: "pcm_s16le",
        ogg: "libvorbis",
    };

    // Langue de la piste audio sélectionnée (repli sur "und").
    const trackLanguage =
        ffprobe([
            "-i", inputPath,
            "-select_streams", `a:${track}`,
            "-show_entries", "stream_tags=language",
            "-of", "csv=p=0",
            "-v", "quiet",
        ]).trim() || "und";

    log(`Langue : ${trackLanguage}`);
    if (album) log(`Album : ${album}`);
    log();

    // "language" est une métadonnée de PISTE : on la cible avec -metadata:s:a:0.
    const commonMetadataArgs = [
        "-metadata", "genre=Soundtrack",
        "-metadata", `encoded_by=${SCRIPT_NAME} ${SCRIPT_VERSION} via ffmpeg ${ffmpegVersion}`,
        "-metadata:s:a:0", `language=${trackLanguage}`,
    ];

    chapters.forEach((chap, index) => {
        const i = index + 1;
        const start = chap.start_time;
        const end = chap.end_time;
        const title = chap.tags?.title || `chapitre_${i}`;
        const outName = `${String(i).padStart(2, "0")} - ${getSafeName(title)}.${ext}`;
        const outPath = path.join(outputDir, outName);

        log(`[${i}/${chapters.length}] ${title} (${start} -> ${end || "fin"})`);

        const ffmpegArgs: string[] = ["-y", "-i", inputPath, "-ss", start];
        if (end) ffmpegArgs.push("-to", end);

        ffmpegArgs.push(
            "-map", `0:a:${track}`,
            "-vn",
            "-map_chapters", "-1",
            "-map_metadata:g", "0:g",
            "-id3v2_version", "3",
            "-metadata", `track=${i}`,
            "-metadata", `TRACKTOTAL=${chapters.length}`,
            "-metadata", `title=${title}`,
            ...commonMetadataArgs,
            "-c:a", format === "copy" ? "copy" : codecMap[format]
        );

        // Doit précéder le chemin de sortie : ffmpeg ignore les options placées après.
        if (album) ffmpegArgs.push("-metadata", `album=${album}`);

        ffmpegArgs.push("-loglevel", "warning", outPath);

        const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
        if (result.error || result.status !== 0) {
            log("  Erreur ffmpeg pour ce chapitre.", "red");
        } else {
            log(`  -> ${outName}`, "green");
        }
    });

    log("\nTerminé.", "cyan");
}

main();
