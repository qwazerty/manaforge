# UI Horizontal Scroll Module

## Description

Ce module ajoute la fonctionnalité de scroll horizontal avec la molette de souris pour toutes les zones de jeu qui ont un défilement horizontal (main, battlefield, zones de permanents, etc.).

## Fonctionnalités

### ✅ Scroll avec molette souris
- **Zones supportées** : `.permanents-zone-content`, `.lands-zone-content`, `.hand-zone-content`, `.zone-content`, `.overflow-x-auto`
- **Direction** : La molette verticale scroll horizontalement
- **Vitesse** : Adaptative selon le type de molette (pixel, ligne, page)
- **Feedback visuel** : Highlight temporaire lors du scroll

### ✅ Détection automatique
- **MutationObserver** : Détecte les zones ajoutées dynamiquement
- **Éviter doublons** : Système de marquage pour éviter les listeners multiples
- **Performance** : Uniquement sur les zones avec overflow horizontal réel

### ✅ Améliorations visuelles
- **Scrollbars stylées** : Couleurs thématiques de ManaForge
- **Curseurs adaptatifs** : `grab` et `grabbing` pour indication visuelle
- **Indicateurs de scroll** : Gradient à droite pour zones scrollables
- **Accessibilité** : Support high contrast et reduced motion

## Utilisation

### Initialisation automatique
```javascript
// Le module s'initialise automatiquement au chargement
UIHorizontalScroll.init();
```

### Actualisation manuelle
```javascript
// Après des modifications majeures du DOM
UIHorizontalScroll.refresh();
```

### Ajouter à une zone spécifique
```javascript
// Pour attacher manuellement à un élément
const element = document.querySelector('.ma-zone-custom');
UIHorizontalScroll.attachWheelListener(element);
```

## CSS Associé

Le fichier `ui-horizontal-scroll.css` fournit :
- Styles de feedback visuel (`.scrolling-active`)
- Scrollbars personnalisées
- Indicateurs de zones scrollables
- Support mobile et accessibilité

## Intégration dans ManaForge

### Templates
- **game.html** : Script chargé avant ui-zones.js
- **base_arena.html** : CSS inclus dans tous les templates

### Zones compatibles
- **Main du joueur** : `.hand-zone-content`
- **Battlefield** : `.permanents-zone-content`, `.lands-zone-content`
- **Zones d'adversaire** : `.opponent-hand .overflow-x-auto`
- **Zones modales** : Toutes les zones avec `.overflow-x-auto`

## Configuration

### Vitesse de scroll
```javascript
// Dans calculateScrollAmount() - ligne 83
const baseScrollAmount = 100; // Pixels par cran de molette
```

### Durée du feedback
```javascript
// Dans addScrollFeedback() - ligne 108
setTimeout(() => {
    element.classList.remove('scrolling-active');
}, 150); // 150ms de highlight
```

### Sélecteurs de zones
```javascript
// Dans attachScrollListeners() - ligne 20
const horizontalZoneSelectors = [
    '.permanents-zone-content',
    '.lands-zone-content', 
    '.hand-zone-content',
    '.zone-content',
    // Ajouter d'autres sélecteurs ici
];
```

## Compatibilité

- ✅ **Chrome/Edge** : Support complet avec scrollbars WebKit
- ✅ **Firefox** : Support avec scrollbar-width
- ✅ **Safari** : Support complet
- ✅ **Mobile** : Scroll tactile amélioré avec `-webkit-overflow-scrolling`
- ✅ **Accessibilité** : Support reduced-motion et high-contrast

## Tests

Pour tester la fonctionnalité :

1. **Créer une partie** avec le script de test :
   ```bash
   ./test_game_creation.sh
   ```

2. **Accéder à l'interface** : http://localhost:8000/game-interface/test-game-001

3. **Tester le scroll** :
   - Jouer plusieurs cartes pour remplir les zones
   - Utiliser la molette sur les zones horizontales
   - Vérifier le feedback visuel

## Troubleshooting

### Le scroll ne fonctionne pas
- Vérifier que la zone a réellement un overflow horizontal
- Contrôler la console pour les erreurs JavaScript
- S'assurer que le script est chargé avant ui-zones.js

### Performance lente
- Réduire la valeur de `baseScrollAmount`
- Vérifier qu'il n'y a pas de listeners multiples
- Utiliser `UIHorizontalScroll.refresh()` après modifications DOM

### Scroll trop rapide/lent
- Ajuster `baseScrollAmount` dans `calculateScrollAmount()`
- Modifier le multiplicateur `* 0.8` pour les pixels
- Tester avec différents types de molettes

## Maintenance

- **Ajouter nouvelles zones** : Mettre à jour `horizontalZoneSelectors`
- **Changer le style** : Modifier `ui-horizontal-scroll.css`
- **Debug** : Activer les logs dans `attachWheelListener()`
