import * as path from "node:path";
import {getFileType, readdir, rename, exists, mkdir, deleteFolderIfEmpty, deleteFile} from "../lib/fs";
import {PhotoRepository} from "../lib/photo-repository";

// const PATH_TO_CHECK = String.raw`\\BluStation\photo\À trier`;
const PATH_TO_CHECK = String.raw`C:\\Users\\bludw\\Desktop\\Photos`;

(async function main(): Promise<void> {
    await repartirPhotosParDates(PATH_TO_CHECK);
})();

async function repartirPhotosParDates(dirToCheck: string, rootDir = dirToCheck): Promise<void> {
    const filesToCheck = await readdir(dirToCheck);

    if (filesToCheck.length === 0) {
        console.error('Aucun fichier à traiter')
        deleteFile("Dossier", dirToCheck)
        return;
    }

    for (const fileToCheck of filesToCheck) {
        console.log(`Traitement du chemin ${fileToCheck}`);

        const filePath = path.join(dirToCheck, fileToCheck);
        const fileType = await getFileType(filePath);
        if (fileType !== "Fichier") {
            if (fileType === "Dossier") {
                console.log(`  Traitement récursif du dossier...`);
                await repartirPhotosParDates(filePath, rootDir);
            } else {
                console.error(`  Type de fichier inconnu`);
            }
            continue;
        }

        const photo = PhotoRepository.newPhoto(fileToCheck);
        if (!photo) {
            console.error("  No photo");
            continue;
        }

        const oldPath = path.join(dirToCheck, fileToCheck);
        const newPath = path.join(rootDir, photo.subDir, fileToCheck);
        const newDir = path.dirname(newPath);
        if (!(await exists(newDir))) {
            await mkdir(newDir);
        }
        await rename(oldPath, newPath);
        console.log(`  Photo déplacée dans ${newPath}`);
    }

    await deleteFolderIfEmpty(dirToCheck);
}
