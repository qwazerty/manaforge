#!/bin/bash

# Script de test pour créer des parties ManaForge avec 2 decks et 2 joueurs
# Usage: ./test_game_creation.sh

set -e

API_BASE="http://localhost:8000/api/v1"
# API_BASE="https://manaforge.houke.fr/api/v1"
GAME_ID="test-game-001"

echo "🎮 Test de création de parties ManaForge"
echo "========================================="
echo ""

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction pour faire une requête curl et vérifier le résultat
curl_test() {
    local description="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_field="$5"

    log_info "$description"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -X GET "$url" -H "Content-Type: application/json")
    else
        response=$(curl -s -X "$method" "$url" -H "Content-Type: application/json" -d "$data")
    fi

    if [ $? -eq 0 ]; then
        if [ -n "$expected_field" ]; then
            result=$(echo "$response" | jq -r ".$expected_field // empty")
            if [ -n "$result" ] && [ "$result" != "null" ]; then
                log_success "Succès: $result"
            else
                log_warning "Réponse: $(echo "$response" | jq -c '.')"
            fi
        else
            log_success "Requête réussie"
            echo "$response" | jq -c '.' 2>/dev/null || echo "$response"
        fi
    else
        log_error "Échec de la requête"
        return 1
    fi

    echo ""
}

echo "🔍 Test 1: Vérification que l'API est accessible"
curl_test "Ping de l'API" "GET" "$API_BASE/cards/search?q=mountain&limit=1" "" ""

echo "🎯 Test 2: Création d'une partie avec decks pré-configurés"
PRESET_GAME_RESPONSE=$(curl -s -X POST "$API_BASE/games" -H "Content-Type: application/json" -d '{}')
PRESET_GAME_ID=$(echo "$PRESET_GAME_RESPONSE" | jq -r '.id')
PRESET_PLAYERS_COUNT=$(echo "$PRESET_GAME_RESPONSE" | jq -r '.players | length')

if [ "$PRESET_PLAYERS_COUNT" = "2" ]; then
    log_success "Partie créée avec ID: $PRESET_GAME_ID - $PRESET_PLAYERS_COUNT joueurs"
else
    log_error "Échec de création de partie pré-configurée"
fi
echo ""

echo "🛠️  Test 3: Création d'une partie avec decks personnalisés"
echo "Étape 3.1: Création de la partie avec le deck du joueur 1"

DECK1_TEXT="4 Lightning Bolt\\n4 Grizzly Bears\\n4 Giant Growth\\n4 Shock\\n20 Mountain\\n20 Forest\\n20 Llanowar Elves"

curl_test "Création partie avec deck joueur 1" "POST" "$API_BASE/games?game_id=$GAME_ID" "{\"decklist_text\": \"$DECK1_TEXT\"}" "id"

echo "Étape 3.2: Joueur 2 rejoint avec son deck"

DECK2_TEXT="4 Counterspell\\n4 Serra Angel\\n4 Lightning Bolt\\n4 Wrath of God\\n16 Island\\n16 Plains\\n12 Mountain"

curl_test "Joueur 2 rejoint la partie" "POST" "$API_BASE/games/$GAME_ID/join" "{\"decklist_text\": \"$DECK2_TEXT\"}" "id"

echo "🔍 Test 4: Vérification de l'état de la partie"
curl_test "État de la partie" "GET" "$API_BASE/games/$GAME_ID/state" "" "id"

echo "🎮 Test 5: Actions de jeu de base"

echo "5.1: Piocher une carte (Joueur 1)"
curl_test "Piocher carte joueur 1" "POST" "$API_BASE/games/$GAME_ID/draw-card" "{\"player_id\": \"player1\"}" "success"

echo "5.2: Jouer une carte terre (Joueur 1)"
curl_test "Jouer Mountain joueur 1" "POST" "$API_BASE/games/$GAME_ID/play-card" "{\"player_id\": \"player1\", \"card_name\": \"Mountain\"}" "success"

echo "5.3: Passer la phase (Joueur 1)"
curl_test "Passer phase joueur 1" "POST" "$API_BASE/games/$GAME_ID/pass-phase" "{\"player_id\": \"player1\"}" "success"

echo "5.4: Piocher une carte (Joueur 2)"
curl_test "Piocher carte joueur 2" "POST" "$API_BASE/games/$GAME_ID/draw-card" "{\"player_id\": \"player2\"}" "success"

echo "5.5: Jouer une carte terre (Joueur 2)"
curl_test "Jouer Island joueur 2" "POST" "$API_BASE/games/$GAME_ID/play-card" "{\"player_id\": \"player2\", \"card_name\": \"Island\"}" "success"

echo "5.6: Modifier les points de vie"
curl_test "Dégâts au joueur 2" "POST" "$API_BASE/games/$GAME_ID/modify-life" "{\"player_id\": \"player1\", \"target_player\": \"player2\", \"amount\": -3}" "success"

echo "🔍 Test 6: État final de la partie"
FINAL_STATE=$(curl -s -X GET "$API_BASE/games/$GAME_ID/state" -H "Content-Type: application/json")
PLAYER1_LIFE=$(echo "$FINAL_STATE" | jq -r '.players[0].life')
PLAYER2_LIFE=$(echo "$FINAL_STATE" | jq -r '.players[1].life')
CURRENT_PHASE=$(echo "$FINAL_STATE" | jq -r '.phase')
TURN_NUMBER=$(echo "$FINAL_STATE" | jq -r '.turn')

log_info "État final de la partie:"
echo "  - ID: $GAME_ID"
echo "  - Vie joueur 1: $PLAYER1_LIFE"
echo "  - Vie joueur 2: $PLAYER2_LIFE"
echo "  - Phase: $CURRENT_PHASE"
echo "  - Tour: $TURN_NUMBER"
echo ""

echo "✨ Test 7: Actions avancées"

echo "7.1: Passer la priorité"
curl_test "Passer priorité" "POST" "$API_BASE/games/$GAME_ID/pass-priority" "{\"player_id\": \"player1\"}" "success"

echo "7.2: Résoudre la pile (si applicable)"
curl_test "Résoudre pile" "POST" "$API_BASE/games/$GAME_ID/resolve-stack" "{\"player_id\": \"player1\"}" "success"

echo ""
echo "🎉 Tests terminés!"
echo "========================================="
echo ""
echo "📋 Résumé des commandes testées:"
echo ""
echo "1. Création partie pré-configurée:"
echo "   curl -X POST '$API_BASE/games' -H 'Content-Type: application/json' -d '{}'"
echo ""
echo "2. Création partie personnalisée:"
echo "   curl -X POST '$API_BASE/games?game_id=GAME_ID' \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"decklist_text\": \"DECK_TEXT\"}'"
echo ""
echo "3. Rejoindre partie:"
echo "   curl -X POST '$API_BASE/games/GAME_ID/join' \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"decklist_text\": \"DECK_TEXT\"}'"
echo ""
echo "4. Actions de jeu:"
echo "   - Piocher: curl -X POST '$API_BASE/games/GAME_ID/draw-card' -d '{\"player_id\": \"player1\"}'"
echo "   - Jouer: curl -X POST '$API_BASE/games/GAME_ID/play-card' -d '{\"player_id\": \"player1\", \"card_name\": \"CARD\"}'"
echo "   - Passer phase: curl -X POST '$API_BASE/games/GAME_ID/pass-phase' -d '{\"player_id\": \"player1\"}'"
echo "   - Modifier vie: curl -X POST '$API_BASE/games/GAME_ID/modify-life' -d '{\"player_id\": \"player1\", \"target_player\": \"player2\", \"amount\": -3}'"
echo ""
echo "🔗 Partie de test créée: $GAME_ID"
echo "🌐 Interface web: http://localhost:8000/game-interface/$GAME_ID"
