# GSI3 UserInteraction Backfill Migration

Ce script de migration ajoute les champs GSI3PK et GSI3SK aux entités UserInteraction existantes pour supporter les requêtes analytics optimisées.

## Contexte

Les entités UserInteraction avaient besoin d'un nouveau GSI (GSI3) pour permettre des requêtes efficaces par type d'interaction et plage de dates, notamment pour les métriques analytics.

### Nouveau schéma GSI3

- **GSI3PK**: `INTERACTION#{interactionType}` (ex: "INTERACTION#like", "INTERACTION#bookmark")
- **GSI3SK**: `{createdAt}` (timestamp ISO 8601)

## Usage

### Test en mode dry-run (recommandé d'abord)

```bash
# Test local
cd scripts
node backfill-gsi3-user-interactions.js --env=local --dry-run

# Test staging
node backfill-gsi3-user-interactions.js --env=stage --dry-run

# Test production
node backfill-gsi3-user-interactions.js --env=prod --dry-run
```

### Exécution réelle

```bash
# Local
node backfill-gsi3-user-interactions.js --env=local

# Staging
node backfill-gsi3-user-interactions.js --env=stage

# Production
node backfill-gsi3-user-interactions.js --env=prod
```

## Variables d'environnement requises

Le script utilise les fichiers `.env.{environment}` dans le dossier `/scripts` :

- `DYNAMODB_TABLE`: Nom de la table DynamoDB
- `AWS_ACCESS_KEY_ID`: Clé d'accès AWS
- `AWS_SECRET_ACCESS_KEY`: Clé secrète AWS
- `AWS_REGION`: Région AWS
- `LOCAL_AWS_ENDPOINT`: Endpoint local (pour `--env=local`)

## Logique du script

1. **Scan**: Recherche toutes les entités avec `EntityType = "UserInteraction"` qui n'ont pas `GSI3PK`
2. **Extraction**: Extrait le type d'interaction depuis le `SK` (format: `INTERACTION#{type}#{targetId}`)
3. **Update**: Ajoute `GSI3PK` et `GSI3SK` à chaque entité
4. **Batch processing**: Traite les items par lots de 10 pour éviter le rate limiting

## Impact

### Avant la migration

```javascript
// Requête analytics inefficace - nécessitait un Scan
const likesResult = await docClient.send(
  new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression:
      "begins_with(PK, :pk) AND begins_with(SK, :sk) AND createdAt BETWEEN :start AND :end",
    // ...très coûteux
  })
);
```

### Après la migration

```javascript
// Requête analytics optimisée - utilise GSI3
const likesResult = await docClient.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI3",
    KeyConditionExpression: "GSI3PK = :pk AND GSI3SK BETWEEN :start AND :end",
    ExpressionAttributeValues: {
      ":pk": "INTERACTION#like",
      ":start": startTime,
      ":end": endTime,
    },
    Select: "COUNT",
  })
);
```

## Sécurité

- Mode **dry-run** par défaut pour tester en sécurité
- Validation des données avant update
- Gestion d'erreurs avec continuation
- Logging détaillé de toutes les opérations

## Rollback

En cas de problème, les champs GSI3 peuvent être supprimés :

```javascript
await docClient.send(
  new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK },
    UpdateExpression: "REMOVE GSI3PK, GSI3SK",
  })
);
```

## Performance attendue

- **Scan initial**: ~1-2 secondes pour 1000 interactions
- **Updates**: ~10ms par item
- **Batch de 10**: ~100ms + 100ms délai = 200ms par batch
- **Estimation**: ~1000 interactions = ~20 secondes

## Validation post-migration

Vérifier qu'une requête analytics fonctionne :

```bash
# Tester les nouvelles requêtes analytics
npm run test:backend -- --testNamePattern="analytics"
```
