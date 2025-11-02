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

DECK1_TEXT="4 Aether Hub (KLR) 279\\n4 Ajani, Nacatl Pariah / Ajani, Nacatl Avenger (MH3) 237\\n2 Boggart Trawler / Boggart Bog (MH3) 243\\n4 Chthonian Nightmare (MH3) 83\\n4 Concealed Courtyard (OTJ) 268\\n1 Delney, Streetwise Lookout (MKM) 12\\n1 Eiganjo, Seat of the Empire (NEO) 268\\n1 Elesh Norn, Mother of Machines (ONE) 10\\n3 Godless Shrine (RNA) 248\\n4 Guide of Souls (MH3) 29\\n2 Lotleth Giant (GRN) 74\\n4 Ocelot Pride (MH3) 38\\n1 Phyrexian Tower (MH3) 303\\n1 Plains (ONE) 267\\n4 Ravenous Chupacabra (RIX) 82\\n2 Rite of Oblivion (MID) 237\\n1 Sevinne's Reclamation (MH3) 267\\n2 Shadowy Backstreet (MKM) 268\\n4 Stitcher's Supplier (M19) 121\\n3 Summon: Primal Odin (FIN) 121\\n1 Swamp (ONE) 269\\n1 Takenuma, Abandoned Mire (NEO) 278\\n1 White Orchid Phantom (MH3) 47\\n3 Witch Enchanter / Witch-Blessed Meadow (MH3) 239\\n2 Wurmcoil Larva (MH3) 112"

curl_test "Création partie avec deck joueur 1" "POST" "$API_BASE/games?game_id=$GAME_ID" "{\"decklist_text\": \"$DECK1_TEXT\"}" "id"

echo "Étape 3.2: Joueur 2 rejoint avec son deck"

DECK2_TEXT="1 Echoing Deeps\\n3 Gruul Turf\\n1 Otawara, Soaring City\\n4 Arboreal Grazer\\n3 Forest\\n2 Scapeshift\\n1 Tolaria West\\n1 Urza's Cave\\n4 Amulet of Vigor\\n3 Simic Growth Chamber\\n1 Icetill Explorer\\n3 Green Sun's Zenith\\n2 Lotus Field\\n4 Crumbling Vestige\\n1 Shifting Woodland\\n4 Malevolent Rumble\\n1 Aftermath Analyst\\n4 Primeval Titan\\n4 Spelunking\\n1 Vexing Bauble\\n1 Hanweir Battlements\\n1 Mirrorpool\\n2 Summoner's Pact\\n4 Urza's Saga\\n3 Boseiju, Who Endures\\n1 Vesuva"

curl_test "Joueur 2 rejoint la partie" "POST" "$API_BASE/games/$GAME_ID/join" "{\"decklist_text\": \"$DECK2_TEXT\"}" "id"

echo "🔍 Test 4: Vérification de l'état de la partie"
curl_test "État de la partie" "GET" "$API_BASE/games/$GAME_ID/state" "" "id"

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
