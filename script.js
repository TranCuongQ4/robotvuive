// ========== CẤU HÌNH TÌM KIẾM ==========
const WORKER_URL = 'https://solitary-glitter-6b93robotvuive.tranmanhcuonghappy.workers.dev';

// ========== ĐẾM SỐ LẦN TÌM KIẾM ==========
// Lưu vào localStorage để nhớ số lần đã dùng
function getSearchCount() {
    const today = new Date().toDateString();
    const saved = localStorage.getItem('searchCount');
    if (saved) {
        const data = JSON.parse(saved);
        if (data.date === today) {
            return data.count;
        }
    }
    return 0;
}

function incrementSearchCount() {
    const today = new Date().toDateString();
    const count = getSearchCount() + 1;
    localStorage.setItem('searchCount', JSON.stringify({ date: today, count: count }));
    return count;
}

// Giới hạn số lần tìm kiếm miễn phí (SerpAPI 250/tháng → khoảng 8/ngày)
const SEARCH_LIMIT = 8; // Có thể điều chỉnh

// ========== HÀM TÌM KIẾM QUA WORKER ==========
async function searchGoogle(query) {
    try {
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'search',
                query: query
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error('Search API error:', data.error);
            return await searchWikipedia(query);
        }
        
        if (data.organic_results && data.organic_results.length > 0) {
            const result = data.organic_results[0];
            return {
                title: result.title || 'Không có tiêu đề',
                snippet: result.snippet || 'Không có mô tả',
                link: result.link || '#'
            };
        }
        return null;
    } catch (error) {
        console.error('Search error:', error);
        return await searchWikipedia(query);
    }
}

// ========== FALLBACK: WIKIPEDIA ==========
async function searchWikipedia(query) {
    try {
        const url = `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.extract) {
            return {
                title: data.title || 'Wikipedia',
                snippet: data.extract.substring(0, 300),
                link: data.content_urls?.desktop?.page || '#'
            };
        }
        return null;
    } catch (error) {
        console.error('Wikipedia error:', error);
        return null;
    }
}

// ========== HÀM LẤY GIÁ VÀNG ==========
async function getGoldPrice() {
    try {
        const response = await fetch('https://api.thingspeak.com/channels/2155837/feeds.json?results=1');
        const data = await response.json();
        
        if (data.feeds && data.feeds.length > 0) {
            return {
                price: data.feeds[0].field1 || 'Chưa có dữ liệu',
                time: data.feeds[0].created_at
            };
        }
        return null;
    } catch (error) {
        console.error('Gold price error:', error);
        return null;
    }
}

// ========== HÀM LẤY GIÁ XĂNG ==========
async function getGasPrice() {
    try {
        const response = await fetch('https://api.thingspeak.com/channels/2155837/feeds.json?results=1');
        const data = await response.json();
        
        if (data.feeds && data.feeds.length > 0) {
            return {
                price: data.feeds[0].field2 || 'Chưa có dữ liệu'
            };
        }
        return null;
    } catch (error) {
        console.error('Gas price error:', error);
        return null;
    }
}


// ========== MỞ TAB MỚI GOOGLE ==========
function openWebSearch(query, searchType = 'google') {
    let searchUrl;
    if (searchType === 'giavang') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('giá vàng hôm nay ' + query)}`;
    } else if (searchType === 'giaxang') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('giá xăng dầu hôm nay ' + query)}`;
    } else if (searchType === 'radio') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('nghe radio online ' + query)}`;
    } else {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
    window.open(searchUrl, '_blank');
    if (webviewContainer) webviewContainer.style.display = 'none';
}

// ========== XỬ LÝ LỆNH (GỘP 2 HÀM) ==========
async function processCommand(message) {
    const lowerMsg = message.toLowerCase();
    
    // 1. XỬ LÝ NHẠC
    if (MUSIC_KEYWORDS.some(kw => lowerMsg.includes(kw))) {
        const songName = extractSongName(message);
        await playYouTube(songName);
        return true;
    }
    
    // 2. XỬ LÝ DỪNG NHẠC
    if (STOP_KEYWORDS.some(kw => lowerMsg.includes(kw))) {
        addBotMessage('🎵 Bạn có thể tắt tab YouTube đang mở để dừng nhạc nhé!');
        return true;
    }
    
    // 3. ✅ XỬ LÝ RADIO - MỞ TAB MỚI
    if (lowerMsg.includes('radio') || lowerMsg.includes('nghe đài')) {
        addBotMessage(`📻 Đang mở tìm kiếm radio cho bạn...`);
        openWebSearch(message, 'radio');
        return true;
    }
    
    // 4. XỬ LÝ GIÁ VÀNG
    if (lowerMsg.includes('giá vàng') || lowerMsg.includes('vàng hôm nay')) {
        // Thử lấy từ API giá vàng trước
        const result = await getGoldPrice();
        if (result) {
            const reply = `💰 Giá vàng hôm nay: ${result.price} VND/chỉ`;
            addBotMessage(reply);
            speakText(reply);
            return true;
        }
        
        // Nếu API lỗi, kiểm tra số lần tìm kiếm
        const count = getSearchCount();
        if (count >= SEARCH_LIMIT) {
            // Hết lượt → mở tab mới
            addBotMessage(`🔍 Đã hết lượt tìm kiếm trong ngày (${SEARCH_LIMIT}/${SEARCH_LIMIT}). Mở Google cho bạn...`);
            openWebSearch(message, 'giavang');
            return true;
        }
        
        // Còn lượt → tìm kiếm và đọc
        addBotMessage('💰 Không lấy được giá vàng. Đang tìm kiếm trên Google...');
        incrementSearchCount();
        const searchResult = await searchGoogle('giá vàng hôm nay');
        if (searchResult) {
            addBotMessage(`📌 ${searchResult.snippet}`);
            speakText(searchResult.snippet);
        } else {
            addBotMessage('❌ Không tìm thấy thông tin. Mở Google cho bạn...');
            openWebSearch(message, 'giavang');
        }
        return true;
    }
    
    // 5. XỬ LÝ GIÁ XĂNG
    if (lowerMsg.includes('giá xăng') || lowerMsg.includes('xăng hôm nay') || lowerMsg.includes('giá dầu')) {
        const result = await getGasPrice();
        if (result) {
            const reply = `⛽ Giá xăng hôm nay: ${result.price} VND/lít`;
            addBotMessage(reply);
            speakText(reply);
            return true;
        }
        
        const count = getSearchCount();
        if (count >= SEARCH_LIMIT) {
            addBotMessage(`🔍 Đã hết lượt tìm kiếm trong ngày (${SEARCH_LIMIT}/${SEARCH_LIMIT}). Mở Google cho bạn...`);
            openWebSearch(message, 'giaxang');
            return true;
        }
        
        addBotMessage('⛽ Không lấy được giá xăng. Đang tìm kiếm trên Google...');
        incrementSearchCount();
        const searchResult = await searchGoogle('giá xăng hôm nay');
        if (searchResult) {
            addBotMessage(`📌 ${searchResult.snippet}`);
            speakText(searchResult.snippet);
        } else {
            addBotMessage('❌ Không tìm thấy thông tin. Mở Google cho bạn...');
            openWebSearch(message, 'giaxang');
        }
        return true;
    }
    
    // 6. AUTO-SEARCH: TỰ ĐỘNG TÌM KIẾM KHI KHÔNG BIẾT
    if (lowerMsg.includes('?') || 
        lowerMsg.includes('là gì') || 
        lowerMsg.includes('ai là') ||
        lowerMsg.includes('tin tức') ||
        lowerMsg.includes('thời tiết')) {
        
        const count = getSearchCount();
        if (count >= SEARCH_LIMIT) {
            addBotMessage(`🔍 Đã hết lượt tìm kiếm trong ngày (${SEARCH_LIMIT}/${SEARCH_LIMIT}). Mở Google cho bạn...`);
            openWebSearch(message);
            return true;
        }
        
        addBotMessage(`🔍 Đang tìm kiếm "${message}"...`);
        incrementSearchCount();
        const result = await searchGoogle(message);
        if (result) {
            const reply = `📌 ${result.snippet}`;
            addBotMessage(reply);
            speakText(result.snippet);
        } else {
            const reply = '❌ Không tìm thấy thông tin. Mở Google cho bạn...';
            addBotMessage(reply);
            openWebSearch(message);
        }
        return true;
    }
    
    return false;
}


// Configuration
const API_URL = 'https://solitary-glitter-6b93robotvuive.tranmanhcuonghappy.workers.dev';
const MODEL = 'qwen/qwen3-32b';



// DOM elements
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const chatContainer = document.getElementById('chatContainer');
const robotMouth = document.getElementById('robotMouth');
const youtubeContainer = document.getElementById('youtubePlayerContainer');
const webviewContainer = document.getElementById('webviewContainer');
const webviewFrame = document.getElementById('webviewFrame');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const closePlayerBtn = document.getElementById('closePlayerBtn');
const closeWebviewBtn = document.getElementById('closeWebviewBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const stopMusicBtn = document.getElementById('stopMusicBtn');

// YouTube Player
let player = null;
let currentVideoId = null;
let isPlaying = false;

// Audio synthesis
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;

// Speech Recognition
let recognition = null;
let isRecording = false;

// Lưu âm thanh đã phát
let lastAudioBlob = null;

// DOM elements cho nút dịch
const translateEnToViBtn = document.getElementById('translateEnToViBtn');
const translateViToEnBtn = document.getElementById('translateViToEnBtn');

// Trạng thái ghi âm dịch
let translateRecognition = null;
let isTranslateRecording = false;
let currentTranslateMode = null;

// Biến cho audio và trạng thái nói
let currentAudio = null;
let isSpeaking = false;

// ========== DANH SÁCH TỪ KHÓA ==========
const MUSIC_KEYWORDS = ['mở nhạc', 'play', 'bật nhạc', 'nghe bài', 'cho tôi nghe', 'mở bài', 'phát nhạc', 'nghe nhạc'];
const STOP_KEYWORDS = ['tắt nhạc', 'dừng nhạc', 'stop music'];
const SEARCH_KEYWORDS = ['giá xăng', 'xăng hôm nay', 'giá dầu', 'giá vàng', 'vàng hôm nay', 'thời tiết', 'tin tức'];

// Hàm lọc bỏ ký tự markdown và ký tự đặc biệt
function cleanMarkdown(text) {
    let cleaned = text;
    
    // Loại bỏ các pattern markdown phổ biến
    cleaned = cleaned.replace(/\*\*\*(.*?)\*\*\*/g, '$1');  // ***bold italic***
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');     // **bold**
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');         // *italic*
    cleaned = cleaned.replace(/__(.*?)__/g, '$1');         // __bold__
    cleaned = cleaned.replace(/_(.*?)_/g, '$1');           // _italic_
    cleaned = cleaned.replace(/~~(.*?)~~/g, '$1');         // ~~strikethrough~~
    cleaned = cleaned.replace(/`(.*?)`/g, '$1');           // `code`
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');      // code blocks
    
    // Loại bỏ hashtag và markdown headers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');         // # Header
    
    // Loại bỏ link markdown [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Loại bỏ dấu ngoặc kép thừa
    cleaned = cleaned.replace(/^["']|["']$/g, '');
    
    // Nén nhiều khoảng trắng thành 1
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

// ========== HÀM TRÍCH XUẤT TÊN BÀI HÁT ==========
function extractSongName(message) {
    let songName = message;
    const removePatterns = ['mở nhạc', 'bật nhạc', 'nghe nhạc', 'cho tôi nghe', 'mở bài', 'phát nhạc', 'play nhạc', 'nghe bài', 'mở', 'phát', 'nghe', 'bật', 'play'];
    for (const pattern of removePatterns) {
        const regex = new RegExp(pattern, 'gi');
        songName = songName.replace(regex, '');
    }
    songName = songName.replace(/(giúp tôi|hãy|với|đi|ạ|ơi|cho tôi|tôi muốn)/gi, '');
    songName = songName.trim();
    if (!songName || songName.length < 2) {
        return 'nhạc thư giãn';
    }
    console.log(`🎵 [DEBUG] Câu gốc: "${message}" -> Tên bài: "${songName}"`);
    return songName;
}

// ========== YOUTUBE FUNCTIONS ==========
function onYouTubeIframeAPIReady() {
    console.log("YouTube API ready");
}

async function playYouTube(songName) {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`;
    addBotMessage(`🎵 Đang mở YouTube tìm kiếm "${songName}" cho bạn...`);
    window.open(searchUrl, '_blank');
    addBotMessage(`✅ Đã mở YouTube với từ khóa "${songName}". Bạn click vào video muốn nghe nhé! 🎧`);
}

function initPlayer(videoId, title) {}
function onPlayerStateChange(event) {}
function togglePlayPause() {}
function stopAndClosePlayer() {}
function closePlayer() { youtubeContainer.style.display = 'none'; }
function openYouTubeSearch(songName) { playYouTube(songName); }

// ========== MỞ TAB MỚI GOOGLE ==========
function openWebSearch(query, searchType = 'google') {
    let searchUrl;
    if (searchType === 'giavang') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('giá vàng hôm nay ' + query)}`;
    } else if (searchType === 'giaxang') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('giá xăng dầu hôm nay ' + query)}`;
	} else if (searchType === 'radio') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('nghe radio ' + query)}`;	
    } else {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
    window.open(searchUrl, '_blank');
    if (webviewContainer) webviewContainer.style.display = 'none';
}

function closeWebview() {
    const webviewContainer = document.getElementById('webviewContainer');
    if (webviewContainer) {
        webviewContainer.style.display = 'none';
    }
}



// ========== GỬI TIN NHẮN LÊN WORKER ==========
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
	
	const lowerMsg = message.toLowerCase();
    
    chatInput.value = '';
    startTalkingAnimation();
    
    // Kiểm tra lệnh đặc biệt (nhạc, giá vàng, thời tiết...)
    const isCommand = await processCommand(message);
    if (isCommand) {
        stopTalkingAnimation();
        return;
    }
    
    showLoadingOnRobot();
    const loadingId = addLoadingMessage();
    
    try {
        // ✅ XÁC ĐỊNH max_tokens DỰA TRÊN ĐỘ DÀI CÂU HỎI
        let maxTokens = 2048; // Mặc định
        
        // Nếu câu hỏi dài hoặc yêu cầu viết bài
        if (message.length > 100 || 
            lowerMsg.includes('bài văn') || 
            lowerMsg.includes('viết') || 
            lowerMsg.includes('kể về') || 
            lowerMsg.includes('tả về')) {
            maxTokens = 4096; // Bài viết dài
        }
        
        // Nếu câu hỏi ngắn, hỏi nhanh
        if (message.length < 30 && !message.includes('?')) {
            maxTokens = 500; // Trả lời ngắn
        }
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { 
                        role: 'system', 
                        content: `Bạn là một trợ lý AI thông minh, thân thiện, vui vẻ, người Việt Nam.

                        ⚠️ QUY TẮC CỰC KỲ QUAN TRỌNG:
                        1. CHỈ trả lời bằng TIẾNG VIỆT (trừ khi được yêu cầu cụ thể)
                        2. KHÔNG được dùng thẻ <think> hay bất kỳ thẻ XML/HTML nào
                        3. KHÔNG được giải thích cách suy nghĩ
                        4. KHÔNG được dịch câu hỏi của người dùng
                        5. Trả lời trực tiếp, tự nhiên, đúng trọng tâm
                        6. KHÔNG được nói về bản thân là AI hay model
                        
                        BẢN CHẤT CỦA BẠN:
                        - Là một người bạn đồng hành thông minh, hiểu biết
                        - Luôn trả lời chi tiết, dễ hiểu, đầy đủ
                        - Giúp đỡ người dùng bằng kiến thức của mình
                        - Thái độ tích cực, thân thiện, lịch sự
                        
                        LƯU Ý QUAN TRỌNG NHẤT:
                        - Nếu người dùng hỏi bằng tiếng Việt → TRẢ LỜI BẰNG TIẾNG VIỆT
                        - Nếu người dùng hỏi bằng tiếng Anh → CÓ THỂ trả lời bằng tiếng Anh
                        - KHÔNG TỰ ĐỘNG DỊCH CÂU HỎI CỦA NGƯỜI DÙNG` 
                    },
                    { role: 'user', content: message }
                ],
                max_tokens: maxTokens,  // ✅ Cân chỉnh động
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API error ${response.status}: ${errorData}`);
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from API');
        }
        
        let botReply = data.choices[0].message.content;
        
        // ✅ Xóa thẻ <think> nếu có
        botReply = botReply.replace(/<think>[\s\S]*?<\/think>/g, '');
        botReply = botReply.trim();
        
        removeLoadingMessage(loadingId);
        addBotMessage(botReply);
        speakText(botReply);
        
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage(loadingId);
        addBotMessage(`Xin lỗi, tôi gặp lỗi: ${error.message}. Vui lòng thử lại!`);
    } finally {
        hideLoadingOnRobot();
    }
    
    setTimeout(() => stopTalkingAnimation(), 500);
}

// ========== HIỂN THỊ TIN NHẮN - CẢI TIẾN ==========

function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bot-message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;
    
    // ✅ Lấy phần dịch để phát lại (nếu có)
    let textToSpeak = text;
    // Nếu có dòng "📝" thì lấy phần sau nó
    if (text.includes('📝')) {
        const parts = text.split('📝');
        if (parts.length > 1) {
            textToSpeak = parts[1].trim();
        }
    }
    // Nếu có dòng "🎤" và "📝" thì lấy phần dịch
    if (text.includes('🎤') && text.includes('📝')) {
        const match = text.match(/📝\s*(.+)/);
        if (match) {
            textToSpeak = match[1].trim();
        }
    }
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginTop = '8px';
    buttonContainer.style.alignItems = 'center';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋 Sao chép';
    copyBtn.onclick = () => copyToClipboard(text, copyBtn);
    
    const replayBtn = document.createElement('button');
    replayBtn.className = 'copy-btn';
    replayBtn.innerHTML = '🎤 Phát lại';
    replayBtn.onclick = async (e) => {
        const btn = e.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = '🔊 Đang đọc...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        
        try {
            // ✅ PHÁT LẠI: Chỉ đọc phần dịch
            const cleanText = cleanMarkdown(textToSpeak);
            await speakText(cleanText);
        } catch (err) {
            console.error("Phát lại lỗi:", err);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    };
    
    const stopBtn = document.createElement('button');
    stopBtn.className = 'copy-btn';
    stopBtn.innerHTML = '⏹️ Dừng';
    stopBtn.style.background = 'rgba(231, 76, 60, 0.7)';
    stopBtn.onclick = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        if (currentUtterance) {
            speechSynthesis.cancel();
            currentUtterance = null;
        }
        isSpeaking = false;
        stopTalkingAnimation();
        addBotMessageTemporary('⏹️ Đã dừng đọc!', 1500);
    };
    
    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(replayBtn);
    buttonContainer.appendChild(stopBtn);
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(buttonContainer);
    messageDiv.appendChild(messageContent);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

let tempMessageTimeout = null;
function addBotMessageTemporary(text, duration = 2000) {
    if (tempMessageTimeout) clearTimeout(tempMessageTimeout);
    
    const tempDiv = document.createElement('div');
    tempDiv.className = 'bot-message temp-message';
    const tempContent = document.createElement('div');
    tempContent.className = 'message-content';
    tempContent.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
    tempContent.style.opacity = '0.9';
    tempContent.innerHTML = text;
    tempDiv.appendChild(tempContent);
    chatContainer.appendChild(tempDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    tempMessageTimeout = setTimeout(() => {
        if (tempDiv) tempDiv.remove();
    }, duration);
}

function addLoadingMessage() {
    const id = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = id;
    loadingDiv.className = 'bot-message';
    const loadingContent = document.createElement('div');
    loadingContent.className = 'message-content';
    loadingContent.innerHTML = '<div class="loading"></div> 🤖 Robot đang suy nghĩ...';
    loadingDiv.appendChild(loadingContent);
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}

function removeLoadingMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Đã sao chép!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        btn.innerHTML = '❌ Thất bại';
        setTimeout(() => { btn.innerHTML = '📋 Sao chép'; }, 2000);
    }
}

// ========== TEXT TO SPEECH ==========
async function speakText(text) {
    // Dừng audio đang phát
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    isSpeaking = true;
    startTalkingAnimation();
    
    // Làm sạch text
    let cleanText = text;
    cleanText = cleanText.replace(/^[📝✅🔄🎤]\s*/, '');
    cleanText = cleanText.replace(/^["']|["']$/g, '');
    cleanText = cleanMarkdown(cleanText);
    cleanText = cleanText.trim();
    
    if (!cleanText) {
        stopTalkingAnimation();
        return;
    }
    
    // Thử dùng Web Speech API trước
    try {
        await webSpeechFallback(cleanText);
        return;
    } catch (error) {
        console.log("Web Speech API error, trying Edge TTS:", error);
    }
    
    // Nếu Web Speech API lỗi, thử Edge TTS
    try {
        const { EdgeTTS } = await import('@edge-tts/universal');
        const language = detectLanguage(cleanText);
        let voice = language === 'vi' ? 'vi-VN-NamMinhNeural' : 'en-US-GuyNeural';
        
        const tts = new EdgeTTS(cleanText, voice);
        const result = await tts.synthesize();
        const audioUrl = URL.createObjectURL(result.audio);
        currentAudio = new Audio(audioUrl);
        
        currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            isSpeaking = false;
            stopTalkingAnimation();
        };
        
        currentAudio.onerror = (e) => {
            console.error("Edge TTS play error:", e);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            webSpeechFallback(cleanText);
        };
        
        currentAudio.play();
        
    } catch (error) {
        console.error("Edge TTS error:", error);
        webSpeechFallback(cleanText);
    }
}

// Hàm fallback dùng Web Speech API (GIỌNG NAM)
function webSpeechFallback(text) {
    if (currentUtterance) {
        speechSynthesis.cancel();
    }
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    let selectedVoice = null;
    
    const language = detectLanguage(text);
    
    if (language === 'vi') {
        selectedVoice = voices.find(voice => 
            voice.name.toLowerCase() === 'microsoft nam' ||
            voice.name.toLowerCase().includes('nam') ||
            (voice.name.toLowerCase().includes('minh') && voice.lang === 'vi-VN') ||
            (voice.name.toLowerCase().includes('đức') && voice.lang === 'vi-VN')
        );
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => 
                voice.lang === 'vi-VN' && 
                (voice.name.toLowerCase().includes('nam') || 
                 voice.name.toLowerCase().includes('minh') ||
                 voice.name.toLowerCase().includes('đức'))
            );
        }
        console.log("🎤 Phát hiện TIẾNG VIỆT, tìm giọng NAM");
    } else {
        selectedVoice = voices.find(voice => 
            voice.name.includes('Google UK English Male') ||
            voice.name.includes('Microsoft David') ||
            voice.name.toLowerCase().includes('david') ||
            voice.name.toLowerCase().includes('guy') ||
            (voice.lang === 'en-US' && voice.name.toLowerCase().includes('male'))
        );
        console.log("🎤 Phát hiện TIẾNG ANH, tìm giọng NAM");
    }
    
    if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
            voice.lang === 'en-US' && voice.name.toLowerCase().includes('male')
        );
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.lang === 'en-US');
        }
        console.log("🎤 Không tìm thấy giọng nam ưu tiên, dùng giọng mặc định");
    }
    
    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
        console.log("🎤 Dùng giọng Web Speech (NAM):", selectedVoice.name);
    }
    
    currentUtterance.lang = language === 'vi' ? 'vi-VN' : 'en-US';
    currentUtterance.rate = 0.95;
    currentUtterance.pitch = 1.0;
    currentUtterance.volume = 1;
    
    currentUtterance.onend = () => {
        currentUtterance = null;
        isSpeaking = false;
        stopTalkingAnimation();
    };
    
    currentUtterance.onerror = (event) => {
        if (event.error !== 'interrupted') {
            console.error("Web Speech error:", event.error);
        }
        currentUtterance = null;
        isSpeaking = false;
        stopTalkingAnimation();
    };
    
    speechSynthesis.speak(currentUtterance);
}

function detectLanguage(text) {
    const vietnameseChars = /[àáảãạâầấẩẫậăằắẳẵặđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
    if (vietnameseChars.test(text)) return 'vi';
    return 'en';
}

// ========== HOẠT HÌNH ROBOT (ĐÃ TẮT) ==========
function startTalkingAnimation() { 
    // Không làm gì cả - đã tắt hiệu ứng
}

function stopTalkingAnimation() { 
    // Không làm gì cả - đã tắt hiệu ứng
}

// Hiệu ứng nháy mắt
setInterval(() => {
    const eyes = document.querySelectorAll('.eye');
    eyes.forEach(eye => {
        eye.classList.add('blink');
        setTimeout(() => eye.classList.remove('blink'), 300);
    });
}, 4000);

// Thêm antenna
document.addEventListener('DOMContentLoaded', function() {
    const robot3d = document.querySelector('.robot-3d');
    if (robot3d && !document.querySelector('.antenna-left')) {
        const antennaLeft = document.createElement('div');
        antennaLeft.className = 'antenna-left';
        const antennaRight = document.createElement('div');
        antennaRight.className = 'antenna-right';
        robot3d.appendChild(antennaLeft);
        robot3d.appendChild(antennaRight);
    }
});

function startRecording() {
    if (recognition) {
        recognition.start();
        micBtn.classList.add('recording');
        isRecording = true;
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
        micBtn.classList.remove('recording');
        isRecording = false;
    }
}

// ========== KHỞI TẠO ==========
if (closePlayerBtn) closePlayerBtn.addEventListener('click', () => {});
if (closeWebviewBtn) closeWebviewBtn.addEventListener('click', closeWebview);
if (playPauseBtn) playPauseBtn.addEventListener('click', () => {});
if (stopMusicBtn) stopMusicBtn.addEventListener('click', () => {});

function loadVoices() {
    console.log("Voices loaded:", speechSynthesis.getVoices().map(v => v.name));
}
speechSynthesis.onvoiceschanged = loadVoices;

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        addBotMessage('Xin Chào Ạ! Tôi đã sẵn sàng!\n');
    }, 500);
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// Microphone
if ('webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
        if (event.results[0] && event.results[0][0]) {
            chatInput.value = event.results[0][0].transcript;
            sendMessage();
            stopRecording();
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        if (event.error === 'network') {
            addBotMessage('⚠️ Lỗi kết nối mạng. Kiểm tra internet và thử lại.');
        } else if (event.error === 'not-allowed') {
            addBotMessage('⚠️ Cần cấp quyền truy cập micro.');
        }
        stopRecording();
    };
    
    recognition.onend = () => stopRecording();
}

micBtn.addEventListener('click', async () => {
    if (!recognition) {
        addBotMessage('Trình duyệt không hỗ trợ micro.');
        return;
    }
    
    if (isRecording) {
        stopRecording();
        return;
    }
    
    // Kiểm tra quyền micro
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        startRecording();
    } catch(err) {
        addBotMessage('⚠️ Không thể truy cập micro. Vui lòng cấp quyền và thử lại.');
    }
});

window.addEventListener('beforeunload', () => {
    if (currentUtterance) speechSynthesis.cancel();
});

// ========== DỊCH THUẬT - CHỈ DỊCH, KHÔNG GIẢNG ==========

async function translateText(text, sourceLang, targetLang) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { 
                        role: 'system', 
                        content: `Bạn là công cụ dịch thuật chuyên nghiệp.
                        
                        QUY TẮC CỰC KỲ QUAN TRỌNG:
                        1. CHỈ trả về bản dịch DUY NHẤT
                        2. KHÔNG được thêm bất kỳ từ nào khác
                        3. KHÔNG được giải thích
                        4. KHÔNG được suy nghĩ hay phân tích
                        5. KHÔNG được dùng thẻ <think>
                        6. KHÔNG được dùng dấu ngoặc kép
                        7. KHÔNG được viết "Bản dịch:" hay "Translation:"
                        
                        Ví dụ:
                        Input: "Tôi muốn du lịch ở Singapore"
                        Output: I want to travel in Singapore
                        
                        Input: "Hello, how are you?"
                        Output: Xin chào, bạn khỏe không?`
                    },
                    { 
                        role: 'user', 
                        content: `Dịch chính xác câu sau từ ${sourceLang} sang ${targetLang}. CHỈ trả về bản dịch, KHÔNG gì khác:

${text}` 
                    }
                ],
                max_tokens: 300,
                temperature: 0.1,
                top_p: 0.9
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error ${response.status}`);
        }
        
        const data = await response.json();
        let translated = data.choices[0].message.content;
        
        // Loại bỏ thẻ <think>
        translated = translated.replace(/<think>[\s\S]*?<\/think>/g, '');
        // Loại bỏ dấu ngoặc kép
        translated = translated.replace(/^["']|["']$/g, '');
        // Loại bỏ "Bản dịch:" nếu có
        translated = translated.replace(/^(Bản dịch:|Translation:)\s*/i, '');
        // Loại bỏ xuống dòng thừa
        translated = translated.trim();
        
        return translated;
        
    } catch (error) {
        console.error('Translation error:', error);
        return `[Lỗi dịch: ${error.message}]`;
    }
}

function createRecognition(lang, onResult) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        addBotMessage('⚠️ Trình duyệt không hỗ trợ nhận diện giọng nói.');
        return null;
    }
    
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Sửa thành false để dễ kiểm soát
    recognition.interimResults = false;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;
    
    let timeoutId = null;
    
    recognition.onstart = () => {
        console.log('🎤 Bắt đầu nghe...');
        timeoutId = setTimeout(() => {
            try {
                recognition.stop();
                console.log('⏰ Timeout - dừng nghe');
                addBotMessage('⏰ Không nghe thấy giọng nói. Thử lại nhé!');
            } catch(e) {}
        }, 15000);
    };
    
    recognition.onresult = (event) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
            onResult(finalTranscript.trim());
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        
        if (event.error === 'network') {
            addBotMessage('⚠️ Lỗi kết nối mạng. Kiểm tra internet và thử lại.');
        } else if (event.error === 'not-allowed') {
            addBotMessage('⚠️ Cần cấp quyền truy cập micro.');
        } else if (event.error === 'no-speech') {
            // Không thông báo lỗi này
        } else {
            addBotMessage(`❌ Lỗi nhận diện: ${event.error}`);
        }
    };
    
    recognition.onend = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        document.querySelectorAll('.recording').forEach(el => {
            el.classList.remove('recording');
        });
    };
    
    return recognition;
}

// ========== DỊCH THUẬT - CHỈ ĐỌC BẢN DỊCH ==========

async function translateAndSpeak(text, sourceLang, targetLang) {
    try {
        // Bắt đầu dịch
        addBotMessage(`🔄 Đang dịch...`);
        const translated = await translateText(text, sourceLang, targetLang);
        
        // ✅ HIỂN THỊ: hiển thị cả gốc và dịch
        const displayText = `🎤 "${text}"\n📝 ${translated}`;
        addBotMessage(displayText);
        
        // ✅ ĐỌC: CHỈ đọc bản dịch, không đọc gốc
        await speakText(translated);
        
    } catch (error) {
        console.error('Translate error:', error);
        addBotMessage(`❌ Lỗi dịch: ${error.message}`);
    }
}

// NÚT 1: ANH → VIỆT
if (translateEnToViBtn) {
    let currentRecognition = null;
    let isRecordingActive = false;
    
    translateEnToViBtn.addEventListener('click', async () => {
        if (isRecordingActive) {
            translateEnToViBtn.classList.remove('recording');
            if (currentRecognition) {
                try {
                    currentRecognition.stop();
                } catch(e) {}
                currentRecognition = null;
            }
            isRecordingActive = false;
            
            return;
        }
        
        // Kiểm tra quyền micro
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
        } catch(err) {
            addBotMessage('⚠️ Không thể truy cập micro. Vui lòng cấp quyền và thử lại.');
            return;
        }
        
        translateEnToViBtn.classList.add('recording');
        
        currentRecognition = createRecognition('en-US', async (spokenText) => {
            addBotMessage(`🎤 : "${spokenText}"`);
            await translateAndSpeak(spokenText, 'Anh', 'Việt');
            if (currentRecognition) {
                try {
                    currentRecognition.stop();
                } catch(e) {}
                currentRecognition = null;
            }
            translateEnToViBtn.classList.remove('recording');
            isRecordingActive = false;
        });
        
        if (currentRecognition) {
            try {
                currentRecognition.start();
                isRecordingActive = true;
                addBotMessage('🎤 Đang nghe tiếng Anh... Nói vào micro nhé!');
            } catch(err) {
                addBotMessage('❌ Không thể khởi động micro. Vui lòng thử lại.');
                translateEnToViBtn.classList.remove('recording');
            }
        }
    });
}

// NÚT 2: VIỆT → ANH
if (translateViToEnBtn) {
    let currentRecognition = null;
    let isRecordingActive = false;
    
    translateViToEnBtn.addEventListener('click', async () => {
        if (isRecordingActive) {
            translateViToEnBtn.classList.remove('recording');
            if (currentRecognition) {
                try {
                    currentRecognition.stop();
                } catch(e) {}
                currentRecognition = null;
            }
            isRecordingActive = false;
            
            return;
        }
        
        // Kiểm tra quyền micro
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
        } catch(err) {
            addBotMessage('⚠️ Không thể truy cập micro. Vui lòng cấp quyền và thử lại.');
            return;
        }
        
        translateViToEnBtn.classList.add('recording');
        
        currentRecognition = createRecognition('vi-VN', async (spokenText) => {
            addBotMessage(`🎤 : "${spokenText}"`);
            await translateAndSpeak(spokenText, 'Việt', 'Anh');
            if (currentRecognition) {
                try {
                    currentRecognition.stop();
                } catch(e) {}
                currentRecognition = null;
            }
            translateViToEnBtn.classList.remove('recording');
            isRecordingActive = false;
        });
        
        if (currentRecognition) {
            try {
                currentRecognition.start();
                isRecordingActive = true;
                addBotMessage('🎤 Đang nghe tiếng Việt... Nói vào micro nhé!');
            } catch(err) {
                addBotMessage('❌ Không thể khởi động micro. Vui lòng thử lại.');
                translateViToEnBtn.classList.remove('recording');
            }
        }
    });
}

// ========== LOADING TRÊN ROBOT ==========
let loadingOverlay = null;

function showLoadingOnRobot() {
    const lottieContainer = document.querySelector('.lottie-container');
    if (!lottieContainer || loadingOverlay) return;
    
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'robot-loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="robot-loading-spinner"></div>
        <div class="robot-loading-text">🤖 Đang suy nghĩ... 🤖</div>
    `;
    loadingOverlay.style.position = 'absolute';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
    loadingOverlay.style.borderRadius = '50%';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.flexDirection = 'column';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.zIndex = '20';
    loadingOverlay.style.backdropFilter = 'blur(4px)';
    
    lottieContainer.style.position = 'relative';
    lottieContainer.appendChild(loadingOverlay);
}

function hideLoadingOnRobot() {
    if (loadingOverlay) {
        loadingOverlay.remove();
        loadingOverlay = null;
    }
}

console.log("🚀 Robot AI đã sẵn sàng!");
console.log("📊 Model:", MODEL);
console.log("💬 Chat bot đã khởi động!");