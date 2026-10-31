import * as path from "node:path";
import {deleteFile, deleteFolderIfEmpty, exists, getFileType, readdir, rename} from "../lib/fs";
import {PhotoRepository} from "../lib/photo-repository";

/**
 * Dossier pouvant contenir des fichiers non sauvegardés.
 *
 * - Les photos déjà sauvegardées dans NAS_PATH seront supprimées.
 * - Les autres seront déplacées dans NAS_PATH.
 */
const PATH_TO_CHECK = String.raw`\\BluStation\photo\Moments\Mobile\SM-G960F`;

/** Dossier "Par dates" contenant les fichiers déjà sauvegardés */
const NAS_PATH = String.raw`\\BluStation\photo\Par dates`;

class Report {
    deletedFilesCount = 0;
    deletedDirectoriesCount = 0;
    errorsCount = 0;
    deletedIgnoredFilesCount = 0;
    movedFilesCount = 0;
}

(async function main(): Promise<void> {
    const photoRepository = new PhotoRepository(NAS_PATH)
    const report = await sync(PATH_TO_CHECK, photoRepository);
    console.log(report);
})();

async function sync(dirToCheck: string, photoRepository: PhotoRepository, report = new Report()): Promise<Report> {
    const filesToCheck = await readdir(dirToCheck);

    if (filesToCheck.length === 0) {
        console.error('Aucun fichier à traiter')
        return;
    }

    for (const fileToCheck of filesToCheck) {
        const filePath = path.join(dirToCheck, fileToCheck);
        console.log(`Traitement du chemin ${filePath}`);

        if (fileToCheck === 'Thumbs.db') {
            console.log(`  On supprime le fichier ${fileToCheck}`);
            deleteFile('Fichier', filePath);
            ++report.deletedIgnoredFilesCount;
            continue;
        }

        const fileType = await getFileType(filePath);
        if (fileType !== "Fichier") {
            if (fileType === "Dossier") {
                console.log(`  Traitement récursif du dossier...`);
                await sync(filePath, photoRepository, report);

                // Dossier vide ?
                if (await deleteFolderIfEmpty(filePath)) {
                    ++report.deletedDirectoriesCount;
                }
            } else {
                console.error(`  Type de fichier inconnu`);
            }
            continue;
        }

        try {
            const matchingDir = await photoRepository.getMatchingDir(fileToCheck);

            const matchingFile = path.join(matchingDir, fileToCheck);
            if (await exists(matchingFile)) {
                console.log(`  Fichier correspondant : ${matchingFile}`);
                const fileToCheckPath = path.join(dirToCheck, fileToCheck);
                deleteFile('Fichier', fileToCheckPath);
                ++report.deletedFilesCount;
            } else {
                console.error(`  On sauvegarde la photo dans ${matchingFile}`);
                await rename(filePath, matchingFile);
                ++report.movedFilesCount
            }
        } catch (e) {
            console.error(`  ${e}`);
            ++report.errorsCount;
        }
    }

    return report;
}
