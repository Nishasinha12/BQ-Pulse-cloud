# BQ Pulse: BigQuery Release Notes Explorer & Tweeter
`BQ Pulse` is a lightweight, responsive, and aesthetically premium Flask-based web application. It fetches, categorizes, and displays Google Cloud BigQuery's official release notes RSS feed, providing a modern dashboard for search/filtering, and an integrated social composer to draft and share updates to Twitter/X.

---

## 📂 Project Architecture & Directory Structure

The project follows a standard Flask layout, splitting responsibilities between Python (backend API and data ingestion) and Javascript/CSS (frontend interactivity, state management, and aesthetics).

```
agy-cli-projects/
├── app.py                  # Main Flask backend application (server, feed fetching, categorization)
├── requirements.txt        # Python libraries required for the project
├── templates/
│   └── index.html          # Main HTML structure of the application
└── static/
    ├── css/
    │   └── style.css       # Premium custom stylesheet (variables, glassmorphism, dark/light theme)
    └── js/
        └── app.js          # Client-side interactivity, state management, and Tweet composer
```

### File Details
1. **[app.py](file:///d:/5-days%20ai/agy-cli-projects/app.py)**: Spins up the Flask web server, hosts the root route, and exposes a JSON endpoint `/api/releases`. This endpoint pulls from Google's XML feed, cleans the HTML tags from the release description, categorizes the release type, formats dates, and sends clean structured data to the client.
2. **[requirements.txt](file:///d:/5-days%20ai/agy-cli-projects/requirements.txt)**: Specifies package dependencies: `Flask` for routing, `requests` for fetching external assets, and `feedparser` for reading BigQuery's RSS/Atom XML feed.
3. **[index.html](file:///d:/5-days%20ai/agy-cli-projects/templates/index.html)**: Provides a single-page app layout with semantic HTML5 elements. Features a navigation sidebar, a statistics dashboard, an explorer panel (notes + search + category filters), and a mock Twitter post preview container.
4. **[style.css](file:///d:/5-days%20ai/agy-cli-projects/static/css/style.css)**: Implements CSS custom properties for premium dark (default) and light themes. Uses Outfit & Inter typography, glassmorphism filters, glowing gradients, hover scaling micro-animations, and full responsiveness.
5. **[app.js](file:///d:/5-days%20ai/agy-cli-projects/static/js/app.js)**: Orchestrates DOM selection, asynchronous feed polling, search query filtering, card highlights, and local storage state persistence. Handles the Tweet preview calculations (progress rings, character constraints) and intent forwarding.

---

## ⚡ Core Features & Implementation Details

### 1. Backend RSS Feed Fetching & Categorization
In **[app.py](file:///d:/5-days%20ai/agy-cli-projects/app.py)**, the app fetches Google Cloud's BigQuery releases. For each entry, it parses dates and applies regular expressions to tag entries based on keywords:
- **`Feature`**: Triggered by keywords such as *new feature, introduce, support, announce, ga, preview, beta, add*.
- **`Fix`**: Triggered by keywords such as *fix, bug, resolve, error*.
- **`Deprecation`**: Triggered by keywords such as *deprecat, obsolet, remove, discontinu*.
- **`General`**: Fallback category for other updates.

HTML formatting in the RSS entry content is dynamically sanitized using helper functions (`clean_html` in backend, `cleanHTML` in frontend) to remove markup while preserving line breaks.

### 2. Premium Design System
The visual style is defined in **[style.css](file:///d:/5-days%20ai/agy-cli-projects/static/css/style.css)**:
- **Glassmorphism**: Cards use translucent background fills (`--glass-bg`) paired with backdrop filters (`--glass-blur`).
- **Dynamic Counters**: The dashboard statistics section animate values from `0` to the total counted values sequentially on page load or feed refresh.
- **Theme Toggle**: The user can toggle between **Dark Mode** and **Light Mode**. Preferences are saved automatically to `localStorage` and applied on page load.
- **Responsive Layout**: Adjusts from a dual-column master-detail grid on desktops to a stacked workspace layout on smaller viewport widths (tablet/mobile).

### 3. Integrated X/Twitter Composer Widget
Selecting any release card auto-populates the Mock Tweet composer on the right with a pre-configured template:
```text
✨ BigQuery Update (July 09, 2026):
[Title of update]

"[Sanitized snippet of description]"

#BigQuery #GoogleCloud #GCP
```
Key composer behaviors handled in **[app.js](file:///d:/5-days%20ai/agy-cli-projects/static/js/app.js)**:
- **Character Count & Limit Indicator**: Dynamically measures text length against Twitter's 280-character limit. Uses an animated SVG progress ring that transitions colors (Blue ➔ Amber Warning ➔ Red Limit Exceeded) depending on remaining characters.
- **Smart Shorten**: A feature that parses the draft and dynamically reduces the excerpt portion in double quotes first (retaining the title and hashtags) to fit the draft within the 280 limit.
- **Tag Injector**: Instantly adds relevant hashtags (`#BigQuery #GoogleCloud #GCP #DataAnalytics`) to the draft.
- **Twitter Web Intent Integration**: Clicking "Tweet This Update" builds a URI-safe string and redirects to a Twitter Web Intent window (`https://twitter.com/intent/tweet?text=...`) for the user to securely authorize and post.

---

## 🛠️ Local Setup & How to Run

Follow these steps to run BQ Pulse locally:

### Prerequisites
Make sure you have **Python 3.8+** installed on your machine.

### Installation Steps
1. **Navigate to the Project Directory**:
   ```bash
   cd "d:\5-days ai\agy-cli-projects"
   ```

2. **Set up a Virtual Environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the Virtual Environment**:
   - **On Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **On Windows (CMD)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - **On macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Run the Server**:
   ```bash
   python app.py
   ```
   *The Flask dev server will boot up by default on `http://localhost:5000` (or `http://127.0.0.1:5000`).*

6. **Access the App**:
   Open your browser and navigate to `http://localhost:5000` to start exploring BigQuery release notes and drafting announcements.
