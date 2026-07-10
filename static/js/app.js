// State Management
let allReleases = [];
let starredReleases = [];
let starredIds = new Set();
let currentView = 'feed'; // 'feed' or 'starred'
let filteredReleases = [];
let selectedReleaseId = null;
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const notesContainer = document.getElementById('notesContainer');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon');
const retryBtn = document.getElementById('retryBtn');
const navFeed = document.getElementById('nav-feed');
const navStarred = document.getElementById('nav-starred');

// Dashboard Counters
const countFeatures = document.getElementById('countFeatures');
const countFixes = document.getElementById('countFixes');
const countDeprecations = document.getElementById('countDeprecations');
const lastUpdatedDate = document.getElementById('lastUpdatedDate');

// Composer Elements
const tweetTextarea = document.getElementById('tweetTextarea');
const tweetBtn = document.getElementById('tweetBtn');
const charCount = document.getElementById('charCount');
const charProgress = document.getElementById('charProgress');
const btnShorten = document.getElementById('btnShorten');
const btnAddTags = document.getElementById('btnAddTags');
const btnClearTweet = document.getElementById('btnClearTweet');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Placeholders
const loadingPlaceholder = document.getElementById('loadingPlaceholder');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');
const errorPlaceholder = document.getElementById('errorPlaceholder');
const errorMessage = document.getElementById('errorMessage');

// Progress Ring Configuration
const ringRadius = 14;
const ringCircumference = 2 * Math.PI * ringRadius;
if (charProgress) {
    charProgress.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    charProgress.style.strokeDashoffset = ringCircumference;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
    setupEventListeners();
    initTheme();
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', handleRefresh);
    if (retryBtn) {
        retryBtn.addEventListener('click', handleRefresh);
    }

    // Search bar
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        applyFiltersAndSearch();
    });

    // Category tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const filter = tab.getAttribute('data-filter');
            if (filter === 'starred') {
                currentView = 'starred';
                navStarred.classList.add('active');
                navFeed.classList.remove('active');
                currentFilter = 'all';
                fetchStarred();
            } else {
                if (currentView === 'starred') {
                    currentView = 'feed';
                    navFeed.classList.add('active');
                    navStarred.classList.remove('active');
                }
                currentFilter = filter;
                applyFiltersAndSearch();
            }
        });
    });

    // Sidebar navigation items
    if (navFeed) {
        navFeed.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('feed');
        });
    }
    if (navStarred) {
        navStarred.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('starred');
        });
    }

    // Tweet text area
    tweetTextarea.addEventListener('input', handleTweetInput);

    // Composer Actions
    tweetBtn.addEventListener('click', sendTweet);
    btnShorten.addEventListener('click', shortenTweetText);
    btnAddTags.addEventListener('click', addHashtags);
    btnClearTweet.addEventListener('click', clearTweetDraft);

    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
}

// Switch view mode
async function switchView(view) {
    currentView = view;
    
    if (currentView === 'feed') {
        navFeed.classList.add('active');
        navStarred.classList.remove('active');
        
        // Reset category tabs to "All"
        filterTabs.forEach(t => {
            if (t.getAttribute('data-filter') === 'all') {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        currentFilter = 'all';
        await fetchReleases();
    } else {
        navStarred.classList.add('active');
        navFeed.classList.remove('active');
        
        // Highlight "Starred" filter tab
        filterTabs.forEach(t => {
            if (t.getAttribute('data-filter') === 'starred') {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        currentFilter = 'all';
        await fetchStarred();
    }
}

// Handle Refresh depending on active view
function handleRefresh() {
    if (currentView === 'starred') {
        fetchStarred();
    } else {
        fetchReleases();
    }
}

// Fetch starred IDs from Cosmos DB for quick lookup
async function fetchStarredIds() {
    try {
        const response = await fetch('/api/starred');
        const data = await response.json();
        if (data.status === 'success') {
            starredIds = new Set(data.releases.map(r => r.id));
        }
    } catch (error) {
        console.error("Error fetching starred IDs:", error);
    }
}

// Fetch all Starred items
async function fetchStarred() {
    showState('loading');
    refreshIcon.classList.add('spinning');
    refreshBtn.disabled = true;

    try {
        const response = await fetch('/api/starred');
        const data = await response.json();

        if (data.status === 'success') {
            starredReleases = data.releases;
            starredIds = new Set(starredReleases.map(r => r.id));
            applyFiltersAndSearch();
            
            const now = new Date();
            lastUpdatedDate.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            showError(data.message || 'Failed to fetch starred releases.');
        }
    } catch (error) {
        showError('Network error. Unable to contact local Flask server.');
        console.error(error);
    } finally {
        refreshIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

// Fetch Release Notes from API
async function fetchReleases() {
    showState('loading');
    refreshIcon.classList.add('spinning');
    refreshBtn.disabled = true;

    try {
        await fetchStarredIds();

        const response = await fetch('/api/releases');
        const data = await response.json();

        if (data.status === 'success') {
            allReleases = data.releases;
            updateDashboardStats(allReleases);
            applyFiltersAndSearch();
            
            // Set last updated time
            const now = new Date();
            lastUpdatedDate.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            showError(data.message || 'Failed to fetch release notes.');
        }
    } catch (error) {
        showError('Network error. Unable to contact local Flask server.');
        console.error(error);
    } finally {
        refreshIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

// Update Dashboard Statistics
function updateDashboardStats(releases) {
    const features = releases.filter(r => r.category === 'Feature').length;
    const fixes = releases.filter(r => r.category === 'Fix').length;
    const deprecations = releases.filter(r => r.category === 'Deprecation').length;

    animateCounter(countFeatures, features);
    animateCounter(countFixes, fixes);
    animateCounter(countDeprecations, deprecations);
}

// Nice counter animation
function animateCounter(element, target) {
    if (!element) return;
    let current = 0;
    const duration = 800; // ms
    const stepTime = Math.max(Math.floor(duration / target), 15);
    
    if (target === 0) {
        element.textContent = '0';
        return;
    }

    const timer = setInterval(() => {
        current += Math.ceil(target / 30) || 1;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = current;
        }
    }, stepTime);
}

// Apply Search Query and Category Tabs
function applyFiltersAndSearch() {
    const sourceList = currentView === 'starred' ? starredReleases : allReleases;
    
    filteredReleases = sourceList.filter(release => {
        const matchesCategory = currentFilter === 'all' || release.category === currentFilter;
        
        const textContent = (release.title + ' ' + release.content).toLowerCase();
        const matchesSearch = textContent.includes(searchQuery);
        
        return matchesCategory && matchesSearch;
    });

    renderReleaseNotes();
}

// Render release note list cards
function renderReleaseNotes() {
    // Clear dynamic cards
    const existingCards = notesContainer.querySelectorAll('.release-card');
    existingCards.forEach(card => card.remove());

    if (filteredReleases.length === 0) {
        showState('empty');
        return;
    }

    showState('feed');

    filteredReleases.forEach(release => {
        const card = document.createElement('article');
        card.className = `release-card ${selectedReleaseId === release.id ? 'selected' : ''}`;
        card.setAttribute('data-id', release.id);
        
        const categoryClass = `tag-${release.category.toLowerCase()}`;
        const isStarred = starredIds.has(release.id);
        const starIconClass = isStarred ? 'fa-solid fa-star' : 'fa-regular fa-star';
        const starClass = isStarred ? 'btn-star starred' : 'btn-star';
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="category-tag ${categoryClass}">${release.category}</span>
                    <span class="card-date"><i class="fa-regular fa-calendar-days"></i> ${release.date}</span>
                </div>
                <button class="${starClass}" title="${isStarred ? 'Unstar Release' : 'Star Release'}">
                    <i class="${starIconClass}"></i>
                </button>
            </div>
            <h3 class="card-title">${release.title || 'General Update'}</h3>
            <div class="card-content">${release.content}</div>
            <div class="card-footer">
                <button class="btn-select-tweet">
                    <i class="fa-brands fa-x-twitter"></i>
                    <span>${selectedReleaseId === release.id ? 'Draft Selected' : 'Select to Tweet'}</span>
                </button>
            </div>
        `;

        // Click handler to select update for composer
        card.addEventListener('click', () => selectReleaseForTweet(release));
        
        // Star toggle click handler
        const starBtn = card.querySelector('.btn-star');
        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStar(release);
        });
        
        notesContainer.appendChild(card);
    });
}

// Star toggle handler
async function toggleStar(release) {
    const isStarred = starredIds.has(release.id);
    
    if (isStarred) {
        // DELETE /api/star/<id>
        try {
            const response = await fetch(`/api/star/${encodeURIComponent(release.id)}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.status === 'success') {
                starredIds.delete(release.id);
                if (currentView === 'starred') {
                    starredReleases = starredReleases.filter(r => r.id !== release.id);
                }
                applyFiltersAndSearch();
            } else {
                alert(`Failed to unstar: ${data.message}`);
            }
        } catch (error) {
            console.error('Error unstarring release:', error);
            alert('Failed to unstar release. Server might be unreachable.');
        }
    } else {
        // POST /api/star
        try {
            const response = await fetch('/api/star', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: release.id,
                    title: release.title,
                    link: release.link,
                    category: release.category,
                    published: release.updated_raw || release.date || '',
                    content: release.content,
                    date: release.date
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                starredIds.add(release.id);
                if (currentView === 'starred') {
                    starredReleases.push(data.item);
                }
                applyFiltersAndSearch();
            } else {
                alert(`Failed to star: ${data.message}`);
            }
        } catch (error) {
            console.error('Error starring release:', error);
            alert('Failed to star release. Server might be unreachable.');
        }
    }
}


// Selection logic
function selectReleaseForTweet(release) {
    selectedReleaseId = release.id;
    
    // Toggle active classes on cards
    const cards = notesContainer.querySelectorAll('.release-card');
    cards.forEach(card => {
        if (card.getAttribute('data-id') === release.id) {
            card.classList.add('selected');
            const selectBtnSpan = card.querySelector('.btn-select-tweet span');
            if (selectBtnSpan) selectBtnSpan.textContent = 'Draft Selected';
        } else {
            card.classList.remove('selected');
            const selectBtnSpan = card.querySelector('.btn-select-tweet span');
            if (selectBtnSpan) selectBtnSpan.textContent = 'Select to Tweet';
        }
    });

    // Populate Twitter draft template
    generateTweetDraft(release);
}

// Auto-generate Tweet template based on selected release note
function generateTweetDraft(release) {
    const rawContent = cleanHTML(release.content);
    
    // Header format
    let typeEmoji = "📢";
    if (release.category === "Feature") typeEmoji = "✨";
    if (release.category === "Fix") typeEmoji = "🛠️";
    if (release.category === "Deprecation") typeEmoji = "⚠️";
    
    // Title clean up
    let titleStr = release.title.trim();
    if (titleStr.length > 80) {
        titleStr = titleStr.substring(0, 77) + "...";
    }

    // Excerpt clean up
    let bodyExcerpt = rawContent;
    // Let's grab first sentence or first 120 characters
    if (bodyExcerpt.length > 120) {
        bodyExcerpt = bodyExcerpt.substring(0, 117) + "...";
    }

    const defaultTweet = `${typeEmoji} BigQuery Update (${release.date}):\n${titleStr}\n\n"${bodyExcerpt}"\n\n#BigQuery #GoogleCloud #GCP`;
    
    tweetTextarea.value = defaultTweet;
    handleTweetInput();
}

// Tweet input handler for count, progress bar, limits
function handleTweetInput() {
    const text = tweetTextarea.value;
    const length = text.length;
    const limit = 280;
    const remaining = limit - length;
    
    // Update count display
    charCount.textContent = remaining;
    
    // Enable/Disable buttons
    const hasText = length > 0;
    tweetBtn.disabled = !hasText || length > limit;
    btnShorten.disabled = !hasText || length <= limit;
    btnAddTags.disabled = !hasText;
    
    // Update SVG progress ring
    if (charProgress) {
        const counterContainer = document.querySelector('.character-counter');
        const percentage = Math.min(length / limit, 1);
        const offset = ringCircumference - (percentage * ringCircumference);
        charProgress.style.strokeDashoffset = offset;
        
        // Progress color states
        if (length > limit) {
            charProgress.style.stroke = 'var(--color-deprecation)';
            counterContainer.classList.add('exceeded');
            counterContainer.classList.remove('warning');
        } else if (remaining <= 20) {
            charProgress.style.stroke = '#f59e0b'; // Amber warning
            counterContainer.classList.add('warning');
            counterContainer.classList.remove('exceeded');
        } else {
            charProgress.style.stroke = 'var(--twitter-blue)';
            counterContainer.classList.remove('warning', 'exceeded');
        }
    }
}

// Action: Open standard Tweet Web Intent
function sendTweet() {
    const text = tweetTextarea.value;
    if (!text || text.length > 280) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420,toolbar=no,menubar=no,scrollbars=yes');
}

// Helper to remove html tags in frontend
function cleanHTML(html) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    
    // Handle line breaks before extracting text
    const blocks = tempDiv.querySelectorAll('p, div, li, br');
    blocks.forEach(block => {
        if (block.tagName === 'BR') {
            block.replaceWith('\n');
        } else {
            block.append('\n');
        }
    });

    let text = tempDiv.textContent || tempDiv.innerText || "";
    // Format spacing
    text = text.replace(/\n\s*\n/g, '\n').trim();
    return text;
}

// Action: Smart shorten text to fit 280 limit
function shortenTweetText() {
    let text = tweetTextarea.value;
    if (text.length <= 280) return;

    // Split text into lines/paragraphs or attempt standard cuts
    // Keep hashtags and intro, compress the middle description
    const lines = text.split('\n');
    if (lines.length > 2) {
        // Find line that looks like the quote description
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('"') && lines[i].endsWith('"')) {
                // Shorten this description to fit
                const allowedQuoteLength = 280 - (text.length - lines[i].length) - 5; // offset
                if (allowedQuoteLength > 10) {
                    lines[i] = lines[i].substring(0, allowedQuoteLength - 4) + '..."';
                    text = lines.join('\n');
                    break;
                }
            }
        }
    }
    
    // If still too long, do hard truncate preserving hashtag layout
    if (text.length > 280) {
        const hashTagsIndex = text.indexOf('#');
        if (hashTagsIndex !== -1) {
            const tags = text.substring(hashTagsIndex);
            const body = text.substring(0, hashTagsIndex);
            const remainingSpace = 280 - tags.length - 5;
            if (remainingSpace > 20) {
                text = body.substring(0, remainingSpace) + '...\n\n' + tags;
            } else {
                text = text.substring(0, 277) + '...';
            }
        } else {
            text = text.substring(0, 277) + '...';
        }
    }

    tweetTextarea.value = text;
    handleTweetInput();
}

// Action: Add popular Google Cloud / BigQuery hashtags
function addHashtags() {
    let text = tweetTextarea.value;
    const defaultTags = ['#BigQuery', '#GoogleCloud', '#GCP', '#DataAnalytics'];
    
    defaultTags.forEach(tag => {
        if (!text.toLowerCase().includes(tag.toLowerCase())) {
            text += ` ${tag}`;
        }
    });
    
    tweetTextarea.value = text.replace(/\s+/g, ' ').trim();
    // Restore layout breaks
    tweetTextarea.value = tweetTextarea.value.replace('#BigQuery', '\n\n#BigQuery');
    handleTweetInput();
}

// Action: Clear text Composer
function clearTweetDraft() {
    tweetTextarea.value = '';
    selectedReleaseId = null;
    
    // Remove selection classes
    const cards = notesContainer.querySelectorAll('.release-card');
    cards.forEach(card => {
        card.classList.remove('selected');
        const selectBtnSpan = card.querySelector('.btn-select-tweet span');
        if (selectBtnSpan) selectBtnSpan.textContent = 'Select to Tweet';
    });

    handleTweetInput();
}

// Toggle States manager
function showState(state) {
    loadingPlaceholder.classList.add('hidden');
    emptyPlaceholder.classList.add('hidden');
    errorPlaceholder.classList.add('hidden');
    notesContainer.style.display = 'flex';

    if (state === 'loading') {
        loadingPlaceholder.classList.remove('hidden');
        notesContainer.style.display = 'none';
    } else if (state === 'empty') {
        emptyPlaceholder.classList.remove('hidden');
    } else if (state === 'error') {
        errorPlaceholder.classList.remove('hidden');
        notesContainer.style.display = 'none';
    }
}

// Handle errors
function showError(msg) {
    errorMessage.textContent = msg;
    showState('error');
}

// Theme Preferences (Light/Dark Mode)
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
    const themeIcon = themeToggleBtn.querySelector('i');
    const themeText = themeToggleBtn.querySelector('span');
    
    if (theme === 'light') {
        themeIcon.className = 'fa-solid fa-sun';
        themeText.textContent = 'Light Mode';
    } else {
        themeIcon.className = 'fa-solid fa-moon';
        themeText.textContent = 'Dark Mode';
    }
}
