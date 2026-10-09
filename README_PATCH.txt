TTT 3.5 — MODE ÉVOLUTION MULTIJOUEUR

Fichiers à remplacer/ajouter à la racine du projet :
- server.js
- Rencontre/rencontre.html
- Multiplayer/multiplayer.js
- Multiplayer/evolution-multi.html (nouveau)
- Multiplayer/evolution-multi.css (nouveau)
- Multiplayer/evolution-multiplayer.js (nouveau)
- tests/evolution-multi.test.js (nouveau, facultatif pour jouer)

Le moteur js/evolution-engine.js déjà présent est réutilisé côté navigateur ET côté serveur.

Fonctions incluses : lobby, code privé, choix de Style individuel, règles hôte,
ready, pile ou face serveur, Points d'Effet, Ajout/Effacement, 8 Styles,
Gambling serveur, Bomb privée, timer, BO1/3/5, replay, abandon, revanche,
reconnexion et protection Classique/Évolution entre les salles.
