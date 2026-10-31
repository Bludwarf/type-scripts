import {describe, expect, it} from "vitest";
import {
    alreadyProgrammed,
    epgProgramToString,
    matchesWatchlist,
    toEpgProgram,
    type EpgProgram,
    type ExternalEpgProgramRaw,
    type PrecordSummary,
} from "./freebox-tv-watcher";

// ---------------------------------------------------------------------------
// Ces tests couvrent uniquement les fonctions PURES du script (pas de réseau,
// pas de fichier, pas d'horloge système ambiguë) : matchesWatchlist,
// toEpgProgram, alreadyProgrammed, epgProgramToString.
//
// Non couvert ici (nécessiterait de mocker fetch/fs, pas fait pour rester
// simple) : loadOrCreateAppToken, openSession, loadExternalEpg,
// fetchExistingPrecords, scheduleRecording, fetchJson (retry/backoff 429).
// ---------------------------------------------------------------------------

function makeProgram(overrides: Partial<EpgProgram> = {}): EpgProgram {
    return {
        id: "test_1",
        title: "Columbo",
        sub_title: "Le Livre témoin",
        start: 1785270000, // 2026-07-29T21:00:00Z environ
        duration: 5400, // 1h30
        ...overrides,
    };
}

describe("matchesWatchlist", () => {
    it("matche un titre présent dans la watchlist (insensible à la casse)", () => {
        const program = makeProgram({title: "columbo"});
        expect(matchesWatchlist(program, ["Columbo"])).toBe(true);
    });

    it("matche aussi via le sous-titre", () => {
        const program = makeProgram({title: "Unforgettable", sub_title: "Meurtre à Hollywood"});
        expect(matchesWatchlist(program, ["hollywood"])).toBe(true);
    });

    it("ne matche pas un titre absent de la watchlist", () => {
        const program = makeProgram({title: "Journal de 20h", sub_title: undefined});
        expect(matchesWatchlist(program, ["Columbo", "Unforgettable"])).toBe(false);
    });

    it("gère une watchlist vide (aucun match)", () => {
        const program = makeProgram();
        expect(matchesWatchlist(program, [])).toBe(false);
    });

    it("matche une correspondance partielle (includes, pas égalité stricte)", () => {
        const program = makeProgram({title: "Columbo - Le Livre témoin", sub_title: undefined});
        expect(matchesWatchlist(program, ["Columbo"])).toBe(true);
    });
});

describe("toEpgProgram", () => {
    function makeExternal(overrides: Partial<ExternalEpgProgramRaw> = {}): ExternalEpgProgramRaw {
        return {
            channel: "TMC.fr@France",
            start: 1785270000000, // millisecondes
            stop: 1785275400000, // + 1h30
            titles: [{value: "Columbo", lang: "fr"}],
            subTitles: [{value: "Le Livre témoin", lang: "fr"}],
            ...overrides,
        };
    }

    it("convertit les millisecondes en secondes", () => {
        const program = toEpgProgram(makeExternal());
        expect(program.start).toBe(1785270000);
    });

    it("calcule la durée en secondes à partir de start/stop", () => {
        const program = toEpgProgram(makeExternal());
        expect(program.duration).toBe(5400);
    });

    it("extrait le titre depuis titles[0].value", () => {
        const program = toEpgProgram(makeExternal({titles: [{value: "Arte Journal", lang: "fr"}]}));
        expect(program.title).toBe("Arte Journal");
    });

    it("retombe sur un titre par défaut si titles est vide", () => {
        const program = toEpgProgram(makeExternal({titles: []}));
        expect(program.title).toBe("(sans titre)");
    });

    it("laisse sub_title undefined si subTitles est vide", () => {
        const program = toEpgProgram(makeExternal({subTitles: []}));
        expect(program.sub_title).toBeUndefined();
    });

    it("extrait le sous-titre depuis subTitles[0].value quand présent", () => {
        const program = toEpgProgram(makeExternal());
        expect(program.sub_title).toBe("Le Livre témoin");
    });

    it("génère un id synthétique stable (channel + start)", () => {
        const program = toEpgProgram(makeExternal());
        expect(program.id).toBe("TMC.fr@France_1785270000");
    });
});

describe("alreadyProgrammed", () => {
    const existing: PrecordSummary[] = [
        {channel_uuid: "uuid-webtv-497", start: 1785270000, end: 1785275400},
        {channel_uuid: "uuid-webtv-201", start: 1785280000, end: 1785283000},
    ];

    it("détecte un précord existant (même chaîne + même start)", () => {
        expect(alreadyProgrammed(existing, "uuid-webtv-497", 1785270000)).toBe(true);
    });

    it("ignore un précord sur une autre chaîne au même horaire", () => {
        expect(alreadyProgrammed(existing, "uuid-webtv-999", 1785270000)).toBe(false);
    });

    it("ignore un précord sur la même chaîne à un autre horaire", () => {
        expect(alreadyProgrammed(existing, "uuid-webtv-497", 1785271000)).toBe(false);
    });

    it("renvoie false sur une liste vide", () => {
        expect(alreadyProgrammed([], "uuid-webtv-497", 1785270000)).toBe(false);
    });
});

describe("epgProgramToString", () => {
    it("inclut le titre du programme", () => {
        const text = epgProgramToString(makeProgram({title: "Columbo"}));
        expect(text).toContain("Columbo");
    });

    it("respecte le format \"titre - jj-mm-aaaa hhhmm hhhmm\"", () => {
        const text = epgProgramToString(makeProgram());
        // Format volontairement vérifié par structure plutôt que valeur exacte,
        // le rendu de date dépendant du fuseau horaire d'exécution (toDate()).
        expect(text).toMatch(/^.+ - \d{2}-\d{2}-\d{4} \d{2}h\d{2} \d{2}h\d{2}$/);
    });

    it("formate une durée d'1h30 en \"01h30\"", () => {
        const text = epgProgramToString(makeProgram({duration: 5400}));
        expect(text).toContain("01h30");
    });

    it("formate une durée de 45min en \"00h45\"", () => {
        const text = epgProgramToString(makeProgram({duration: 2700}));
        expect(text).toContain("00h45");
    });
});
