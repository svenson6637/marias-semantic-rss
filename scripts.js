document.addEventListener('DOMContentLoaded', () => {
    const feedList = document.getElementById('feed-list');
    const newFeedUrl = document.getElementById('new-feed-url');
    const addFeedBtn = document.getElementById('add-feed-btn');
    const clearFeedsBtn = document.getElementById('clear-feeds-btn');
    const websiteUrlInput = document.getElementById('website-url-input');
    const findFeedsBtn = document.getElementById('find-feeds-btn');
    const feedFinderResults = document.getElementById('feed-finder-results');
    const keywordsInput = document.getElementById('keywords-input');
    const keywordUpload = document.getElementById('keyword-upload');
    const clearKeywordsBtn = document.getElementById('clear-keywords-btn');
    const saveSessionBtn = document.getElementById('save-session-btn');
    const loadSessionInput = document.getElementById('load-session-input');
    const autoRefreshSelect = document.getElementById('auto-refresh-interval');
    const notificationsBtn = document.getElementById('notifications-btn');
    const dateFilterSelect = document.getElementById('date-filter-select');
    const fetchBtn = document.getElementById('fetch-and-filter-btn');
    const statusArea = document.getElementById('status-area');
    const resultsList = document.getElementById('results-list');
    const sortButtons = document.querySelectorAll('.sort-btn');

    let feeds = [
        'http://rss.cnn.com/rss/cnn_topstories.rss',
        'https://feeds.bbci.co.uk/news/world/rss.xml',
        'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/section/world/rss.xml'
    ];
    let articles = [];
    let currentSort = 'date-desc';
    let autoRefreshIntervalId = null;
    let notifiedArticleUrls = new Set();
    let isInitialFetch = true;

    const showdownConverter = new showdown.Converter();

    const saveState = () => {
        localStorage.setItem('rssFeeds', JSON.stringify(feeds));
        localStorage.setItem('rssKeywords', keywordsInput.value);
        localStorage.setItem('rssAutoRefresh', autoRefreshSelect.value);
        localStorage.setItem('rssDateFilter', dateFilterSelect.value);
    };

    const loadState = () => {
        const savedFeeds = localStorage.getItem('rssFeeds');
        if (savedFeeds) {
            feeds = JSON.parse(savedFeeds);
        }
        const savedKeywords = localStorage.getItem('rssKeywords');
        if (savedKeywords) {
            keywordsInput.value = savedKeywords;
        }
        const savedAutoRefresh = localStorage.getItem('rssAutoRefresh');
        if (savedAutoRefresh) {
            autoRefreshSelect.value = savedAutoRefresh;
        }
        const savedDateFilter = localStorage.getItem('rssDateFilter');
        if (savedDateFilter) {
            dateFilterSelect.value = savedDateFilter;
        }
    };

    const renderFeeds = () => {
        feedList.innerHTML = '';
        feeds.forEach((feed, index) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-gray-50 p-2 rounded-md';
            const feedHost = new URL(feed.startsWith('http') ? feed : `http://${feed}`).hostname;
            div.innerHTML = `
                <span class="text-sm truncate" title="${feed}">${feedHost}</span>
                <button data-index="${index}" class="remove-feed-btn text-red-500 hover:text-red-700 p-1 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;
            feedList.appendChild(div);
        });
    };

    const addFeeds = (urlsToAdd = []) => {
        const urlsFromInput = newFeedUrl.value.split(/[\s\n,]+/).map(url => url.trim()).filter(Boolean);
        const allUrls = [...urlsToAdd, ...urlsFromInput];
        if (allUrls.length === 0) return;
        
        let addedCount = 0;
        allUrls.forEach(url => {
            if (url && !feeds.includes(url)) {
                try {
                    new URL(url.startsWith('http') ? url : `http://${url}`);
                    feeds.push(url);
                    addedCount++;
                } catch (e) {
                    console.warn(`Invalid URL skipped: ${url}`);
                }
            }
        });

        if (addedCount > 0) {
            renderFeeds();
            saveState();
        }
        newFeedUrl.value = '';
    };

    const removeFeed = (index) => {
        feeds.splice(index, 1);
        renderFeeds();
        saveState();
    };

    const clearAllFeeds = () => {
        feeds = [];
        renderFeeds();
        saveState();
    };
    
    const findFeedsOnPage = async () => {
        let url = websiteUrlInput.value.trim();
        if (!url) return;
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        
        findFeedsBtn.disabled = true;
        findFeedsBtn.textContent = 'Searching...';
        feedFinderResults.innerHTML = `<span class="text-gray-500">Scanning page for feeds...</span>`;
        const proxyUrl = 'https://api.allorigins.win/get?url=';
        
        try {
            const response = await fetch(`${proxyUrl}${encodeURIComponent(url)}`);
            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.json();
            const html = data.contents;
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"]');
            
            if (links.length === 0) {
                feedFinderResults.innerHTML = `<span class="text-red-500">No RSS feeds found on this page.</span>`;
                return;
            }
            
            feedFinderResults.innerHTML = '';
            links.forEach(link => {
                let feedUrl = link.getAttribute('href');
                if (feedUrl && !feedUrl.startsWith('http')) {
                    feedUrl = new URL(feedUrl, url).href;
                }
                if (feedUrl) {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'flex items-center justify-between bg-green-50 p-2 rounded';
                    resultDiv.innerHTML = `
                        <span class="truncate pr-2" title="${feedUrl}">${link.getAttribute('title') || feedUrl}</span>
                        <button data-url="${feedUrl}" class="add-found-feed-btn bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600 flex-shrink-0">Add</button>
                    `;
                    feedFinderResults.appendChild(resultDiv);
                }
            });
        } catch (error) {
            console.error("Feed finder failed:", error);
            feedFinderResults.innerHTML = `<span class="text-red-500">Could not fetch or parse the website.</span>`;
        } finally {
            findFeedsBtn.disabled = false;
            findFeedsBtn.textContent = 'Find Feed on Page';
        }
    };

    const clearAllKeywords = () => {
        keywordsInput.value = '';
        saveState();
    };
    
    const saveSession = () => {
        const sessionData = {
            feeds: feeds,
            keywords: keywordsInput.value,
            autoRefresh: autoRefreshSelect.value,
            dateFilter: dateFilterSelect.value
        };
        const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'marias-rss-session.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const loadSession = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const sessionData = JSON.parse(e.target.result);
                if (sessionData.feeds && Array.isArray(sessionData.feeds)) {
                    feeds = sessionData.feeds;
                }
                if (sessionData.keywords && typeof sessionData.keywords === 'string') {
                    keywordsInput.value = sessionData.keywords;
                }
                if (sessionData.autoRefresh) {
                    autoRefreshSelect.value = sessionData.autoRefresh;
                }
                 if (sessionData.dateFilter) {
                    dateFilterSelect.value = sessionData.dateFilter;
                }
                renderFeeds();
                handleAutoRefreshChange();
                saveState();
            } catch (err) {
                console.error("Failed to parse session file", err);
                alert("Error: Could not load the session file. It may be corrupted.");
            }
        };
        reader.readAsText(file);
        event.target.value = null; 
    };

    const parseKeywords = () => {
        const lines = keywordsInput.value.split('\n').map(line => line.trim()).filter(line => line);
        const include = [];
        const exclude = [];
        lines.forEach(line => {
            if (line.startsWith('-')) {
                exclude.push(line.substring(1).trim().toLowerCase());
            } else {
                const parts = line.split(':');
                if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
                    include.push({ phrase: parts[0].trim().toLowerCase(), weight: parseInt(parts[1], 10) });
                } else {
                    include.push({ phrase: line.toLowerCase(), weight: 1 });
                }
            }
        });
        return { include, exclude };
    };

    const fetchFeed = async (feedUrl) => {
        const proxyUrl = 'https://api.allorigins.win/get?url=';
        try {
            const response = await fetch(`${proxyUrl}${encodeURIComponent(feedUrl)}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const text = data.contents;
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "application/xml");
            const items = xml.querySelectorAll("item, entry");
            return Array.from(items).map(item => {
                const title = item.querySelector("title")?.textContent || '';
                let description = item.querySelector("description, summary")?.textContent || '';
                description = showdownConverter.makeMarkdown(description);
                description = new DOMParser().parseFromString(description, 'text/html').body.textContent || "";
                const link = item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute('href') || '';
                let pubDateStr = item.querySelector("pubDate, published, updated")?.textContent || '';
                return { title, description, link, pubDate: pubDateStr ? new Date(pubDateStr) : new Date(), feed: new URL(feedUrl).hostname };
            });
        } catch (error) {
            console.error(`Failed to fetch feed: ${feedUrl}`, error);
            return [];
        }
    };

    const fetchAndFilter = async (isAutoRefresh = false) => {
        if (!isAutoRefresh) {
            statusArea.innerHTML = `
            <div class="text-center text-gray-500 py-16">
                <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 mx-auto"></div>
                <h3 class="text-lg font-semibold">Fetching feeds...</h3>
            </div>`;
            resultsList.innerHTML = '';
        }
        
        const { include, exclude } = parseKeywords();
        if (include.length === 0) {
             statusArea.innerHTML = `<div class="text-center text-red-500 py-16"><h3 class="text-lg font-semibold">Please enter at least one keyword to search for.</h3></div>`;
            return;
        }

        const allItemsPromises = feeds.map(fetchFeed);
        const allItemsArrays = await Promise.all(allItemsPromises);
        const fetchedArticles = [].concat(...allItemsArrays);
        
        const filterValue = dateFilterSelect.value;
        let articlesToProcess = fetchedArticles;

        if (filterValue !== 'all') {
            const days = parseInt(filterValue, 10);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            articlesToProcess = fetchedArticles.filter(article => article.pubDate >= cutoffDate);
        }

        const newArticlesForNotification = [];

        const filteredArticles = articlesToProcess.map(article => {
            const content = `${article.title.toLowerCase()} ${article.description.toLowerCase()}`;
            if (exclude.some(ex => content.includes(ex))) return null;
            
            let score = 0;
            let matches = new Set();
            include.forEach(kw => {
                const allWordsMatch = kw.phrase.split(' ').filter(w => w).every(word => content.includes(word));
                if (allWordsMatch) {
                    score += kw.weight;
                    matches.add(kw.phrase);
                }
            });
            
            if (score > 0) {
                article.score = score;
                article.matches = Array.from(matches);
                if (!notifiedArticleUrls.has(article.link)) {
                    newArticlesForNotification.push(article);
                    notifiedArticleUrls.add(article.link);
                }
                return article;
            }
            return null;
        }).filter(Boolean);
        
        if (isAutoRefresh && !isInitialFetch && newArticlesForNotification.length > 0) {
            newArticlesForNotification.forEach(article => {
                showNotification(`New Article: ${article.title}`, article.description.substring(0, 100) + '...');
            });
        }
        
        articles = filteredArticles;
        sortAndRender();
        isInitialFetch = false;
    };

    const highlightKeywords = (text, matches) => {
        if (!text) return '';
        if (!matches || matches.length === 0) return text;
        
        // Flatten all words from all match phrases for highlighting
        const allMatchWords = matches.flatMap(phrase => phrase.split(' ')).filter(Boolean);
        const uniqueWords = [...new Set(allMatchWords)];
        
        const escapedMatches = uniqueWords.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if(escapedMatches.length === 0) return text;
        
        const regex = new RegExp(`(${escapedMatches.join('|')})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    };

    const sortAndRender = () => {
        if (articles.length === 0) {
            statusArea.innerHTML = `<div class="text-center text-gray-500 py-16"><h3 class="text-lg font-semibold">No matching articles found.</h3><p class="mt-1">Try adjusting your keywords or date filter.</p></div>`;
            resultsList.innerHTML = '';
            return;
        }

        statusArea.innerHTML = '';
        switch(currentSort) {
            case 'date-desc': articles.sort((a, b) => b.pubDate - a.pubDate); break;
            case 'date-asc': articles.sort((a, b) => a.pubDate - b.pubDate); break;
            case 'relevance': articles.sort((a, b) => b.score - a.score); break;
        }
        renderResults(articles);
    };
    
    const renderResults = (articlesToRender) => {
        resultsList.innerHTML = articlesToRender.map(article => {
            const title = highlightKeywords(article.title, article.matches);
            const description = highlightKeywords(article.description, article.matches).substring(0, 200) + '...';
            return `<div class="border-b pb-4 last:border-b-0">
                <h3 class="text-lg font-semibold mb-1"><a href="${article.link}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${title}</a></h3>
                <div class="text-xs text-gray-500 mb-2"><span>${article.feed}</span> &bull; <span>${article.pubDate.toLocaleDateString()}</span> &bull; <span class="font-medium">Relevance: ${article.score}</span></div>
                <p class="text-sm text-gray-700">${description}</p>
                <div class="mt-2 text-xs"><strong>Matches:</strong> ${article.matches.join(', ')}</div>
            </div>`;
        }).join('');
    };
    
    const handleAutoRefreshChange = () => {
        if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
        const intervalMinutes = parseInt(autoRefreshSelect.value, 10);
        if (intervalMinutes > 0) {
            autoRefreshIntervalId = setInterval(() => fetchAndFilter(true), intervalMinutes * 60 * 1000);
        }
        saveState();
    };

    const updateNotificationButton = () => {
        if (!('Notification' in window)) {
            notificationsBtn.textContent = 'Notifications Not Supported';
            notificationsBtn.disabled = true;
            return;
        }
        switch(Notification.permission) {
            case 'granted':
                notificationsBtn.textContent = 'Notifications Enabled';
                notificationsBtn.classList.remove('bg-teal-500', 'hover:bg-teal-600');
                notificationsBtn.classList.add('bg-green-500');
                notificationsBtn.disabled = true;
                break;
            case 'denied':
                notificationsBtn.textContent = 'Notifications Blocked';
                notificationsBtn.disabled = true;
                break;
            default:
                notificationsBtn.textContent = 'Enable Notifications';
        }
    };

    const handleNotificationClick = () => {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                updateNotificationButton();
            });
        }
    };
    
    const showNotification = (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title, { body: body, icon: 'https://placehold.co/48x48/F9E477/000000?text=🐸' });
        }
    };

    addFeedBtn.addEventListener('click', () => addFeeds());
    newFeedUrl.addEventListener('keypress', (e) => { if (e.key === 'Enter') addFeeds(); });
    feedList.addEventListener('click', (e) => {
        const button = e.target.closest('.remove-feed-btn');
        if (button) removeFeed(parseInt(button.dataset.index, 10));
    });
    clearFeedsBtn.addEventListener('click', clearAllFeeds);
    
    findFeedsBtn.addEventListener('click', findFeedsOnPage);
    feedFinderResults.addEventListener('click', (e) => {
        const button = e.target.closest('.add-found-feed-btn');
        if (button) {
            addFeeds([button.dataset.url]);
            button.textContent = 'Added';
            button.disabled = true;
        }
    });

    keywordUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            keywordsInput.value += (keywordsInput.value ? '\n' : '') + event.target.result.replace(/,/g, '\n');
            saveState();
        };
        reader.readAsText(file);
    });
    clearKeywordsBtn.addEventListener('click', clearAllKeywords);
    keywordsInput.addEventListener('input', saveState);
    saveSessionBtn.addEventListener('click', saveSession);
    loadSessionInput.addEventListener('change', loadSession);
    fetchBtn.addEventListener('click', () => fetchAndFilter(false));
    sortButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            currentSort = e.target.dataset.sort;
            sortButtons.forEach(btn => btn.classList.replace('bg-gray-200', 'bg-gray-100'));
            e.target.classList.replace('bg-gray-100', 'bg-gray-200');
            sortAndRender();
        });
    });
    autoRefreshSelect.addEventListener('change', handleAutoRefreshChange);
    notificationsBtn.addEventListener('click', handleNotificationClick);
    dateFilterSelect.addEventListener('change', saveState);

    // Initial setup
    loadState();
    renderFeeds();
    handleAutoRefreshChange();
    updateNotificationButton();
});

