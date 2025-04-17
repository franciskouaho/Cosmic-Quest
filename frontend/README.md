# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Cosmic Quest: Déroulement du jeu

Le jeu Cosmic Quest se déroule en plusieurs phases:

1. **Phase QUESTION**: Les joueurs voient la question, et la personne concernée (targetPlayer) est informée.
2. **Phase ANSWER**: Tous les joueurs sauf la cible soumettent leurs réponses.
3. **Phase VOTE**: La cible vote pour sa réponse préférée (tous les autres en attente).
4. **Phase RESULTS**: Affichage des résultats et des scores.

Si un joueur reste bloqué en attente alors que tous les joueurs ont répondu, cela peut indiquer:

- Un problème de synchronisation entre le client et le serveur
- Des conditions de transition de phase non remplies
- Un problème de socket pour les mises à jour en temps réel

### Dépannage

Si tous les joueurs sont bloqués en "attente":

- Vérifiez si tous les joueurs éligibles ont bien répondu
- Essayez d'actualiser manuellement l'état du jeu
- Pour les développeurs: vérifiez les logs côté serveur pour identifier les blocages potentiels

### Récupération automatique

Le système dispose maintenant d'un mécanisme de récupération automatique qui:

- Détecte les erreurs 500 persistantes
- Tente de récupérer l'état via WebSocket
- Fournit un état minimal en dernier recours pour éviter les crashs d'application

Le système intègre une approche HTTP directe pour le passage au tour suivant.

#### Passage au tour suivant (REST API)

Le passage au tour suivant s'effectue uniquement via l'API REST avec l'endpoint:

- `POST /api/v1/games/:id/next-round`

Paramètres:

```json
{
  "user_id": "string",
  "force_advance": boolean
}
```

En cas d'erreur, le système tente automatiquement une seconde requête avec des paramètres adaptés.

#### Avantages de l'approche REST pour next-round

- Fiabilité accrue: pas de dépendance aux connexions WebSocket
- Meilleure résilience aux problèmes de connexion instable
- Réponses synchrones avec codes d'erreur explicites
- Possibilité de vérifier le statut de la requête

#### Diagnostic de problèmes

En cas d'échec persistant du passage au tour suivant:

1. Vérifier les logs serveur pour les erreurs côté backend
2. S'assurer que l'utilisateur est bien l'hôte de la partie
3. Vérifier que la partie est dans une phase où le passage au tour suivant est autorisé

En cas d'erreur persistante, utilisez la fonction `GameStateRecovery.recoverFromPersistentError(gameId)`
dans vos outils de développement.

## Communication Socket.IO dans Cosmic Quest

Cosmic Quest utilise Socket.IO pour les communications en temps réel. Voici les événements clés:

### Événements du client vers le serveur

- `join-game`: Rejoindre un canal de jeu
- `game:get_state`: Récupérer l'état complet d'un jeu
- `game:submit_answer`: Soumettre une réponse à une question
- `game:submit_vote`: Voter pour une réponse
- `game:next_round`: Passer au tour suivant (hôte uniquement)
- `game:check_host`: Vérifier si l'utilisateur est l'hôte du jeu

### Événements du serveur vers le client

- `game:update`: Mises à jour sur l'état du jeu (nouvelles réponses, votes, changements de phase)
- `next_round:confirmation`: Confirmation du passage au tour suivant
- `next_round:error`: Erreur lors du passage au tour suivant

### Problèmes courants et solutions

#### Le bouton "Tour suivant" ne fonctionne pas

Si le bouton "Tour suivant" ne fonctionne pas correctement:

1. **Vérifiez les logs**: Regardez si l'événement `game:next_round` est envoyé et quelle réponse est reçue
2. **Vérifiez le statut d'hôte**: Seul l'hôte peut passer au tour suivant
3. **Essayez de rafraîchir l'application**: Parfois, les informations d'hôte peuvent être mal synchronisées
4. **Utilisez la récupération manuelle**: En dernier recours, utilisez:
   ```js
   // Dans la console de développement
   GameStateRecovery.forceGameProgress("ID_DU_JEU");
   ```

#### Passage au tour suivant (next_round) échoue

Le système implémente une stratégie de fiabilité à plusieurs niveaux:

1. Première tentative via WebSocket avec un timeout de 8 secondes
2. En cas d'échec, tentative automatique via API REST HTTP
3. Si toutes les tentatives échouent, l'interface affiche un message d'erreur explicite

La méthode HTTP est disponible à l'endpoint `/api/v1/games/:id/next-round` et accepte:

- `user_id`: ID de l'utilisateur qui demande l'action
- `force_advance`: boolean pour forcer le passage au tour suivant

#### Les joueurs sont bloqués dans une phase

Si tous les joueurs sont bloqués dans une phase:

1. **Rafraîchissez l'état du jeu**: Tire vers le bas pour rafraîchir
2. **Vérifiez que toutes les actions requises sont effectuées**: En phase answer, tous les joueurs (sauf la cible) doivent répondre
3. **L'hôte peut forcer la progression**: Si le bouton "Tour suivant" est visible, l'utiliser
4. **Reconnectez-vous au jeu**: En dernier recours, rafraîchissez l'application complètement

La plupart des problèmes de blocage sont maintenant automatiquement détectés et résolus par l'application.

#### Désynchronisation entre clients

Si certains joueurs voient des phases différentes:

- L'application tente automatiquement une récupération
- Utiliser le endpoint `/api/v1/games/:id/force-check-phase` pour resynchroniser l'état du jeu
- Le bouton de rafraîchissement manuel est disponible en cas de besoin extrême

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
