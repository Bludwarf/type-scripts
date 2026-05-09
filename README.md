# Installation

```shell
ssh blustation
cd /volume1/Logiciels/Synology/Scripts/
git fetch --all && git reset --hard origin/master
npm install
```

# Trier enregistrement

Créer un dossier `Par série`, puis un sous-dossier pour chaque série connue.

```shell
npm run trier-enregistrements -- /volume1/video/Enregistrements/
```

TODO :

- Problème de détection du renommage avec Columbo saisons 11, 12 et 13  :
  - `Columbo - s11e01 - Meurtre au champagne - TMC - 20-12-2025 21h00 02h20 (195).m2ts`
  - `Columbo - s12e02 - Face à face - TMC - 01-11-2025 21h00 02h15 (192).m2ts`
  - `Columbo - s13e01 - Une étrange association - TMC - 14-06-2025 21h00 02h20 (176).m2ts`

# Renommer enregistrement

À lancer en cas de changement de nommage.

```shell
npm run renommer-enregistrements -- /volume1/video/Enregistrements/
```

# cut-m2ts.ts

**DEPRECATED** : Utiliser simplement un fichier edl à côté de la vidéo pour
Kodi. [Source](https://kodi.wiki/view/Edit_decision_list)
