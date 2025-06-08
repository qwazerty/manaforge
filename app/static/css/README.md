# CSS Architecture Documentation

## Structure des fichiers CSS

Le système CSS de ManaForge a été refactorisé pour améliorer la maintenabilité et la lisibilité. Voici l'organisation des fichiers :

### Fichier principal

- **`game-main.css`** - Fichier principal qui importe tous les autres modules

### Modules de base

- **`game-layout.css`** - Styles globaux et layout principal du jeu
- **`game-animations.css`** - Toutes les animations et keyframes
- **`game-cards.css`** - Styles pour les cartes (mini, battlefield, tapped, back, etc.)  
- **`game-players.css`** - Styles pour les joueurs et sélecteurs
- **`game-battlefield.css`** - Styles pour les zones de jeu et battlefield
- **`game-stack.css`** - Styles pour la pile (stack) et sorts
- **`game-modals.css`** - Styles pour les modals et menus contextuels
- **`game-zones.css`** - Styles généraux pour les zones

### Modules spécialisés

- **`game-zones-compact.css`** - Styles pour les zones de cartes en mode compact (deck, graveyard, exile)
- **`game-zone-modals.css`** - Styles pour les modales d'affichage des zones et grilles de cartes
- **`game-responsive.css`** - Optimisations responsive et pour écrans 1080p

### Fichiers spécifiques

- **`arena.css`** - Styles pour l'interface d'arène
- **`opponent-zones.css`** - Styles pour les zones de l'adversaire
- **`game-card-actions.css`** - Styles pour les actions sur les cartes

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
