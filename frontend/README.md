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

En cas d'erreur persistante, utilisez la fonction `GameStateRecovery.recoverFromPersistentError(gameId)`
dans vos outils de développement.

## Communication Socket.IO dans Cosmic Quest

Le jeu utilise Socket.IO pour les communications en temps réel. Voici les événements clés:

### Événements envoyés au serveur:

- `game:submit_answer` - Soumettre une réponse à une question
- `game:submit_vote` - Voter pour une réponse
- `game:force_check` - Forcer une vérification de l'état du jeu
- `game:next_round` - Passer au tour suivant
- `join-game` - Rejoindre un canal de jeu
- `join-room` - Rejoindre un canal de salle

### Événements reçus du serveur:

- `game:update` - Mises à jour sur l'état du jeu (changement de phase, nouvelles réponses, etc.)
- `room:update` - Mises à jour sur l'état de la salle (joueurs qui rejoignent/quittent, etc.)

### Dépannage Socket.IO

Si les communications temps réel ne fonctionnent pas:

1. Vérifier la connexion internet
2. Essayer de rafraîchir manuellement l'état du jeu
3. Vérifier dans les logs si les événements sont correctement envoyés/reçus
4. Utiliser l'utilitaire `socketTester.diagnosticSocket()` pour vérifier l'état de la connexion

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
