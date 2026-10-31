import path from "node:path";
import {readdir} from "./file-utils";
import {pad} from "./string-utils";

abstract class CheminDeFichier {
    abstract nomDeFichier: string;

    protected constructor(
        readonly sousDossiers: string[],
    ) {
    }

    get entier(): string {
        return path.join(
            ...this.sousDossiers,
            this.nomDeFichier
        );
    }
}

export class CheminDeFichierFreebox extends CheminDeFichier {

    constructor(
        sousDossiers: string[],
        readonly nomOriginal: string,
        readonly separateur: string,
        readonly chaine: string,
        readonly milieu: string,
        readonly timestampDureeExtensions: string,
    ) {
        super(sousDossiers);
    }

    static from(json: any, sousDossiers: string[] = []): CheminDeFichierFreebox {
        return new CheminDeFichierFreebox(
            sousDossiers,
            json.nomOriginal,
            json.separateur,
            json.chaine,
            json.milieu,
            json.timestampDureeExtensions,
        )
    }

    static readonly SEPARATEUR = ' - ';

    static parseFileName(fileName: string): CheminDeFichierFreebox {
        const separator = this.SEPARATEUR;

        let remaining = fileName
        const channelEndIndex = fileName.indexOf(separator);
        const channel = fileName.substring(0, channelEndIndex)
        // console.log(channel)
        remaining = remaining.substring(channelEndIndex + separator.length)

        const middleEndIndex = remaining.lastIndexOf(separator);
        const timestampAndDuration = remaining.substring(middleEndIndex + separator.length)
        remaining = remaining.substring(0, middleEndIndex)
        if (!remaining) {
            throw new Error(`timestampAndDuration introuvable pour ${fileName}`)
        }

        // console.log(remaining)

        return CheminDeFichierFreebox.from({
            nomOriginal: fileName,
            separateur: separator,
            chaine: channel,
            milieu: remaining,
            timestampDureeExtensions: timestampAndDuration,
        });
    }

    get nomDeFichier(): string {
        return this.nomOriginal;
    }
}

export class CheminDeFichierFreeboxParSerieV1 extends CheminDeFichier {

    private static readonly PAR_SERIE = "Par série";

    constructor(
        sousDossiers: string[],
        readonly serie: string,
        readonly milieu: string,
        readonly separateur: string,
        readonly chaine: string,
        readonly timestampDureeExtensions: string,
    ) {
        super(sousDossiers);
    }

    static cheminParSerie(dossierVideos: string): string {
        return path.join(dossierVideos, CheminDeFichierFreeboxParSerieV1.PAR_SERIE)
    }

    static async rechercherNomsDeSeriesConnus(dossierVideos: string): Promise<string[]> {
        const nomsDeSeriesConnus = await readdir(CheminDeFichierFreeboxParSerieV1.cheminParSerie(dossierVideos));
        console.log(`Séries connues :`, nomsDeSeriesConnus);
        return nomsDeSeriesConnus;
    }

    static cheminSerie(dossierVideos: string, serie: string): string {
        return path.join(CheminDeFichierFreeboxParSerieV1.cheminParSerie(dossierVideos), serie);
    }

    static depuisSource(serie: string, nomDuFichierParse: CheminDeFichierFreebox): CheminDeFichierFreeboxParSerieV1 {
        return new CheminDeFichierFreeboxParSerieV1(
            [...nomDuFichierParse.sousDossiers, CheminDeFichierFreeboxParSerieV1.PAR_SERIE, serie],
            serie,
            nomDuFichierParse.milieu,
            nomDuFichierParse.separateur,
            nomDuFichierParse.chaine,
            nomDuFichierParse.timestampDureeExtensions,
        )
    }

    get nomDeFichier(): string {
        return this.milieu +
            this.separateur +
            this.chaine +
            this.separateur +
            this.timestampDureeExtensions;
    }

    /**
     * @return `undefined` si nom de fichier non reconnu
     */
    static depuisCible(serie: string, nomDeFichier: string): CheminDeFichierFreeboxParSerieV1 | undefined {
        console.log(`Parsing du nom de fichier : ${nomDeFichier}`);

        const separateur = CheminDeFichierFreebox.SEPARATEUR;
        const blocs = nomDeFichier.split(separateur);
        if (blocs.length < 3) return undefined;

        return new CheminDeFichierFreeboxParSerieV1(
            [CheminDeFichierFreeboxParSerieV1.PAR_SERIE, serie],
            serie,
            blocs.slice(0, -2).join(separateur),
            separateur,
            blocs[blocs.length - 2],
            blocs[blocs.length - 1],
        );
    }
}

export class CheminDeFichierFreeboxParSerieV2 extends CheminDeFichier {

    constructor(
        sousDossiers: string[],
        readonly serie: string,
        readonly saison: number,
        readonly episode: number,
        readonly titre: string,
        readonly separateur: string,
        readonly chaine: string,
        readonly timestampDureeExtensions: string,
    ) {
        super(sousDossiers);
    }

    get nomDeFichier(): string {
        const s00 = "s" + pad(this.saison, 2);
        const e00 = "e" + pad(this.episode, 2);
        return this.serie +
            this.separateur +
            s00 + e00 +
            this.separateur +
            this.titre +
            this.separateur +
            this.chaine +
            this.separateur +
            this.timestampDureeExtensions;
    }
}

export class CheminDeFichierFreeboxParNom extends CheminDeFichier {

    constructor(
        sousDossiers: string[],
        readonly milieu: string,
        readonly separateur: string,
        readonly chaine: string,
        readonly timestampDureeExtensions: string,
    ) {
        super(sousDossiers);
    }

    static from(json: any): CheminDeFichierFreeboxParNom {
        return new CheminDeFichierFreeboxParNom(
            ["Par nom"],
            json.milieu,
            json.separateur,
            json.chaine,
            json.timestampDureeExtensions,
        )
    }

    get nomDeFichier(): string {
        return this.milieu +
            this.separateur +
            this.chaine +
            this.separateur +
            this.timestampDureeExtensions;
    }
}
