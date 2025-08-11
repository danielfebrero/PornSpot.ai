# Documentation de l'API ComfyUI (Détaillée)

ComfyUI expose plusieurs points de terminaison (endpoints) pour interagir avec ses fonctionnalités de manière programmatique. Pour utiliser l'API, vous devez généralement enregistrer votre workflow au format API JSON via l'option "Save (API format)" dans les "Dev mode options" de ComfyUI. [2, 5] L'API utilise fortement les WebSockets pour les mises à jour en temps réel. [1, 2]

## 1. WebSocket : Gestion et Messages

- **Endpoint :** `/ws`
- **Méthode :** WebSocket
- **Description :** Établit une connexion WebSocket pour des mises à jour en temps réel sur l'état de la file d'attente, la progression des tâches, et les messages d'exécution. [1, 2, 9] Un `client_id` unique (généralement un UUID) est requis lors de la connexion WebSocket et doit être passé en paramètre de requête (`ws://SERVER_ADDRESS/ws?clientId=YOUR_CLIENT_ID`). [1, 12]
- **Gestion de la connexion :**

  - **Établissement :** Le client initie une connexion WebSocket vers l'endpoint `/ws`. [1] Il est crucial de fournir un `clientId` unique. [1, 12]
  - **Réception des messages :** Une fois la connexion établie, le serveur ComfyUI enverra des messages JSON au client pour l'informer des différents événements. [17, 19, 25]
  - **Types de messages courants via WebSocket :**
    - `status`: Fournit l'état actuel de la file d'attente (nombre total de prompts, prompts restants). [1, 17]
      - Exemple de message `status`:
        ```json
        {
          "type": "status",
          "data": {
            "status": {
              "exec_info": {
                "queue_remaining": 0
              }
            },
            "sid": "OPTIONAL_SESSION_ID"
          }
        }
        ```
    - `progress`: Indique la progression d'une tâche spécifique (par exemple, un KSampler). [17]
      - Exemple de message `progress`:
        ```json
        {
          "type": "progress",
          "data": {
            "value": 5,
            "max": 20,
            "node": "NODE_ID_KSAMPLER" // Peut être null
          }
        }
        ```
    - `progress_state`: Version améliorée du message `progress` avec des informations d'état détaillées par nœud. **Nouveau type de message observé (Août 2025)**.
      - Fournit des informations de progression granulaires pour chaque nœud de workflow en cours d'exécution
      - Exemple de message `progress_state`:
        ```json
        {
          "type": "progress_state",
          "data": {
            "prompt_id": "204b894c-2165-4b6d-998f-fb9aaec58117",
            "nodes": {
              "3": {
                "value": 16,
                "max": 20,
                "state": "running",
                "node_id": "3",
                "prompt_id": "204b894c-2165-4b6d-998f-fb9aaec58117",
                "display_node_id": "3",
                "parent_node_id": null,
                "real_node_id": "3"
              }
            }
          }
        }
        ```
    - `executing`: Signale qu'un nœud spécifique commence son exécution ou que l'exécution du prompt est terminée. [19, 25]
      - Lorsque l'exécution d'un prompt est terminée, le message `executing` aura `node` à `null` et contiendra le `prompt_id`. [19, 25]
      - Exemple de message `executing` (début d'un nœud) :
        ```json
        {
          "type": "executing",
          "data": {
            "node": "NODE_ID_BEING_EXECUTED",
            "prompt_id": "PROMPT_ID_EXAMPLE"
          }
        }
        ```
      - Exemple de message `executing` (fin du prompt) :
        ```json
        {
          "type": "executing",
          "data": {
            "node": null,
            "prompt_id": "PROMPT_ID_EXAMPLE"
          }
        }
        ```
    - `execution_start`: Indique le début de l'exécution d'un prompt.
    - `execution_cached`: Indique que la sortie d'un nœud a été récupérée du cache.
    - `executed`: Indique qu'un nœud a terminé son exécution et fournit les sorties du nœud. C'est par ce message que vous pouvez obtenir les images de prévisualisation (si un nœud de prévisualisation est utilisé) avant la fin complète du prompt.
      - Exemple de message `executed` (avec une image de prévisualisation) :
        ```json
        {
          "type": "executed",
          "data": {
            "node": "NODE_ID_PREVIEW_IMAGE",
            "output": {
              "images": [
                {
                  "filename": "ComfyUI_temp_somerandom_00001_.png",
                  "subfolder": "",
                  "type": "temp"
                }
              ]
            },
            "prompt_id": "PROMPT_ID_EXAMPLE"
          }
        }
        ```
    - D'autres types de messages peuvent exister, notamment pour les erreurs ou des événements spécifiques aux extensions. [17]
  - **Envoi de messages :** Généralement, le client n'envoie pas de messages au serveur via WebSocket après la connexion initiale, sauf pour des cas d'usage très spécifiques définis par certaines extensions. La communication est majoritairement unidirectionnelle (serveur vers client) pour les mises à jour.
  - **Fermeture :** La connexion peut être fermée par le client ou le serveur. Des erreurs ou des fermetures inattendues doivent être gérées avec une logique de reconnexion si nécessaire. [22]

- **Exemple (JavaScript) pour établir une connexion WebSocket :**

  ```javascript
  const clientId = crypto.randomUUID(); // Génère un ID client unique
  const socket = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);

  socket.onopen = () => {
    console.log("Connecté au serveur ComfyUI via WebSocket.");
  };

  socket.onmessage = (event) => {
    if (typeof event.data === "string") {
      const message = JSON.parse(event.data);
      console.log("Message WebSocket reçu:", message);
      // Traitez les différents types de messages ici
      if (message.type === "status") {
        // Gérer le message de statut
      } else if (message.type === "progress") {
        // Gérer le message de progression
      } else if (message.type === "executing") {
        // Si message.data.node est null et message.data.prompt_id correspond
        // alors le prompt est terminé.
        if (
          message.data.node === null &&
          message.data.prompt_id === your_prompt_id
        ) {
          console.log(`Le prompt ${your_prompt_id} est terminé.`);
          // Vous pouvez maintenant appeler /history/{prompt_id} pour obtenir les résultats finaux.
        }
      } else if (message.type === "executed") {
        // Gérer les sorties de nœuds (ex: images de prévisualisation)
        if (message.data.output.images) {
          // Une image de prévisualisation est disponible
        }
      }
    } else if (event.data instanceof ArrayBuffer) {
      // Gérer les données binaires (par exemple, images directes via des nœuds WebSocket spécifiques)
      // Ceci est moins courant pour le suivi de statut standard
      console.log("Données binaires reçues.");
    }
  };

  socket.onerror = (error) => {
    console.error("Erreur WebSocket:", error);
  };

  socket.onclose = () => {
    console.log("Connexion WebSocket fermée.");
  };
  ```

## 2. Soumettre un Prompt (Mettre en file d'attente)

- **Endpoint :** `/prompt`
- **Méthode :** `POST`
- **Description :** Met en file d'attente un workflow (prompt) pour exécution. [1, 2, 9] Le corps de la requête doit contenir la définition du workflow (au format API JSON obtenu via "Save (API format)") et un `client_id`. [1, 12]
- **`client_id` :** Oui, le `client_id` est nécessaire dans le corps de la requête POST vers `/prompt`. [12] Il permet au serveur d'associer ce prompt à la session WebSocket du client pour les mises à jour. [20]
- **Corps de la requête :**
  ```json
  {
    "prompt": {
      // ... Votre graphe de workflow au format API JSON ...
      // Exemple:
      // "3": {
      //   "class_type": "KSampler",
      //   "inputs": {
      //     "seed": 1234567890,
      //     "steps": 20,
      //     // ... autres inputs du KSampler
      //   }
      // },
      // "9": {
      //   "class_type": "SaveImage",
      //   "inputs": {
      //     "filename_prefix": "ComfyUI_Generated",
      //     "images": ["8", 0] // "8" est l'ID du nœud VAE Decode, 0 est l'index de la sortie
      //   }
      // }
    },
    "client_id": "VOTRE_CLIENT_ID_UNIQUE_CORRESPONDANT_A_LA_SESSION_WEBSOCKET",
    "extra_data": {
      // Optionnel: Peut contenir des informations supplémentaires comme le `prompt_id` pour des cas avancés
      "extra_pnginfo": {
        "workflow": {
          /* ... workflow complet pour l'intégration dans les métadonnées PNG ... */
        }
      }
    }
    // "front": true // Optionnel, si le prompt doit être ajouté au début de la file d'attente
    // "number": 0 // Optionnel, pour définir une position spécifique ou un numéro de lot
  }
  ```
- **Réponse :**
  - En cas de succès : JSON contenant `prompt_id`, `number` (position dans la file), et `node_errors` (généralement vide en cas de succès).
    ```json
    {
      "prompt_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "number": 10, // Numéro dans la file d'attente
      "node_errors": {}
    }
    ```
  - En cas d'erreur (par exemple, JSON malformé, workflow invalide) : Un code d'erreur HTTP (4xx ou 5xx) avec des détails sur l'erreur.

## 3. Suivi de l'État d'un Prompt via HTTP (Polling)

Bien que WebSocket soit la méthode privilégiée pour un suivi en temps réel, vous pouvez connaître l'état d'un `prompt_id` en interrogeant périodiquement (polling) les endpoints `/queue` et `/history/{prompt_id}`.

- **a) Vérifier si le prompt est en file d'attente ou en cours d'exécution :**

  - **Endpoint :** `/queue`
  - **Méthode :** `GET`
  - **Description :** Récupère l'état actuel de la file d'attente. [3, 9]
  - **Analyse de la réponse :**
    La réponse contient deux listes principales : `queue_running` (prompts en cours d'exécution) et `queue_pending` (prompts en attente). [3]
    - **`queue_running`**: Liste des prompts actuellement en cours d'exécution. Chaque élément est un tableau `[priority, prompt_id, prompt_object, client_id, extra_data]`.
    - **`queue_pending`**: Liste des prompts en attente. Même structure que `queue_running`.
  - **Déterminer l'état :**
    1.  Recherchez votre `prompt_id` dans `queue_running`. Si trouvé, le prompt est **"in progress"**.
    2.  S'il n'est pas dans `queue_running`, recherchez-le dans `queue_pending`. Si trouvé, le prompt est **"in queue"**.
    3.  S'il n'est trouvé dans aucune des deux listes, il est possible qu'il soit déjà **"completed"**, **"canceled"**, ou qu'il y ait eu une **"error"** avant même d'entrer dans la file (peu probable si `/prompt` a renvoyé un `prompt_id`).
  - **Exemple de réponse `/queue` :**
    ```json
    {
      "queue_running": [
        // [0, "prompt_id_en_cours", {prompt_workflow}, "client_id_associe", {}]
      ],
      "queue_pending": [
        // [1, "votre_prompt_id", {votre_prompt_workflow}, "votre_client_id", {}],
        // [2, "autre_prompt_id", {autre_prompt_workflow}, "autre_client_id", {}]
      ]
    }
    ```

- **b) Vérifier si le prompt est complété (et obtenir les résultats) :**

  - **Endpoint :** `/history/{prompt_id}`
  - **Méthode :** `GET`
  - **Description :** Récupère l'historique d'exécution et les résultats pour un `prompt_id` spécifique. [1, 2, 9] Si le prompt est encore en file d'attente ou en cours, l'endpoint `/history/{prompt_id}` peut ne rien retourner ou retourner une structure indiquant qu'il n'est pas encore terminé. [6] Une fois terminé, il contiendra les informations de sortie.
  - **Analyse de la réponse :**
    - Si le `prompt_id` n'est pas trouvé ou n'est pas encore complété, la réponse peut être un objet vide `{}` ou une structure indiquant que le prompt n'est pas encore dans l'historique.
    - Si le `prompt_id` est complété, la réponse sera un objet JSON où la clé est le `prompt_id`. Cet objet contient :
      - `prompt`: Un tableau de 6 éléments `[prompt_id, save_time, client_id, prompt_object, extra_data, outputs_object_ids]`.
      - `outputs`: Un objet où les clés sont les ID des nœuds qui ont produit des sorties (par exemple, un nœud "SaveImage" ou "PreviewImage"). Chaque sortie de nœud contient une liste d'artefacts (par exemple, des images avec `filename`, `subfolder`, `type`). [1]
      - `status`: Un objet contenant des informations sur l'état d'exécution, y compris si des erreurs se sont produites.
  - **Déterminer l'état :**
    1.  Si l'appel à `/history/{prompt_id}` retourne des données valides avec des `outputs` pour votre `prompt_id`, alors le prompt est **"completed"**.
    2.  Vérifiez le champ `status` dans la réponse de l'historique pour des messages d'erreur spécifiques qui pourraient indiquer un état **"error"** ou **"canceled"**. Un prompt interrompu via `/interrupt` apparaîtra dans l'historique, mais ses sorties pourraient être incomplètes.
  - **Exemple de réponse `/history/{prompt_id}` (prompt complété) :**
    ```json
    {
      "PROMPT_ID_EXAMPLE": {
        "prompt": [
          "PROMPT_ID_EXAMPLE",
          1678886400000, // Timestamp
          "VOTRE_CLIENT_ID_UNIQUE",
          {
            /* Votre workflow au format API JSON */
          },
          {
            /* Extra data */
          },
          { "NODE_ID_OUTPUT": true /* Autres ID de nœuds de sortie */ }
        ],
        "outputs": {
          "NODE_ID_OUTPUT_IMAGE": {
            // ID du nœud SaveImage ou PreviewImage
            "images": [
              {
                "filename": "ComfyUI_00001_.png",
                "subfolder": "optional_subfolder_name", // Peut être vide
                "type": "output" // ou "temp" pour les previews
              }
              // D'autres images si le nœud en a produit plusieurs
            ]
          }
          // Autres sorties de nœuds (fichiers texte, etc.)
        },
        "status": {
          "completed": true, // Indique la complétion
          "messages": [], // Messages d'erreur ou d'avertissement éventuels
          "error": false // true si une erreur a interrompu le workflow
        }
      }
    }
    ```

- **Gestion de "canceled" / "error" :**

  - Un prompt interrompu via `/interrupt` apparaîtra éventuellement dans `/history`. Son statut pourrait indiquer qu'il n'a pas été complété normalement.
  - Si une erreur critique se produit pendant l'exécution, le message WebSocket `status` peut indiquer un changement, et l'entrée dans `/history` peut contenir des informations sur l'erreur dans son champ `status`.

- **Logique de Polling (Exemple simplifié) :**
  1.  Soumettre le prompt via `POST /prompt` et récupérer le `prompt_id`.
  2.  Commencer à interroger `GET /queue`.
      - Tant que le `prompt_id` est dans `queue_pending` ou `queue_running`, continuer à interroger à intervalles réguliers (par exemple, toutes les 1-5 secondes).
  3.  Si le `prompt_id` n'est plus dans `/queue` :
      - Interroger `GET /history/{prompt_id}`.
      - Si des `outputs` sont présents, le prompt est complété. Récupérer les résultats.
      - S'il n'y a pas d'outputs ou si une erreur est indiquée, gérer l'échec.
      - Si le `prompt_id` n'apparaît pas immédiatement dans l'historique, attendre un court instant et réessayer, car il peut y avoir un léger délai.

## 4. Visualiser une Image

- **Endpoint :** `/view`
- **Méthode :** `GET`
- **Description :** Récupère une image en fonction de son `filename`, `subfolder`, et `type`. [1, 2, 9] Ces informations sont obtenues à partir de la réponse de l'endpoint `/history/{prompt_id}`.
- **Paramètres de requête :**
  - `filename` (obligatoire) : Nom du fichier image (par exemple, `ComfyUI_00001_.png`).
  - `subfolder` (optionnel) : Sous-dossier où l'image est stockée (par exemple, `mon_projet_outputs`). Peut être une chaîne vide.
  - `type` (obligatoire) : `input`, `output`, ou `temp`. [1]
    - `output`: Images sauvegardées par des nœuds comme "SaveImage".
    - `temp`: Images de prévisualisation générées par des nœuds comme "PreviewImage".
    - `input`: Images que vous avez pu télécharger pour les utiliser comme entrées.
- **Exemple d'URL :**
  `http://127.0.0.1:8188/view?filename=ComfyUI_00001_.png&subfolder=&type=output`
- **Réponse :** Les données brutes de l'image. Le `Content-Type` de la réponse indiquera le type MIME de l'image (par exemple, `image/png`).

## 5. Télécharger une Image/Masque

- **Endpoint :** `/upload/image` ou `/upload/{image_type}` (où `{image_type}` peut être `image` ou `mask`). [2, 9] Plus couramment, `/upload/image` est utilisé.
- **Méthode :** `POST`
- **Description :** Permet de télécharger des images ou des masques vers le dossier `input` de ComfyUI (ou un sous-dossier spécifié). [1, 2] Les données de l'image sont envoyées en utilisant `multipart/form-data`. [1]
- **Champs du formulaire (`multipart/form-data`) :**
  - `image` (obligatoire) : Les données binaires du fichier image.
  - `overwrite` (optionnel, booléen) : Si `true`, écrase un fichier existant avec le même nom dans le même `subfolder`. Par défaut, un nouveau nom de fichier peut être généré si le fichier existe déjà.
  - `subfolder` (optionnel, chaîne) : Spécifie un sous-dossier dans le répertoire `input` de ComfyUI où l'image sera sauvegardée.
  - `type` (optionnel, chaîne) : Peut être utilisé pour spécifier le type de répertoire de destination (par exemple `input`, `temp`). Par défaut, c'est généralement `input`.
- **Exemple (Python avec `requests`) :**

  ```python
  import requests

  comfyui_url = "http://127.0.0.1:8188/upload/image"
  image_path = "chemin/vers/votre/image.png"
  subfolder_name = "mes_images_input" # Optionnel

  with open(image_path, 'rb') as f:
      files = {'image': (image_path.split('/')[-1], f)}
      data = {'overwrite': 'false', 'subfolder': subfolder_name} # 'true' pour écraser
      response = requests.post(comfyui_url, files=files, data=data)

  if response.status_code == 200:
      upload_data = response.json()
      print("Image téléchargée avec succès:", upload_data)
      # upload_data contiendra: {"name": "image.png", "subfolder": "mes_images_input", "type": "input"} (si réussi)
      # Ce 'name' et 'subfolder' peuvent ensuite être utilisés dans les nœuds "LoadImage" de votre workflow.
  else:
      print("Échec du téléchargement de l'image:", response.status_code, response.text)
  ```

- **Réponse :** JSON décrivant l'image téléchargée (nom, sous-dossier, type).
  ```json
  {
    "name": "nom_fichier_sur_serveur.png",
    "subfolder": "sous_dossier_specifie_ou_vide",
    "type": "input" // ou le type spécifié
  }
  ```

## 6. Gérer la File d'Attente (Queue)

- **Endpoint :** `/queue`
- **Méthode :** `GET`
- **Description :** Récupère l'état actuel de la file d'attente. [3, 9] (Voir section 3a pour les détails de la réponse).

- **Endpoint :** `/queue`
- **Méthode :** `POST`
- **Description :** Permet de manipuler la file d'attente. [9]
- **Corps de la requête pour supprimer des prompts spécifiques :**
  ```json
  {
    "delete": ["PROMPT_ID_1", "PROMPT_ID_2"]
  }
  ```
- **Corps de la requête pour vider toute la file d'attente (en attente et en cours) :**
  ```json
  {
    "clear": true
  }
  ```
- **Réponse :** Confirmation de l'action.

## 7. Interrompre l'Exécution

- **Endpoint :** `/interrupt`
- **Méthode :** `POST`
- **Description :** Interrompt l'exécution du prompt actuellement en cours. [9] Si des prompts sont en attente, le suivant démarrera.
- **Corps de la requête :** Aucun corps de requête n'est généralement requis, mais il est bon de vérifier la documentation ou les exemples de code spécifiques à votre version de ComfyUI. Parfois, un `{}` vide est envoyé.
- **Réponse :** Un objet JSON confirmant l'interruption. [3]

## 8. Gérer l'Historique

- **Endpoint :** `/history`
- **Méthode :** `POST`
- **Description :** Permet de supprimer des éléments spécifiques de l'historique ou de vider tout l'historique. [9]
- **Corps de la requête pour supprimer des entrées spécifiques de l'historique :**
  ```json
  {
    "delete": ["PROMPT_ID_1_COMPLETED", "PROMPT_ID_2_COMPLETED"]
  }
  ```
- **Corps de la requête pour vider tout l'historique :**
  ```json
  {
    "clear": true
  }
  ```
- **Réponse :** Confirmation de l'action.

## Autres Endpoints Utiles

- **`/system_stats` (GET) :** Récupère des statistiques sur le système, l'utilisation de la VRAM, les modèles chargés, etc. [4]
  - **Réponse (Exemple partiel) :**
    ```json
    {
      "system": {
        "os": "...",
        "python_version": "...",
        "embedded_python": false
      },
      "devices": [
        {
          "name": "NVIDIA GeForce RTX XXXX",
          "type": "CUDA",
          "index": 0,
          "vram_total": 8192, // en Mo
          "vram_free": 4096,
          "torch_vram_total": 7600,
          "torch_vram_free": 3800
        }
      ]
    }
    ```
- **`/object_info` (GET) :** Retourne les définitions détaillées de tous les nœuds disponibles, y compris leurs entrées, sorties, et catégories. [3] Très utile pour construire dynamiquement des workflows ou valider des types d'entrée.
  - **Réponse (Extrait simplifié pour un nœud) :**
    ```json
    {
      "KSampler": {
        "input": {
          "required": {
            "model": ["MODEL"],
            "positive": ["CONDITIONING"]
            // ... autres entrées requises
          },
          "optional": {
            "latent_image": ["LATENT"]
            // ... autres entrées optionnelles
          }
        },
        "output": ["LATENT"],
        "output_is_list": [false],
        "output_name": ["LATENT"],
        "name": "KSampler",
        "display_name": "KSampler",
        "description": "...",
        "category": "sampling",
        "output_node": false
      }
      // ... autres définitions de nœuds
    }
    ```
- **`/extensions` (GET) :** Retourne une liste des extensions JavaScript chargées par le frontend. [3] Utile pour vérifier si certaines fonctionnalités d'extensions sont disponibles.
- **`/embeddings` (GET) :** Retourne une liste des noms des embeddings (Textual Inversion) disponibles. [3]
- **`/settings` (GET, POST) :** Gère les paramètres spécifiques à l'utilisateur ou à l'instance. [3, 4, 9]
  - `GET /settings`: Récupère tous les paramètres. [4]
  - `GET /settings/{setting_id}`: Récupère un paramètre spécifique. [4]
  - `POST /settings`: Met à jour plusieurs paramètres. [4]
  - `POST /settings/{setting_id}`: Met à jour un paramètre spécifique. [4]
- **`/free` (POST) :** Permet de libérer de la mémoire VRAM en déchargeant des modèles ou en vidant le cache.
  - **Corps de la requête pour décharger tous les modèles :**
    ```json
    {
      "unload_models": true,
      "free_memory": true // Tente de libérer plus agressivement la mémoire
    }
    ```
  - **Corps de la requête pour vider uniquement le cache des modèles :**
    ```json
    {
      "unload_models": false,
      "free_memory": true
    }
    ```

Cette documentation détaillée devrait vous fournir une base solide pour interagir avec l'API ComfyUI. N'oubliez pas que ComfyUI est en développement actif, donc certains détails pourraient évoluer. Consulter les exemples de scripts dans le dépôt GitHub de ComfyUI est toujours une bonne pratique. [18, 19]
