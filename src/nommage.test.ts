import {describe, expect, it, test} from 'vitest';
import {CheminDeFichierFreebox, CheminDeFichierFreeboxParSerieV1, CheminDeFichierFreeboxParSerieV2} from "./nommage";
import path from "node:path";

describe("NomDeFichierFreebox", () => {

    it("parseFileName Jours de tonnerre.m2ts", () => {
        const nomOriginal = "6ter - Jours de tonnerre - 13-05-2025 21h11 02h08 (159).m2ts";
        const nomDeFichierParse = CheminDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(CheminDeFichierFreebox.from({
            chaine: "6ter",
            milieu: "Jours de tonnerre",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "13-05-2025 21h11 02h08 (159).m2ts",
        }));
    });

    it("parseFileName Jours de tonnerre.m2ts.idx", () => {
        const nomOriginal = "6ter - Jours de tonnerre - 13-05-2025 21h11 02h08 (159).m2ts.idx";
        const nomDeFichierParse = CheminDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(CheminDeFichierFreebox.from({
            chaine: "6ter",
            milieu: "Jours de tonnerre",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "13-05-2025 21h11 02h08 (159).m2ts.idx",
        }));
    });

    it("parseFileName Meurtres au paradis", () => {
        const nomOriginal = "France 2 - Meurtres au paradis (Saison 1 - épisode 1 8 L'armoire des scellés) - 12-05-2025 23h50 01h30 (158).m2ts";
        const nomDeFichierParse = CheminDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(CheminDeFichierFreebox.from({
            chaine: "France 2",
            milieu: "Meurtres au paradis (Saison 1 - épisode 1 8 L'armoire des scellés)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "12-05-2025 23h50 01h30 (158).m2ts",
        }));
    });

    it("parseFileName Columbo S08.E04", () => {
        const nomOriginal = "TMC - Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats) - 11-10-2025 21h00 02h20 (188).m2ts";
        const nomDeFichierParse = CheminDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(CheminDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "11-10-2025 21h00 02h20 (188).m2ts",
        }));
    });

    it("parseFileName Columbo S09.E03", () => {
        const nomOriginal = "TMC - Columbo (Saison 9 - épisode 3 6 Votez pour moi) - 10-05-2025 21h00 02h20 (154).m2ts";
        const nomDeFichierParse = CheminDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(CheminDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Saison 9 - épisode 3 6 Votez pour moi)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "10-05-2025 21h00 02h20 (154).m2ts",
        }));
    });

    it("parseFileName Columbo (saison inconnue)", () => {
        const nomOriginal = "TMC - Columbo (Couronne mortuaire) - 04-01-2025 21h15 01h50 (77).m2ts";
        const nomDeFichierParse = CheminDeFichierFreebox.parseFileName(nomOriginal);
        expect(nomDeFichierParse).toStrictEqual(CheminDeFichierFreebox.from({
            chaine: "TMC",
            milieu: "Columbo (Couronne mortuaire)",
            nomOriginal: nomOriginal,
            separateur: " - ",
            timestampDureeExtensions: "04-01-2025 21h15 01h50 (77).m2ts",
        }));
    });
});

describe("CheminDeFichierFreeboxParSerieV1", () => {

    describe("depuisCible()", () => {

        test("Columbo S08.E04", () => {
            const nomDeFichier = "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats) - TMC - 11-10-2025 21h00 02h20 (188).m2ts";
            const nomDeFichierParse = CheminDeFichierFreeboxParSerieV1.depuisCible("Columbo", nomDeFichier);
            expect(nomDeFichierParse).toEqual({
                sousDossiers: [
                    "Par série",
                    "Columbo",
                ],
                serie: "Columbo",
                milieu: "Columbo (Saison 8 - épisode 4 4 Grandes manoeuvres et petits soldats)",
                separateur: " - ",
                chaine: "TMC",
                timestampDureeExtensions: "11-10-2025 21h00 02h20 (188).m2ts",
            });
        });

        test("Columbo (saison inconnue)", () => {
            const nomDeFichier = "Columbo (Couronne mortuaire) - TMC - 04-01-2025 21h15 01h50 (77).m2ts";
            const nomDeFichierParse = CheminDeFichierFreeboxParSerieV1.depuisCible("Columbo", nomDeFichier);
            expect(nomDeFichierParse).toEqual({
                sousDossiers: [
                    "Par série",
                    "Columbo",
                ],
                serie: "Columbo",
                milieu: "Columbo (Couronne mortuaire)",
                separateur: " - ",
                chaine: "TMC",
                timestampDureeExtensions: "04-01-2025 21h15 01h50 (77).m2ts",
            });
        });

    });

});

describe("CheminDeFichierFreeboxParSerieV2", () => {

    describe("entier", () => {

        test("Columbo S08.E04", () => {
            const chemin = new CheminDeFichierFreeboxParSerieV2(
                [
                    "Par série",
                    "Columbo",
                    "Saison 8",
                ],
                "Columbo", 8, 4,
                "Grandes manoeuvres et petits soldats",
                " - ",
                "TMC",
                "11-10-2025 21h00 02h20 (188).m2ts"
            );
            expect(chemin.entier).toBe(path.join(
                "Par série",
                "Columbo",
                "Saison 8",
                "Columbo - s08e04 - Grandes manoeuvres et petits soldats - TMC - 11-10-2025 21h00 02h20 (188).m2ts",
            ));
        });

    });

});
