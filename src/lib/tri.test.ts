import {describe, it, expect} from 'vitest';
import {CheminDeFichierFreebox} from "./nommage";
import {TriParNom, TriParSerie} from "./tri";
import path from "node:path";

describe("TriParSerie", () => {

    const tri = new TriParSerie([
        "Columbo",
    ]);

    it("calculerCheminCibleRelatif série connue, saison connue", () => {
        const nomDeFichierParse = CheminDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats)",
            nomOriginal: "TMC - Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats) - 11-10-2025 21h00 02h20 (188).m2ts",
            separateur: " - ",
            timestampDureeExtensions: "11-10-2025 21h00 02h20 (188).m2ts",
        })
        const cheminCible = tri.calculerCheminCibleRelatif(nomDeFichierParse);
        expect(cheminCible).toBe(path.join(
            "Par série",
            "Columbo",
            "Saison 8",
            "Columbo - s08e04 - Grandes manoeuvres et petits soldats - TMC - 11-10-2025 21h00 02h20 (188).m2ts",
        ));
    });

    it("calculerCheminCibleRelatif série connue, saison inconnue", () => {
        const nomDeFichierParse = CheminDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Couronne mortuaire)",
            nomOriginal: "TMC - Columbo (Couronne mortuaire) - 04-01-2025 21h15 01h50 (77).m2ts",
            separateur: " - ",
            timestampDureeExtensions: "04-01-2025 21h15 01h50 (77).m2ts",
        })
        const cheminCible = tri.calculerCheminCibleRelatif(nomDeFichierParse);
        expect(cheminCible).toBe(path.join(
            "Par série",
            "Columbo",
            "Columbo (Couronne mortuaire) - TMC - 04-01-2025 21h15 01h50 (77).m2ts",
        ));
    });

});

describe("TriParNom", () => {

    const tri = new TriParNom();

    it("calculerCheminCibleRelatif", () => {
        const nomDeFichierParse = CheminDeFichierFreebox.from({
            chaine: "6ter",
            milieu: "Jours de tonnerre",
            nomOriginal: "6ter - Jours de tonnerre - 13-05-2025 21h11 02h08 (159).m2ts",
            separateur: " - ",
            timestampDureeExtensions: "13-05-2025 21h11 02h08 (159).m2ts",
        })
        const cheminCible = tri.calculerCheminCibleRelatif(nomDeFichierParse);
        expect(cheminCible).toBe(path.join(
            "Par nom",
            "Jours de tonnerre - 6ter - 13-05-2025 21h11 02h08 (159).m2ts",
        ));
    });

});
