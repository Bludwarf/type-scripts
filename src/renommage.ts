import {CheminDeFichierFreeboxParSerieV1, CheminDeFichierFreeboxParSerieV2} from "./nommage";
import path from "node:path";

export class RenommageParSerieV1V2 {
    static readonly REGEX_MILIEU = /^Saison (\d+) - épisode (\d+) \d+ (.+)$/;

    calculerCibleAbsolue(dossierVideos: string, source: CheminDeFichierFreeboxParSerieV1): string | undefined {
        const cible = this.calculerCible(source);
        if (!cible) return undefined;
        return path.join(dossierVideos, cible.entier);
    }

    calculerCible(source: CheminDeFichierFreeboxParSerieV1): CheminDeFichierFreeboxParSerieV2 | undefined {
        const milieuInterieurDesParentheses = source.milieu.slice(source.serie.length + 2, -1);
        const matches = RenommageParSerieV1V2.REGEX_MILIEU.exec(milieuInterieurDesParentheses);
        const saison = matches ? +matches[1] : undefined;
        if (!saison) return undefined;
        const episode = matches ? +matches[2] : undefined;
        if (!episode) return undefined;
        const titre = matches ? matches[3] : milieuInterieurDesParentheses;
        return new CheminDeFichierFreeboxParSerieV2(
            [...source.sousDossiers, `Saison ${saison}`],
            source.serie,
            saison,
            episode,
            titre,
            source.separateur,
            source.chaine,
            source.timestampDureeExtensions,
        )
    }

}
