import * as fs from 'fs';
import * as path from 'path';

const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mpeg', '.mkv'];
const IGNORED_FOLDERS = ['#snapshot'];

function getAllFiles(dir: string, baseDir: string, results: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory() && IGNORED_FOLDERS.includes(entry.name)) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            getAllFiles(fullPath, baseDir, results);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (VIDEO_EXTENSIONS.includes(ext)) {
                const relativePath = path.relative(baseDir, fullPath);
                results.push(relativePath);
            }
        }
    }

    return results;
}

function main() {
    const inputPath = process.argv[2] || '.';
    const outputPath = process.argv[3] || path.join('.', 'video-paths.json');

    const baseDir = path.resolve(inputPath);
    const paths = getAllFiles(baseDir, baseDir);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(paths, null, 2), 'utf-8');
    console.log(`${paths.length} fichier(s) vidéo trouvé(s). Résultat écrit dans ${outputPath}`);
}

main();
