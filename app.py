import os
import requests
import feedparser
from flask import Flask, jsonify, render_template, request
from datetime import datetime
import re
import hashlib
from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.exceptions import CosmosResourceNotFoundError

app = Flask(__name__)

def sanitize_id(item_id):
    if not item_id:
        return ""
    return hashlib.sha256(item_id.encode('utf-8')).hexdigest()

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# Cosmos DB configuration
cosmos_client = None
cosmos_container = None

def get_cosmos_container():
    global cosmos_client, cosmos_container
    if cosmos_container is not None:
        return cosmos_container

    endpoint = os.environ.get("COSMOS_ENDPOINT")
    key = os.environ.get("COSMOS_KEY")
    if not endpoint or not key:
        raise Exception("Cosmos DB environment variables COSMOS_ENDPOINT and COSMOS_KEY must be configured.")

    database_name = os.environ.get("COSMOS_DATABASE", "bqpulse")
    container_name = os.environ.get("COSMOS_CONTAINER", "starred")

    cosmos_client = CosmosClient(endpoint, key)
    database = cosmos_client.create_database_if_not_exists(id=database_name)
    cosmos_container = database.create_container_if_not_exists(
        id=container_name,
        partition_key=PartitionKey(path="/id")
    )
    return cosmos_container

# Pre-initialize Cosmos DB container at startup without crashing the app if offline
try:
    get_cosmos_container()
except Exception as e:
    print(f"Cosmos DB connection failed at startup: {e}. Will retry dynamically on requests.")

def clean_html(raw_html):
    if not raw_html:
        return ""
    # Remove HTML tags
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, '', raw_html)
    # Replace multiple spaces/newlines
    cleantext = re.sub(r'\s+', ' ', cleantext)
    return cleantext.strip()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Parse feed
        feed = feedparser.parse(response.content)
        
        releases = []
        for entry in feed.entries:
            # Extract content
            content = ""
            if 'content' in entry and entry.content:
                content = entry.content[0].value
            elif 'summary' in entry:
                content = entry.summary
            
            title = entry.get('title', '')
            
            # Simple keyword matching for category/type of update
            category = "General"
            content_lower = content.lower() + " " + title.lower()
            if "deprecat" in content_lower or "obsolet" in content_lower or "remov" in content_lower or "discontinu" in content_lower:
                category = "Deprecation"
            elif "fix" in content_lower or "bug" in content_lower or "resolv" in content_lower or "error" in content_lower:
                category = "Fix"
            elif "new feature" in content_lower or "introduc" in content_lower or "support" in content_lower or "announc" in content_lower or "beta" in content_lower or "ga" in content_lower or "preview" in content_lower or "add" in content_lower:
                category = "Feature"
            
            # Formatting update date
            updated_raw = entry.get('updated', entry.get('published', ''))
            formatted_date = updated_raw
            if updated_raw:
                try:
                    # e.g., "2026-06-29T00:00:00Z"
                    # Remove Z and parse
                    clean_date_str = updated_raw.replace('Z', '+00:00')
                    # Feedparser might parse it for us in entry.updated_parsed
                    if 'updated_parsed' in entry and entry.updated_parsed:
                        dt = datetime(*entry.updated_parsed[:6])
                        formatted_date = dt.strftime("%B %d, %Y")
                    else:
                        dt = datetime.fromisoformat(clean_date_str)
                        formatted_date = dt.strftime("%B %d, %Y")
                except Exception:
                    pass

            releases.append({
                "id": entry.get('id', entry.get('link', '')),
                "title": title,
                "link": entry.get('link', ''),
                "updated_raw": updated_raw,
                "date": formatted_date,
                "content": content,
                "text_snippet": clean_html(content)[:200] + ("..." if len(clean_html(content)) > 200 else ""),
                "category": category
            })
            
        return jsonify({
            "status": "success",
            "feed_title": feed.feed.get('title', 'BigQuery Release Notes'),
            "releases": releases
        })
    except Exception as e:
        print(f"Error fetching releases: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/star", methods=["POST"])
def star_item():
    try:
        data = request.get_json() or {}
        item_id = data.get("id")
        if not item_id:
            return jsonify({"status": "error", "message": "Missing 'id' in request body."}), 400
        
        # Sanitize the id using sha256
        sanitized_id = sanitize_id(item_id)
        
        # Build item to upsert with required fields and add starred_at
        item = {
            "id": sanitized_id,
            "original_id": item_id,
            "title": data.get("title", ""),
            "link": data.get("link", ""),
            "category": data.get("category", "General"),
            "published": data.get("published", ""),
            "starred_at": datetime.utcnow().isoformat() + "Z"
        }
        
        # Preserve other fields from data (like 'content', 'date', etc.) if present
        for key, val in data.items():
            if key not in item:
                item[key] = val
        
        # Fallback date if not provided
        if not item.get("date") and item.get("published"):
            item["date"] = item["published"]

        # Print item["id"] right before upserting to Cosmos DB
        print(f"Upserting item with ID to Cosmos DB: {item['id']}")

        container = get_cosmos_container()
        container.upsert_item(item)
        return jsonify({"status": "success", "item": item}), 200
    except Exception as e:
        print(f"Error in POST /api/star: {e}")
        return jsonify({"status": "error", "message": f"Cosmos DB Error: {str(e)}"}), 500

@app.route("/api/star/<path:id>", methods=["DELETE"])
def delete_star(id):
    try:
        container = get_cosmos_container()
        sanitized_id = sanitize_id(id)
        try:
            # First try deleting with the sanitized (hashed) id
            container.delete_item(item=sanitized_id, partition_key=sanitized_id)
        except CosmosResourceNotFoundError:
            # Defensive fallback: try deleting with the original raw id (for legacy items)
            try:
                container.delete_item(item=id, partition_key=id)
            except CosmosResourceNotFoundError:
                return jsonify({"status": "error", "message": f"Item with id '{id}' not found."}), 404
        return jsonify({"status": "success", "message": f"Item with id '{id}' unstarred successfully."}), 200
    except Exception as e:
        print(f"Error in DELETE /api/star/{id}: {e}")
        return jsonify({"status": "error", "message": f"Cosmos DB Error: {str(e)}"}), 500

@app.route("/api/starred", methods=["GET"])
def get_starred_items():
    try:
        container = get_cosmos_container()
        query = "SELECT * FROM c ORDER BY c.starred_at DESC"
        raw_items = list(container.query_items(query=query, enable_cross_partition_query=True))
        
        # Defensive mapping: replace hashed 'id' with the raw 'original_id' so frontend can match
        items = []
        for item in raw_items:
            item["id"] = item.get("original_id", item["id"])
            items.append(item)
            
        return jsonify({
            "status": "success",
            "releases": items
        }), 200
    except Exception as e:
        print(f"Error in GET /api/starred: {e}")
        return jsonify({"status": "error", "message": f"Cosmos DB Error: {str(e)}"}), 500

if __name__ == "__main__":
    # Allow port reuse, disable automatic debug reloader and run on port 5000
    app.run(debug=True, use_reloader=False, host="0.0.0.0", port=5000)
