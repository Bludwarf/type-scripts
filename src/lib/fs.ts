import * as fs from "node:fs";
import * as path from "node:path";

export type FileType = "Fichier" | "Dossier";

export function deleteFile(type: FileType, fullPath: string, recursive = false): boolean {
    try {
        if (type === 'Dossier') {

            if (recursive) {
                if (!fullPath || fullPath === '/') {
                    console.error(`On évite de supprimer la racine !`);
                    return false;
                }
                const fileNames = fs.readdirSync(fullPath)
                for (const fileName of fileNames) {
                    const filePath = path.join(fullPath, fileName);
                    deleteFile(fs.lstatSync(filePath).isDirectory() ? 'Dossier' : 'Fichier', filePath, true);
                }
            }

            fs.rmdirSync(fullPath);
        } else {
            fs.unlinkSync(fullPath);
        }
    } catch (e) {
        console.error(`${type} non supprimé à cause d'une erreur : ${fullPath}`, e);
        return false;
    }

    console.log(`${type} supprimé : ${fullPath}`);
    return true;
}

export async function deleteFolderIfEmpty(dir: string): Promise<boolean> {
    const remainingFiles = await readdir(dir);
    if (remainingFiles.length > 0) {
        return false;
    }
    return deleteFile("Dossier", dir);
}

export function readdir(dir: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err: Error, files: string[]) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        })
    })
}

export function exists(path: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.access(path, (err) => resolve(!err));
    })
}

export function mkdir(path: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, {
            recursive: true,
        }, (err) => resolve(!err));
    })
}

export function getFileType(path: string): Promise<FileType | undefined> {
    return new Promise((resolve, reject) => {
        fs.lstat(path, (err, stats) => {
            if (err) {
                return reject(err);
            }
            const fileType: FileType = stats.isFile() ? 'Fichier' : stats.isDirectory() ? 'Dossier' : undefined;
            return resolve(fileType);
        });
    })
}

export function rename(oldPath: string, newPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, (err: Error) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    })
}
