from quart import Blueprint, request, jsonify
import httpx
import logging

logger = logging.getLogger(__name__)

card_routes = Blueprint('card_routes', __name__)

def format_scryfall_card(card_data):
    """Format Scryfall card data to our internal format"""
    try:
        # Handle double-faced cards
        if card_data.get('layout') in ['transform', 'modal_dfc', 'double_faced_token']:
            # Use the front face for the main data
            front_face = card_data.get('card_faces', [{}])[0]
            name = front_face.get('name', card_data.get('name', 'Unknown'))
            mana_cost = front_face.get('mana_cost', '')
            power = front_face.get('power')
            toughness = front_face.get('toughness')
            type_line = front_face.get('type_line', card_data.get('type_line', ''))
            oracle_text = front_face.get('oracle_text', card_data.get('oracle_text', ''))
        else:
            name = card_data.get('name', 'Unknown')
            mana_cost = card_data.get('mana_cost', '')
            power = card_data.get('power')
            toughness = card_data.get('toughness')
            type_line = card_data.get('type_line', '')
            oracle_text = card_data.get('oracle_text', '')

        # Get image URL
        image_uris = card_data.get('image_uris', {})
        if not image_uris and 'card_faces' in card_data:
            # For double-faced cards, get the front face image
            front_face = card_data['card_faces'][0]
            image_uris = front_face.get('image_uris', {})
        
        image_url = (
            image_uris.get('normal') or
            image_uris.get('large') or
            image_uris.get('small') or
            image_uris.get('png')
        )

        # Parse type line to get main type and subtypes
        type_parts = type_line.split('—') if '—' in type_line else [type_line, '']
        main_type = type_parts[0].strip().lower()
        subtypes = type_parts[1].strip() if len(type_parts) > 1 else ''

        # Convert power/toughness to integers when possible
        try:
            power = int(power) if power and power.isdigit() else power
        except (ValueError, TypeError):
            pass
        
        try:
            toughness = int(toughness) if toughness and toughness.isdigit() else toughness
        except (ValueError, TypeError):
            pass

        formatted_card = {
            'id': card_data.get('id', name.lower().replace(' ', '_').replace(',', '')),
            'name': name,
            'mana_cost': mana_cost,
            'cmc': card_data.get('cmc', 0),
            'card_type': main_type,
            'subtype': subtypes,
            'text': oracle_text,
            'power': power,
            'toughness': toughness,
            'colors': card_data.get('colors', []),
            'rarity': card_data.get('rarity', 'common'),
            'image_url': image_url
        }

        return formatted_card

    except Exception as e:
        logger.error(f"Error formatting card {card_data.get('name', 'unknown')}: {e}")
        return {
            'id': card_data.get('id', 'unknown'),
            'name': card_data.get('name', 'Unknown'),
            'mana_cost': '',
            'cmc': 0,
            'card_type': 'unknown',
            'subtype': '',
            'text': '',
            'power': None,
            'toughness': None,
            'colors': [],
            'rarity': 'common',
            'image_url': None
        }

@card_routes.route('/search', methods=['GET'])
async def search_cards():
    """Search for cards via Scryfall API with optional token filtering"""
    try:
        query = request.args.get('q', '')
        limit = min(int(request.args.get('limit', 10)), 50)
        tokens_only = request.args.get('tokens_only', 'false').lower() == 'true'
        
        if not query or len(query) < 2:
            return jsonify([])
        
        # Build Scryfall query
        scryfall_query = query
        if tokens_only:
            # Add Scryfall syntax to search only for tokens
            scryfall_query = f"t:token {query}"
        
        # Search via Scryfall API
        scryfall_url = f"https://api.scryfall.com/cards/search"
        params = {
            'q': scryfall_query,
            'format': 'json',
            'order': 'name',
            'page': 1
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(scryfall_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            cards = data.get('data', [])[:limit]
            
            # Convert to our format
            formatted_cards = []
            for card in cards:
                formatted_card = format_scryfall_card(card)
                formatted_cards.append(formatted_card)
            
            return jsonify(formatted_cards)
            
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            # No results found
            return jsonify([])
        logger.error(f"HTTP error searching cards: {e}")
        return jsonify({'error': 'Search failed'}), 500
    except Exception as e:
        logger.error(f"Error searching cards: {e}")
        return jsonify({'error': 'Search failed'}), 500
