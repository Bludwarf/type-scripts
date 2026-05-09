import process from "node:process";
import {CheminDeFichierFreeboxParSerieV1} from "./nommage";
import {mkdirs, moveFile, readdir} from "./file-utils";
import {RenommageParSerieV1V2} from "./renommage";
import path from "node:path";

(async function main(argv: string[]): Promise<void> {
    const args = argv.slice(2);
    const [dossierVideos] = args;
    if (!dossierVideos) {
        throw new Error(`Veuillez indiquer le dossier "vidéos" à renommer`)
    }

    const renommage = new RenommageParSerieV1V2();
    const nomsDeSeriesConnus = await CheminDeFichierFreeboxParSerieV1.rechercherNomsDeSeriesConnus(dossierVideos);

    for (const serie of nomsDeSeriesConnus) {
        const cheminSerie = CheminDeFichierFreeboxParSerieV1.cheminSerie(dossierVideos, serie);
        console.log(`Renommage pour la série "${serie}" : ${cheminSerie}`);

        const nomsDeFichier = await readdir(cheminSerie);
        for (const nomDeFichier of nomsDeFichier) {
            const source = CheminDeFichierFreeboxParSerieV1.depuisCible(serie, nomDeFichier);
            if (source) {
                const cibleAbsolue = renommage.calculerCibleAbsolue(dossierVideos, source);
                if (cibleAbsolue) {
                    const dossierCible = path.dirname(cibleAbsolue);
                    await mkdirs(dossierCible);

                    await moveFile(
                        path.join(CheminDeFichierFreeboxParSerieV1.cheminSerie(dossierVideos, serie), nomDeFichier),
                        cibleAbsolue,
                    )
                    console.log(`Fichier déplacé vers : ${cibleAbsolue}`);
                }
            }
        }
    }

})(process.argv);
