import {CheminDeFichierFreebox, CheminDeFichierFreeboxParNom, CheminDeFichierFreeboxParSerieV1} from "./nommage";
import {RenommageParSerieV1V2} from "./renommage";

export abstract class Tri {
    abstract calculerCheminCibleRelatif(nomDuFichierParse: CheminDeFichierFreebox): string | undefined;
}

export class TriParSerie extends Tri {
    renommageV1V2 = new RenommageParSerieV1V2();

    constructor(
        readonly nomsDeSeriesConnus: string[],
    ) {
        super();
    }

    calculerCheminCibleRelatif(nomDuFichierParse: CheminDeFichierFreebox): string | undefined {
        for (const nomDeSerieConnue of this.nomsDeSeriesConnus) {
            if (nomDuFichierParse.milieu.startsWith(nomDeSerieConnue)) {
                const cheminCibleV1 = CheminDeFichierFreeboxParSerieV1.depuisSource(nomDeSerieConnue, nomDuFichierParse);
                const cheminCibleV2 = this.renommageV1V2.calculerCible(cheminCibleV1);
                const cheminCible = cheminCibleV2 ?? cheminCibleV1;
                return cheminCible.entier;
            }
        }
    }
}

export class TriParNom extends Tri {
    calculerCheminCibleRelatif(nomDuFichierParse: CheminDeFichierFreebox): string {
        const nomCible = CheminDeFichierFreeboxParNom.from({
            milieu: nomDuFichierParse.milieu,
            separateur: nomDuFichierParse.separateur,
            chaine: nomDuFichierParse.chaine,
            timestampDureeExtensions: nomDuFichierParse.timestampDureeExtensions,
        });
        return nomCible.entier;
    }
}
