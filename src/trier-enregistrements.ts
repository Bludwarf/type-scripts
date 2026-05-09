import path from "node:path";
import process from "node:process";
import {CheminDeFichierFreebox, CheminDeFichierFreeboxParSerieV1} from "./nommage";
import {Tri, TriParNom, TriParSerie} from "./tri";
import {moveFile, readdir} from "./file-utils";
// FIXME : provoque l'erreur : TypeError: util.promisify(...)(...) is not a function
// const util = require('util')
// const readdir = util.promisify(fs.readdir)

class Deplacements {
    constructor(
        public readonly deplacementsDeFichier: DeplacementDeFichier<any>[],
    ) {
    }

    async trier(dossier: string): Promise<void> {
        console.log(`📂 Tri des enregistrements du dossier ${dossier}`);

        const entrees = await readdir(dossier)
        console.log(`📋 ${entrees.length} fichier(s) à trier...`, entrees);

        for (const entree of entrees) {
            if (!entree.includes('.')) {
                // On ne traite pas les dossiers
                continue;
            }
            if (!entree.includes('.m2ts')) {
                console.log(`Fichier ignoré : ${entree}`)
                continue;
            }
            const nomDuFichierParse = CheminDeFichierFreebox.parseFileName(entree);
            try {
                for (const deplacementDeFichier of this.deplacementsDeFichier) {
                    const fichierDeplace = await deplacementDeFichier.deplacerFichier(dossier, nomDuFichierParse);
                    if (fichierDeplace) {
                        console.log(`Fichier déplacé avec succès`)
                        break
                    }
                }
            } catch (err) {
                console.error('Erreur lors du déplacement', err);
            }
        }

        console.log(`✅  Tri terminé`);
    }

}

class DeplacementDeFichier<T extends Tri> {
    constructor(
        readonly dossierVideos: string,
        readonly tri: T,
    ) {
    }

    /**
     * @return Le fichier a été déplacé ?
     */
    async deplacerFichier(dossier: string, nomDuFichierParse: CheminDeFichierFreebox): Promise<boolean> {
        const cheminCible = this.tri.calculerCheminCibleRelatif(nomDuFichierParse);
        if (!cheminCible) return false;
        await moveFile(
            path.join(dossier, nomDuFichierParse.nomOriginal),
            path.join(this.dossierVideos, cheminCible),
        )
        return true;
    }
}

(async function main(argv: string[]): Promise<void> {
    const args = argv.slice(2);
    const [dossierVideos] = args;
    if (!dossierVideos) {
        throw new Error(`Veuillez indiquer le dossier "videos" à trier`)
    }

    const nomsDeSeriesConnus = await CheminDeFichierFreeboxParSerieV1.rechercherNomsDeSeriesConnus(dossierVideos);
    const tri = new Deplacements([
        new DeplacementDeFichier(dossierVideos, new TriParSerie(nomsDeSeriesConnus)),
        new DeplacementDeFichier(dossierVideos, new TriParNom()),
    ]);
    await tri.trier(dossierVideos)

})(process.argv);
