# Kit d'installation de GESTIME (sans données)

Fichiers pour fabriquer l'installateur Windows (Electron + NSIS) avec `CREER-INSTALLATEUR.bat`.

À ajouter avant de fabriquer l'installateur (jamais sur GitHub) :
- `index.html` : prendre celui de la racine du dépôt (dernière version, sans données) ;
- `config.js` : remplir `url` et `key` (clé « publishable » uniquement) ;
- les données de départ éventuelles restent dans le dossier privé du gérant.

`supabase.sql` : crée la table `store` (ligne 1 = BREDIS, 2 = CLAMART), à lancer une fois dans Supabase > SQL Editor.
