import {describe, expect, it} from 'vitest';
import {CheminDeFichierFreeboxParSerieV1} from "./nommage";
import {RenommageParSerieV1V2} from "./renommage";

describe("RenommageParSerieV1V2", () => {

    it("Saison connue", () => {
        const source = new CheminDeFichierFreeboxParSerieV1(
            [
                "Par série",
                "Columbo",
            ],
            "Columbo",
            "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats)",
            " - ",
            "TMC",
            "11-10-2025 21h00 02h20 (188).m2ts",
        );
        const renommage = new RenommageParSerieV1V2();
        const cible = renommage.calculerCible(source);
        expect(cible).toEqual({
            sousDossiers: [
                "Par série",
                "Columbo",
                "Saison 8",
            ],
            serie: "Columbo",
            saison: 8,
            episode: 4,
            titre: "Grandes manoeuvres et petits soldats",
            separateur: " - ",
            chaine: "TMC",
            timestampDureeExtensions: "11-10-2025 21h00 02h20 (188).m2ts",
        });
    });

    it("Saison inconnue", () => {
        const source = new CheminDeFichierFreeboxParSerieV1(
            [
                "Par série",
                "Columbo",
            ],
            "Columbo",
            "Columbo (Couronne mortuaire)",
            " - ",
            "TMC",
            "04-01-2025 21h15 01h50 (77).m2ts",
        );
        const renommage = new RenommageParSerieV1V2();
        const cible = renommage.calculerCible(source);
        expect(cible).toBeUndefined();
    });

});
