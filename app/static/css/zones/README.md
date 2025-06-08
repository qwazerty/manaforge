# Zones CSS Architecture

Ce dossier contient les styles CSS modulaires pour les zones de jeu de ManaForge, organisés de manière logique et maintenable.

## Structure des fichiers

### Fichier principal
- **`game-zones.css`** - Fichier d'import principal qui charge tous les modules de zones

### Modules de zones

#### 📁 `/zones/`

1. **`zones-base.css`** - Styles de base et fondamentaux
   - Conteneurs de preview des zones
   - Styles des cartes miniatures
   - États vides (fallback)

2. **`zones-deck.css`** - Styles spécifiques au deck
   - Stack de cartes du deck
   - Dos de carte
   - Overlays pour la pioche
   - Hints de tirage

3. **`zones-graveyard-exile.css`** - Cimetière et exil
   - Styles des cartes dans le cimetière
   - Disposition en éventail
   - Gestion des positions des cartes

4. **`zones-animations.css`** - Animations et effets
   - Animation de pioche (`cardDraw`)
   - Effets de survol (hover)
   - Transitions fluides
   - Effets de luminosité

5. **`zones-mini.css`** - Versions miniaturisées
   - Optimisé pour écrans 1080px
   - Tailles réduites (90px × 130px)
   - Versions mini des overlays

6. **`zones-compact.css`** - Versions ultra-compactes
   - Pour petits écrans et layouts serrés
   - Tailles minimales (60px × 85px)
   - Layout en grille optimisé

7. **`zones-life.css`** - Gestion des points de vie
   - Affichage du total de vie
   - Contrôles +/- de vie
   - Styles des boutons compacts

## Avantages de cette architecture

### 🔧 Maintenabilité
- Chaque aspect des zones est dans son propre fichier
- Modifications isolées sans impact sur les autres styles
- Code plus lisible et organisé

### ⚡ Performance
- Possibilité de charger seulement les styles nécessaires
- Meilleure compression gzip avec la modularité
- Cache plus efficace par module

### 🎯 Flexibilité
- Facilite l'ajout de nouvelles variantes de zones
- Permet la customisation par module
- Adaptation simple pour différents formats de jeu

### 👥 Collaboration
- Plusieurs développeurs peuvent travailler sur différents modules
- Conflits Git réduits
- Responsabilités claires par fichier

## Usage

Pour utiliser ces styles, il suffit d'importer le fichier principal :

```html
<link rel="stylesheet" href="/static/css/game-zones.css">
```

Le fichier principal charge automatiquement tous les modules nécessaires via `@import`.

## Conventions de nommage

- **Base** : Styles fondamentaux et communs
- **Spécifique** : Styles pour une zone particulière (deck, graveyard, etc.)
- **Variante** : Modificateurs de taille (-mini, -compact)
- **Fonctionnel** : Styles pour une fonctionnalité spécifique (animations, life)

## Évolution future

Cette architecture permet facilement d'ajouter :
- Nouveaux types de zones (commandant, sideboard, etc.)
- Nouvelles variantes de taille
- Nouveaux effets visuels
- Styles adaptatifs responsives
