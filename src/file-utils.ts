import fs from "node:fs";
import path from "node:path";

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

export async function moveFile(source: string, target: string): Promise<void> {
    console.log('Source :', source)
    console.log('Cible  :', target)
    await mkdirs(path.dirname(target));
    return new Promise((resolve, reject) => {
        fs.rename(source, target, (err: Error) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    });
}

export async function mkdirs(dossier: string): Promise<void> {
    try {
        await fs.promises.access(dossier);
        return;
    } catch (error) {
        console.log("Création du dossier : " + dossier);
        return new Promise((resolve, reject) => {
            fs.mkdir(dossier, {recursive: true}, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}
