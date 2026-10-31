import * as path from "node:path";
import {exists, readdir, mkdir} from "./fs";

const FILE_REGEX = /^(\d{4})(\d{2})(\d{2})/i;

class Photo {
    constructor(
        readonly yyyy: string,
        readonly mm: string,
        readonly dd: string,
    ) {
    }

    get yyyymmdd(): string {
        return `${this.yyyy}${this.mm}${this.dd}`;
    }

    get subDir(): string {
        return path.join(this.yyyy, `${this.yyyy}${this.mm}${this.dd}`);
    }
}

export class PhotoRepository {

    /** Sous-dossiers de chaque dossier YYYY */
    private readonly yyyySubDirs: Record<string, string[]> = {};

    /** Sous-dossier correspondant à un Photo.yyyymmdd  */
    private readonly yyyymmddSubDirs: Record<string, string> = {};

    constructor(readonly byDatesDir: string) {
    }

    static newPhoto(filePath: string): Photo {
        const matches = FILE_REGEX.exec(filePath);
        if (matches === null) {
            throw new Error(`  Nommage de fichier non reconnu : ${filePath}`);
        }

        const yyyy = matches[1];
        const mm = matches[2];
        const dd = matches[3];

        return new Photo(yyyy, mm, dd);
    }

    async getMatchingDir(fileToCheck: string): Promise<string> {
        const photo = PhotoRepository.newPhoto(fileToCheck);

        if (photo.yyyymmdd in this.yyyymmddSubDirs) {
            return this.yyyymmddSubDirs[photo.yyyymmdd];
        }

        const matchingDir = await this.findOrCreateMatchingDir(photo);
        this.yyyymmddSubDirs[photo.yyyymmdd] = matchingDir;
        return matchingDir;
    }

    async findOrCreateMatchingDir(photo: Photo): Promise<string> {
        const yyyyDir = path.join(this.byDatesDir, photo.yyyy);

        const exactMatchDir = path.join(yyyyDir, photo.yyyymmdd);
        if (await exists(exactMatchDir)) {
            console.log(`  Dossier exact correspondant : ${exactMatchDir}`)
            return exactMatchDir;
        }

        const yyyySubDirs = await this.getYyyySubDirs(yyyyDir);
        for (const yyyySubDir of yyyySubDirs) {
            const yyyySubDirMatches = FILE_REGEX.exec(yyyySubDir);
            if (!yyyySubDirMatches) {
                continue;
            }
            if (yyyySubDirMatches[1] === photo.yyyy && yyyySubDirMatches[2] === photo.mm && yyyySubDirMatches[3] === photo.dd) {
                const exactMatchSubDir = path.join(yyyyDir, yyyySubDir);
                console.log(`  Dossier correspondant : ${exactMatchSubDir}`)
                return exactMatchSubDir;
            }
        }

        console.log(`  On crée le dossier ${exactMatchDir}...`);
        await mkdir(exactMatchDir);
        return exactMatchDir;
    }

    private async getYyyySubDirs(yyyyDir: string) {
        if (this.yyyySubDirs[yyyyDir]) {
            return this.yyyySubDirs[yyyyDir];
        }
        console.log(`  Listing du dossier ${yyyyDir}...`);
        const yyyySubDirs = await readdir(yyyyDir);
        this.yyyySubDirs[yyyyDir] = yyyySubDirs;
        return yyyySubDirs;
    }
}
