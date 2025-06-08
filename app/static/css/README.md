# CSS Architecture Documentation

## Structure des fichiers CSS

Le système CSS de ManaForge a été refactorisé pour améliorer la maintenabilité et la lisibilité. Voici l'organisation des fichiers :

### Fichiers principaux

- **`game-main.css`** - Fichier principal qui importe tous les autres et contient les styles globaux
- **`game.css`** - Ancien fichier monolithique (à supprimer après migration)

### Fichiers modulaires

- **`animations.css`** - Toutes les animations et keyframes
- **`cards.css`** - Styles pour les cartes (mini, battlefield, tapped, back, etc.)  
- **`players.css`** - Styles pour les joueurs et sélecteurs
- **`battlefield.css`** - Styles pour les zones de jeu et battlefield
- **`stack.css`** - Styles pour la pile (stack) et sorts
- **`modals.css`** - Styles pour les modals et menus contextuels

## Utilisation

Pour utiliser la nouvelle architecture, remplacez dans vos templates HTML :

```html
<!-- Ancien -->
<link rel="stylesheet" href="/static/css/game.css">

<!-- Nouveau -->
<link rel="stylesheet" href="/static/css/game-main.css">
```

## Avantages de cette organisation

1. **Séparation des responsabilités** - Chaque fichier a une responsabilité claire
2. **Maintenabilité** - Plus facile de trouver et modifier des styles spécifiques
3. **Réutilisabilité** - Les modules peuvent être importés individuellement si nécessaire
4. **Performance** - Les navigateurs peuvent mettre en cache les fichiers séparément
5. **Collaboration** - Plusieurs développeurs peuvent travailler sur différents aspects sans conflit

## Migration

1. Mettre à jour les templates pour utiliser `game-main.css`
2. Tester que tous les styles fonctionnent correctement
3. Supprimer l'ancien fichier `game.css`

## Convention de nommage

- Classes BEM (Block Element Modifier) quand approprié
- Préfixes pour les composants (`card-`, `stack-`, `player-`, etc.)
- Variables CSS pour les couleurs et espacements récurrents
