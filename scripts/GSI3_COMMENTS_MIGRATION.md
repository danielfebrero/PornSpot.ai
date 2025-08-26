# GSI3 Comment Backfill Migration

Ce script de migration ajoute les champs GSI3PK et GSI3SK aux entités Comment existantes pour supporter les requêtes analytics optimisées sur les interactions de type commentaire.

## Contexte

Les entités Comment avaient besoin d'un nouveau GSI (GSI3) pour permettre des requêtes efficaces par type d'interaction et plage de dates, notamment pour les métriques analytics et les tableaux de bord administrateur.

### Nouveau schéma GSI3 pour Comments

- **GSI3PK**: `"INTERACTION#comment"` (constant pour tous les commentaires)
- **GSI3SK**: `{createdAt}` (timestamp ISO 8601)

Cette structure permet de :

- Compter tous les commentaires créés dans une plage de dates
- Analyser l'activité des commentaires par période
- Optimiser les requêtes pour les métriques analytics

## Usage

```bash
# Test en mode dry-run (recommandé)
node scripts/backfill-gsi3-comments.js --env=local --dry-run

# Exécution réelle en local
node scripts/backfill-gsi3-comments.js --env=local

# Exécution en production
node scripts/backfill-gsi3-comments.js --env=prod
```

## Variables d'environnement requises

Le script utilise les fichiers `.env.{environment}` dans le dossier `/scripts` :

- `DYNAMODB_TABLE`: Nom de la table DynamoDB
- `AWS_ACCESS_KEY_ID`: Clé d'accès AWS
- `AWS_SECRET_ACCESS_KEY`: Clé secrète AWS
- `AWS_REGION`: Région AWS
- `LOCAL_AWS_ENDPOINT`: Endpoint local (pour `--env=local`)

## Logique du script

1. **Scan**: Recherche toutes les entités avec `EntityType = "Comment"` qui n'ont pas `GSI3PK`
2. **Validation**: Vérifie que chaque commentaire a un `createdAt` valide
3. **Update**: Ajoute `GSI3PK = "INTERACTION#comment"` et `GSI3SK = createdAt` à chaque entité
4. **Batch processing**: Traite les items par lots de 10 pour éviter le rate limiting

### Structure des données avant/après

**Avant la migration:**

```javascript
{
  PK: "COMMENT#12345",
  SK: "METADATA",
  GSI1PK: "COMMENTS_BY_TARGET#album#abc123",
  GSI1SK: "2024-08-26T10:30:00Z",
  GSI2PK: "COMMENTS_BY_USER#user456",
  GSI2SK: "2024-08-26T10:30:00Z",
  // GSI3PK et GSI3SK manquants
  EntityType: "Comment",
  id: "12345",
  content: "Great album!",
  createdAt: "2024-08-26T10:30:00Z",
  // ...autres champs
}
```

**Après la migration:**

```javascript
{
  PK: "COMMENT#12345",
  SK: "METADATA",
  GSI1PK: "COMMENTS_BY_TARGET#album#abc123",
  GSI1SK: "2024-08-26T10:30:00Z",
  GSI2PK: "COMMENTS_BY_USER#user456",
  GSI2SK: "2024-08-26T10:30:00Z",
  GSI3PK: "INTERACTION#comment",        // ✅ Ajouté
  GSI3SK: "2024-08-26T10:30:00Z",       // ✅ Ajouté
  EntityType: "Comment",
  id: "12345",
  content: "Great album!",
  createdAt: "2024-08-26T10:30:00Z",
  // ...autres champs
}
```

## Impact

### Avant la migration

```javascript
// Requête analytics inefficace - nécessitait un Scan
const commentsResult = await docClient.send(
  new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression:
      "EntityType = :entityType AND createdAt BETWEEN :start AND :end",
    ExpressionAttributeValues: {
      ":entityType": "Comment",
      ":start": startTime,
      ":end": endTime,
    },
    // ...très coûteux sur une grande table
  })
);
```

### Après la migration

```javascript
// Requête analytics optimisée - utilise GSI3
const commentsResult = await docClient.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI3",
    KeyConditionExpression: "GSI3PK = :pk AND GSI3SK BETWEEN :start AND :end",
    ExpressionAttributeValues: {
      ":pk": "INTERACTION#comment",
      ":start": startTime,
      ":end": endTime,
    },
    Select: "COUNT",
  })
);
```

### Cas d'usage activés

1. **Métriques analytics** : Compter les commentaires par période
2. **Tableaux de bord** : Afficher l'évolution de l'activité commentaires
3. **Rapports d'engagement** : Analyser les interactions utilisateur
4. **Monitoring** : Surveiller les pics d'activité

## Sécurité

- Mode **dry-run** par défaut pour tester en sécurité
- Validation des données avant update (vérification du `createdAt`)
- Gestion d'erreurs avec continuation (un échec n'arrête pas le processus)
- Logging détaillé de toutes les opérations
- Condition `attribute_exists(PK)` pour éviter les conflits

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

- **Scan initial**: ~1-2 secondes pour 1000 commentaires
- **Updates**: ~10ms par item
- **Batch de 10**: ~100ms + 100ms délai = 200ms par batch
- **Estimation**: ~1000 commentaires = ~20 secondes

### Optimisations appliquées

- Traitement par lots de 10 items
- Délai de 100ms entre les lots pour éviter le throttling
- Projection limitée pendant le scan (seulement les champs nécessaires)
- Condition d'existence pour éviter les erreurs

## Validation post-migration

### 1. Vérifier que tous les commentaires ont les champs GSI3

```javascript
const result = await docClient.send(
  new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression:
      "EntityType = :entityType AND attribute_not_exists(GSI3PK)",
    ExpressionAttributeValues: {
      ":entityType": "Comment",
    },
    Select: "COUNT",
  })
);

console.log(`Comments sans GSI3: ${result.Count}`); // Devrait être 0
```

### 2. Tester une requête GSI3

```javascript
const testQuery = await docClient.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI3",
    KeyConditionExpression: "GSI3PK = :pk",
    ExpressionAttributeValues: {
      ":pk": "INTERACTION#comment",
    },
    Limit: 10,
  })
);

console.log(`Comments trouvés via GSI3: ${testQuery.Items.length}`);
```

### 3. Vérifier la structure des données

```javascript
const sampleComment = await docClient.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI3",
    KeyConditionExpression: "GSI3PK = :pk",
    ExpressionAttributeValues: {
      ":pk": "INTERACTION#comment",
    },
    Limit: 1,
  })
);

const comment = sampleComment.Items[0];
console.log("Exemple de commentaire migré:");
console.log(`- GSI3PK: ${comment.GSI3PK}`);
console.log(`- GSI3SK: ${comment.GSI3SK}`);
console.log(`- createdAt: ${comment.createdAt}`);
```

## Monitoring

Pendant la migration, surveiller :

1. **CloudWatch DynamoDB** : Métriques de consommation RCU/WCU
2. **Logs du script** : Succès/échecs des updates
3. **Performance** : Temps d'exécution par batch
4. **Erreurs** : Tout pattern d'erreur récurrent

## Notes importantes

- ⚠️ **Toujours tester en dry-run d'abord**
- 🔄 **La migration est idempotente** : peut être relancée sans risque
- 📊 **Compatible avec les nouveaux commentaires** : ceux-ci ont déjà les champs GSI3
- 🚀 **Aucun impact sur les performances** pendant la migration (lots de 10)
- 💾 **Pas de downtime** requis : les applications continuent de fonctionner
