# GSI3 Album Backfill Migration

Ce script met à jour les entités **Album** existantes pour leur ajouter les clés GSI3 utilisées par les requêtes "albums par créateur".

## Nouveau schéma GSI3 pour les albums

- **GSI3PK** : `"ALBUM_BY_USER_<isPublic>"`
- **GSI3SK** : `"<createdBy>#<createdAt>#<albumId>"`

Cette structure permet :

- De récupérer rapidement les albums d'un créateur en fonction de leur visibilité
- De trier efficacement les albums par date de création
- De préparer des requêtes pour les tableaux de bord et flux personnalisés

## Script

```bash
node scripts/backfill-gsi3-albums.js --env=stage --dry-run
```

Options principales :

| Option              | Description                                          | Valeur par défaut |
| ------------------- | ---------------------------------------------------- | ----------------- |
| `--env=<env>`       | Charge `scripts/.env.<env>` pour configurer DynamoDB | `.env`            |
| `--dry-run`         | Affiche les mises à jour sans écrire en base         | `false`           |
| `--concurrency=<n>` | Nombre d'updates parallèles                          | `75`              |
| `--page-size=<n>`   | Nombre d'éléments lus par requête                    | `500`             |

## Pré-requis

Les fichiers `.env.<env>` dans `/scripts` doivent définir :

- `DYNAMODB_TABLE`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (si nécessaire)
- `LOCAL_AWS_ENDPOINT` pour les tests LocalStack

## Stratégie de backfill

1. **Query GSI1** (`GSI1PK = "ALBUM"`) pour ne lire que les métadonnées Album
2. **Projection minimale** : `PK`, `SK`, `id`, `createdAt`, `createdBy`, `isPublic`
3. **Calcul** des clés attendues :
   - `GSI3PK = ALBUM_BY_USER_<isPublic>` (avec normalisation `true`/`false`)
   - `GSI3SK = <createdBy>#<createdAt>#<albumId>`
4. **Mise à jour conditionnelle** (`attribute_exists(PK)`) uniquement si les clés diffèrent
5. **Mode dry-run** pour vérifier les statistiques avant exécution réelle

## Validation

Après exécution, vérifier que plus aucun album n'est sans GSI3 :

```javascript
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");

const result = await docClient.send(
  new ScanCommand({
    TableName: process.env.DYNAMODB_TABLE,
    FilterExpression:
      "EntityType = :album AND (attribute_not_exists(GSI3PK) OR attribute_not_exists(GSI3SK))",
    ExpressionAttributeValues: {
      ":album": "Album",
    },
    Select: "COUNT",
  })
);

console.log(`Albums sans GSI3: ${result.Count}`);
```

## Remarques

- Les albums sans `createdBy`, `createdAt` ou `isPublic` sont ignorés et listés dans les statistiques `missing`.
- Ajustez `--concurrency` en fonction de la capacité provisionnée DynamoDB pour éviter le throttling.
- Le script journalise un récapitulatif (updated / skipped / missing / errors) en fin d'exécution.
