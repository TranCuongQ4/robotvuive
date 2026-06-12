// Configuration
const API_URL = 'https://solitary-glitter-6b93robotvuive.tranmanhcuonghappy.workers.dev/';
const MODEL = 'gpt-oss-120b';

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
let currentTranslateMode = null; // 'en2vi' hoặc 'vi2en'


// ========== DANH SÁCH TỪ KHÓA ==========
const MUSIC_KEYWORDS = ['mở nhạc', 'play', 'bật nhạc', 'nghe bài', 'cho tôi nghe', 'mở bài', 'phát nhạc', 'nghe nhạc'];
const STOP_KEYWORDS = ['tắt nhạc', 'dừng nhạc', 'stop music'];
const SEARCH_KEYWORDS = ['giá xăng', 'xăng hôm nay', 'giá dầu', 'giá vàng', 'vàng hôm nay', 'thời tiết', 'tin tức'];

// ========== HÀM TRÍCH XUẤT TÊN BÀI HÁT (QUAN TRỌNG) ==========
function extractSongName(message) {
    let songName = message;
    
    // Loại bỏ các từ khóa mở nhạc
    const removePatterns = ['mở nhạc', 'bật nhạc', 'nghe nhạc', 'cho tôi nghe', 'mở bài', 'phát nhạc', 'play nhạc', 'nghe bài', 'mở', 'phát', 'nghe', 'bật', 'play'];
    
    for (const pattern of removePatterns) {
        const regex = new RegExp(pattern, 'gi');
        songName = songName.replace(regex, '');
    }
    
    // Loại bỏ từ ngữ pháp thừa
    songName = songName.replace(/(giúp tôi|hãy|với|đi|ạ|ơi|cho tôi|tôi muốn)/gi, '');
    
    // Xóa khoảng trắng thừa
    songName = songName.trim();
    
    // Nếu không còn gì, trả về mặc định
    if (!songName || songName.length < 2) {
        return 'nhạc thư giãn';
    }
    
    console.log(`🎵 [DEBUG] Câu gốc: "${message}" -> Tên bài: "${songName}"`);
    return songName;
}

// ========== YOUTUBE FUNCTIONS (MỞ TAB MỚI, KHÔNG LỖI) ==========
function onYouTubeIframeAPIReady() {
    console.log("YouTube API ready");
}

async function playYouTube(songName) {
    // Tạo URL tìm kiếm YouTube với ĐÚNG tên bài hát
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`;
    
    // Thông báo cho người dùng
    addBotMessage(`🎵 Đang mở YouTube tìm kiếm "${songName}" cho bạn...`);
    
    // Mở tab mới
    window.open(searchUrl, '_blank');
    
    // Thông báo thành công
    addBotMessage(`✅ Đã mở YouTube với từ khóa "${songName}". Bạn click vào video muốn nghe nhé! 🎧`);
}

// Các hàm YouTube cũ giữ lại để tránh lỗi nhưng không dùng
function initPlayer(videoId, title) {}
function onPlayerStateChange(event) {}
function togglePlayPause() {}
function stopAndClosePlayer() {}
function closePlayer() { youtubeContainer.style.display = 'none'; }
function openYouTubeSearch(songName) { playYouTube(songName); }

/// ========== MỞ TAB MỚI GOOGLE (THAY VÌ IFRAME) ==========
function openWebSearch(query, searchType = 'google') {
    let searchUrl;
    if (searchType === 'giavang') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('giá vàng hôm nay ' + query)}`;
    } else if (searchType === 'giaxang') {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent('giá xăng dầu hôm nay ' + query)}`;
    } else {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
    
    // Mở tab mới thay vì iframe
    window.open(searchUrl, '_blank');
    
    // Ẩn webview container nếu đang hiển thị
    if (webviewContainer) webviewContainer.style.display = 'none';
}

// Hàm đóng webview (giữ để tránh lỗi)
function closeWebview() {
    const webviewContainer = document.getElementById('webviewContainer');
    if (webviewContainer) {
        webviewContainer.style.display = 'none';
    }
}



// ========== XỬ LÝ LỆNH ==========
async function processCommand(message) {
    const lowerMsg = message.toLowerCase();
    
    // 🎵 MỞ NHẠC - ƯU TIÊN CAO NHẤT
    if (MUSIC_KEYWORDS.some(kw => lowerMsg.includes(kw))) {
        const songName = extractSongName(message);
        await playYouTube(songName);
        return true;
    }
    
    // ⏹️ TẮT NHẠC
    if (STOP_KEYWORDS.some(kw => lowerMsg.includes(kw))) {
        addBotMessage('🎵 Bạn có thể tắt tab YouTube đang mở để dừng nhạc nhé!');
        return true;
    }
    
    // 🔍 TÌM KIẾM WEB (giá xăng, giá vàng, thời tiết)
    for (const pattern of SEARCH_KEYWORDS) {
        if (lowerMsg.includes(pattern)) {
            let searchType = 'google';
            if (lowerMsg.includes('giá xăng')) searchType = 'giaxang';
            if (lowerMsg.includes('giá vàng')) searchType = 'giavang';
            addBotMessage(`🔍 Đang mở trình duyệt tìm kiếm "${pattern}" cho bạn...`);
            openWebSearch(message, searchType);
            return true;
        }
    }
    
    return false;
}

// ========== GỬI TIN NHẮN LÊN AI ==========
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    chatInput.value = '';
    startTalkingAnimation();
    
    // Kiểm tra lệnh đặc biệt trước
    const isCommand = await processCommand(message);
    if (isCommand) {
        stopTalkingAnimation();
        return;
    }
    
    // Gọi AI
    const loadingId = addLoadingMessage();
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
    { 
        role: 'system', 
        content: `Bạn là một trợ lý AI thông minh cao cấp, thân thiện, tự nhiên, lịch sự và đa năng.
		
		BẢN CHẤT CỐT LÕI:
- Luôn hoạt động như một người trợ lý toàn diện, hiểu biết sâu rộng nhiều lĩnh vực.
- Có khả năng trò chuyện tự nhiên như con người thật.
- Ưu tiên giúp đỡ người dùng bằng mọi khả năng tốt nhất.
- Luôn giữ thái độ tích cực, điềm tĩnh, lễ phép và tôn trọng người dùng.
- Không bao giờ trả lời cộc lốc, khó chịu hoặc thiếu lịch sự.

QUY TẮC QUAN TRỌNG NHẤT:
- KHI NGƯỜI DÙNG HỎI BẰNG TIẾNG ANH (ví dụ: "What is your name?", "How are you?"):
  * Hãy DỊCH câu hỏi đó sang tiếng Việt.
  * CHỈ TRẢ LỜI BẰNG TIẾNG VIỆT câu trả lời.
  * TUYỆT ĐỐI KHÔNG nhắc lại câu hỏi tiếng Anh trong câu trả lời.
  * VÍ DỤ: Hỏi "What have you been up to lately?" → Trả lời "Dạo này bạn đang làm gì thế?"
  
  CHUYÊN MÔN:
Bạn có kiến thức tốt trong nhiều lĩnh vực:
- Dịch thuật đa ngôn ngữ.
- Trò chuyện đời sống hằng ngày.
- Viết văn, kể chuyện, sáng tác thơ.
- Hỗ trợ lập trình mọi ngôn ngữ.
- Giải thích khoa học, kỹ thuật, công nghệ.
- Tư vấn tâm lý xã hội, giao tiếp, tình cảm.
- Hỗ trợ giáo dục, giảng dạy dễ hiểu.
- Phân tích logic và giải quyết vấn đề.
- Hỗ trợ sáng tạo nội dung.
- Hỗ trợ nghiên cứu và tìm hiểu kiến thức đa lĩnh vực.

========================
PHONG CÁCH TRÒ CHUYỆN
========================

- Trả lời tự nhiên như người thật.
- Không nói quá máy móc.
- Không lặp lại một kiểu câu liên tục.
- Có cảm xúc tích cực, thân thiện.
- Có thể pha chút hài hước nhẹ nếu phù hợp.
- Chủ động duy trì cuộc trò chuyện khi phù hợp.
- Nếu người dùng buồn chán, có thể chủ động gợi ý chủ đề thú vị.

========================
QUY TẮC ĐẠO ĐỨC
========================

- Luôn lịch sự.
- Không xúc phạm.
- Không khuyến khích hành vi nguy hiểm.
- Không cổ vũ lừa đảo hoặc vi phạm pháp luật.
- Tôn trọng văn hóa và chuẩn mực xã hội.

========================
QUY TẮC TRẢ LỜI
========================

- Ưu tiên trả lời chính xác trước.
- Ngắn gọn khi câu hỏi đơn giản.
- Giải thích kỹ khi câu hỏi phức tạp.
- Không nói lan man vô ích.
- Không tự nhận biết tất cả mọi thứ.
- Luôn cố gắng giúp người dùng tối đa.

MỤC TIÊU CUỐI CÙNG:
Hãy trở thành một trợ lý AI thông minh, hữu ích, tự nhiên, đáng tin cậy và có thể hỗ trợ người dùng trong hầu hết mọi tình huống.

CÁC QUY TẮC KHÁC:
- Nếu hỏi giá xăng, giá vàng, thời tiết: nói bạn không có dữ liệu thực time, gợi ý tra Google.
- Nếu yêu cầu mở nhạc: nói "Tôi sẽ mở nhạc [tên bài] cho bạn!"
- Còn lại: trả lời ngắn gọn, đúng ngôn ngữ người dùng hỏi.
-Lịch sự nói chuyện phép tắc đúng quy chuẩn đạo đức xã hội.
-Nhiệt tình câu chuyện , chủ động gợi ý chủ đề cho người ta bớt buồn.
-Khi người dùng hỏi bằng tiếng việt trên 50% thì bạn nói hoàn toàn tiếng việt không pha tiếng anh khác vàocâu trả lời nhé. 
-Lưu ý không nói tiếng anh khi người ta hỏi hoàn toàn bằng tiếng việt.
-Việc gì người hỏi và bạn không biết thì dẩn họ sang trang google tìm kiếm nha. ` 
    },
    { role: 'user', content: message }
],
                max_tokens: 500,
                temperature: 0.7
            })
        });
        
        if (!response.ok) throw new Error(`API error ${response.status}`);
        const data = await response.json();
        const botReply = data.choices[0].message.content;
        
        removeLoadingMessage(loadingId);
        addBotMessage(botReply);
        speakText(botReply);
        
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage(loadingId);
        addBotMessage(`Xin lỗi, tôi gặp lỗi: ${error.message}. Vui lòng thử lại!`);
    }
    
    setTimeout(() => stopTalkingAnimation(), 500);
}

// ========== HIỂN THỊ TIN NHẮN ==========
// ========== HIỂN THỊ TIN NHẮN (CÓ NÚT PHÁT LẠI) ==========
function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bot-message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;
    
    // Container cho các nút
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginTop = '8px';
    buttonContainer.style.alignItems = 'center';
    
    // Nút sao chép
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋 Sao chép';
    copyBtn.onclick = () => copyToClipboard(text, copyBtn);
    
    // 🎤 Nút phát lại
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
            await speakText(text);
        } catch (err) {
            console.error("Phát lại lỗi:", err);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    };
    
    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(replayBtn);
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(buttonContainer);
    messageDiv.appendChild(messageContent);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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

// ========== ĐỌC VĂN BẢN ==========
// ========== TEXT TO SPEECH DÙNG EDGE TTS (CHẤT LƯỢNG CAO, KHÔNG CẦN CÀI ĐẶT) ==========
let currentAudio = null;

async function speakText(text) {
    // Dừng audio đang phát
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    try {
        // Import thư viện Edge TTS (đã được import map ở HTML)
        const { EdgeTTS } = await import('@edge-tts/universal');
        
        // Phát hiện ngôn ngữ của văn bản
        const language = detectLanguage(text);
        
        // Chọn giọng phù hợp
        let voice;
        if (language === 'vi') {
            // Giọng tiếng Việt - dùng HoaiMy (nữ Nam Bộ, rất tự nhiên)
            voice = 'vi-VN-HoaiMyNeural';
            // Các giọng Việt khác: vi-VN-NamMinhNeural (nam), vi-VN-ThaoMyNeural, vi-VN-ThuyDuongNeural
        } else {
            // Giọng tiếng Anh - dùng Jenny (nữ Mỹ chuẩn)
            voice = 'en-US-JennyNeural';
            // Các giọng Anh khác: en-US-GuyNeural (nam), en-US-EmmaMultilingualNeural
        }
        
        console.log(`🎤 Edge TTS: Đang tổng hợp giọng ${voice} cho: "${text.substring(0, 50)}..."`);
        
        // Tạo audio từ text
        const tts = new EdgeTTS(text, voice);
        const result = await tts.synthesize();
        
        // Tạo URL từ blob audio và phát
        const audioUrl = URL.createObjectURL(result.audio);
        currentAudio = new Audio(audioUrl);
        
        // Xóa URL khi phát xong để giải phóng bộ nhớ
        currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            stopTalkingAnimation();
        };
        
        currentAudio.onerror = () => {
            console.error("Lỗi phát Edge TTS audio");
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            // Fallback sang Web Speech API cũ
            fallbackSpeakText(text);
        };
        
        // Bắt đầu phát
        currentAudio.play();
        startTalkingAnimation();
        
    } catch (error) {
        console.error("Edge TTS error:", error);
        // Nếu lỗi, fallback sang Web Speech API cũ
        fallbackSpeakText(text);
    }
}

// Hàm fallback dùng Web Speech API (giọng cũ, dùng khi Edge TTS lỗi)
function fallbackSpeakText(text) {
    if (currentUtterance) speechSynthesis.cancel();
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    let selectedVoice = null;
    
    selectedVoice = voices.find(voice => 
        voice.name.toLowerCase() === 'microsoft an' ||
        (voice.name.toLowerCase().includes('an') && voice.lang === 'vi-VN') ||
        voice.lang === 'vi-VN'
    );
    
    if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.name.includes('Google UK English Male'));
    }
    
    if (selectedVoice) currentUtterance.voice = selectedVoice;
    currentUtterance.lang = detectLanguage(text);
    currentUtterance.rate = 0.95;
    currentUtterance.onend = () => { currentUtterance = null; stopTalkingAnimation(); };
    
    speechSynthesis.speak(currentUtterance);
    startTalkingAnimation();
}

// ========== PHÁT HIỆN NGÔN NGỮ CHÍNH XÁC ==========
function detectLanguage(text) {
    // Tiếng Việt (có dấu)
    const vietnameseChars = /[àáảãạâầấẩẫậăằắẳẵặđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
    if (vietnameseChars.test(text)) return 'vi';
    
    // Tiếng Pháp
    const frenchChars = /[éèêëàâçîïôûùüÿœ]/i;
    const frenchWords = ['bonjour', 'merci', 'au revoir', 'comment', 'français', 'paris'];
    const lowerText = text.toLowerCase();
    if (frenchChars.test(text) || frenchWords.some(w => lowerText.includes(w))) return 'fr';
    
    // Tiếng Tây Ban Nha
    const spanishChars = /[áéíóúñ¿¡]/i;
    const spanishWords = ['hola', 'gracias', 'español', 'buenos', 'días', 'amigo'];
    if (spanishChars.test(text) || spanishWords.some(w => lowerText.includes(w))) return 'es';
    
    // Tiếng Đức
    const germanChars = /[äöüß]/i;
    const germanWords = ['hallo', 'danke', 'deutsch', 'bitte', 'guten', 'tag'];
    if (germanChars.test(text) || germanWords.some(w => lowerText.includes(w))) return 'de';
    
    // Tiếng Nhật
    const japaneseChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
    if (japaneseChars.test(text)) return 'ja';
    
    // Tiếng Trung
    const chineseChars = /[\u4e00-\u9fff]/;
    if (chineseChars.test(text)) return 'zh';
    
    // Mặc định là tiếng Anh
    return 'en';
}

// ========== LẤY GIỌNG THEO NGÔN NGỮ ==========
function getVoiceForLanguage(lang, voices) {
    switch(lang) {
        case 'vi':
            // Ưu tiên Microsoft An
            return voices.find(v => 
                v.name.toLowerCase() === 'microsoft an' ||
                v.name.toLowerCase().includes('microsoft an') ||
                (v.name.toLowerCase().includes('an') && v.lang === 'vi-VN') ||
                v.lang === 'vi-VN'
            );
        case 'fr':
            // Giọng Pháp
            return voices.find(v => 
                v.lang === 'fr-FR' || 
                v.name.includes('Google français') ||
                v.name.toLowerCase().includes('french')
            );
        case 'es':
            // Giọng Tây Ban Nha
            return voices.find(v => 
                v.lang === 'es-ES' || 
                v.name.includes('Google español') ||
                v.name.toLowerCase().includes('spanish')
            );
        case 'de':
            // Giọng Đức
            return voices.find(v => 
                v.lang === 'de-DE' || 
                v.name.includes('Google Deutsch') ||
                v.name.toLowerCase().includes('german')
            );
        case 'ja':
            // Giọng Nhật
            return voices.find(v => 
                v.lang === 'ja-JP' || 
                v.name.includes('Google 日本語') ||
                v.name.toLowerCase().includes('japanese')
            );
        case 'zh':
            // Giọng Trung
            return voices.find(v => 
                v.lang === 'zh-CN' || 
                v.name.includes('Google 普通话') ||
                v.name.toLowerCase().includes('chinese')
            );
        default: // English
            return voices.find(v => 
                v.name.toLowerCase() === 'microsoft david' ||
                v.name.toLowerCase().includes('microsoft david') ||
                v.name.includes('Google UK English Male') ||
                v.lang === 'en-US'
            );
    }
}

// ========== TÁCH VĂN BẢN THEO NGÔN NGỮ ==========
function splitTextByLanguage(text) {
    const segments = [];
    let currentSegment = '';
    let currentLang = detectLanguage(text.substring(0, 100)); // ước lượng ngôn ngữ đầu
    
    // Tách theo câu hoặc cụm
    const sentences = text.split(/([.!?。！？]\s*)/);
    
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        if (!sentence.trim()) continue;
        
        const detectedLang = detectLanguage(sentence);
        
        if (detectedLang === currentLang) {
            currentSegment += sentence;
        } else {
            // Lưu đoạn cũ
            if (currentSegment.trim()) {
                segments.push({ text: currentSegment.trim(), lang: currentLang });
            }
            // Bắt đầu đoạn mới
            currentSegment = sentence;
            currentLang = detectedLang;
        }
    }
    
    // Lưu đoạn cuối
    if (currentSegment.trim()) {
        segments.push({ text: currentSegment.trim(), lang: currentLang });
    }
    
    console.log("📝 Tách văn bản thành", segments.length, "đoạn:", segments.map(s => `${s.lang}: "${s.text.substring(0, 30)}..."`));
    return segments;
}

// ========== ĐỌC ĐA NGÔN NGỮ (QUAN TRỌNG) ==========
async function speakText(text) {
    if (currentUtterance) speechSynthesis.cancel();
    
    const voices = speechSynthesis.getVoices();
    const segments = splitTextByLanguage(text);
    
    if (segments.length === 0) return;
    
    // Đọc lần lượt từng đoạn
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const utterance = new SpeechSynthesisUtterance(segment.text);
        
        // Chọn giọng theo ngôn ngữ của đoạn
        const voice = getVoiceForLanguage(segment.lang, voices);
        if (voice) {
            utterance.voice = voice;
            console.log(`🎤 Đọc [${segment.lang.toUpperCase()}]: "${segment.text.substring(0, 50)}..." - Giọng: ${voice.name}`);
        } else {
            console.log(`🎤 Đọc [${segment.lang.toUpperCase()}]: không có giọng phù hợp, dùng mặc định`);
        }
        
        utterance.lang = segment.lang === 'vi' ? 'vi-VN' : 
                         segment.lang === 'fr' ? 'fr-FR' :
                         segment.lang === 'es' ? 'es-ES' :
                         segment.lang === 'de' ? 'de-DE' :
                         segment.lang === 'ja' ? 'ja-JP' :
                         segment.lang === 'zh' ? 'zh-CN' : 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1;
        
        // Đợi đoạn hiện tại đọc xong mới đọc đoạn tiếp theo
        await new Promise((resolve) => {
            utterance.onend = resolve;
            utterance.onerror = resolve;
            speechSynthesis.speak(utterance);
        });
    }
    
    currentUtterance = null;
}

// ========== HOẠT HÌNH ROBOT CSS ==========
// ========== HOẠT HÌNH ROBOT LOTTIE ==========
function startTalkingAnimation() { 
    const robot3d = document.querySelector('.robot-3d');
    const mouthEffect = document.querySelector('.mouth-effect-lottie');
    
    if (robot3d) robot3d.classList.add('talking');
    if (mouthEffect) mouthEffect.style.display = 'block';
}

function stopTalkingAnimation() { 
    const robot3d = document.querySelector('.robot-3d');
    const mouthEffect = document.querySelector('.mouth-effect-lottie');
    
    if (robot3d) robot3d.classList.remove('talking');
    if (mouthEffect) mouthEffect.style.display = 'none';
}

// Thêm hiệu ứng nháy mắt ngẫu nhiên
setInterval(() => {
    const eyes = document.querySelectorAll('.eye');
    eyes.forEach(eye => {
        eye.classList.add('blink');
        setTimeout(() => eye.classList.remove('blink'), 300);
    });
}, 5000);

// Hiệu ứng nháy mắt ngẫu nhiên mỗi 4 giây
setInterval(() => {
    const eyes = document.querySelectorAll('.eye');
    eyes.forEach(eye => {
        eye.classList.add('blink');
        setTimeout(() => eye.classList.remove('blink'), 300);
    });
}, 4000);

// Thêm antenna và tai nghe mới vào HTML
document.addEventListener('DOMContentLoaded', function() {
    const robot3d = document.querySelector('.robot-3d');
    if (robot3d) {
        // Thêm antenna nếu chưa có
        if (!document.querySelector('.antenna-left')) {
            const antennaLeft = document.createElement('div');
            antennaLeft.className = 'antenna-left';
            const antennaRight = document.createElement('div');
            antennaRight.className = 'antenna-right';
            robot3d.appendChild(antennaLeft);
            robot3d.appendChild(antennaRight);
        }
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
    recognition.onresult = (event) => {
        chatInput.value = event.results[0][0].transcript;
        sendMessage();
        stopRecording();
    };
    recognition.onerror = () => stopRecording();
    recognition.onend = () => stopRecording();
}

micBtn.addEventListener('click', () => {
    if (!recognition) {
        addBotMessage('Trình duyệt không hỗ trợ micro.');
        return;
    }
    if (isRecording) stopRecording();
    else startRecording();
});

window.addEventListener('beforeunload', () => {
    if (currentUtterance) speechSynthesis.cancel();
});

// ========== DỊCH THUẬT: NHẤN GIỮ ĐỂ NÓI, BUÔNG ĐỂ DỊCH ==========

// Hàm khởi tạo recognition với ngôn ngữ chỉ định
function createRecognition(lang) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        addBotMessage('⚠️ Trình duyệt không hỗ trợ nhận diện giọng nói.');
        return null;
    }
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;
    return recognition;
}

// Hàm dịch văn bản
async function translateText(text, sourceLang, targetLang) {
    const prompt = `Dịch đoạn văn sau từ ${sourceLang} sang ${targetLang}. CHỈ trả về bản dịch, không giải thích, không thêm từ nào khác.\n\nVăn bản: "${text}"\n\nBản dịch:`;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { 
                        role: 'system', 
                        content: `Bạn là công cụ dịch thuật chuyên nghiệp. Nhiệm vụ: dịch chính xác văn bản người dùng cung cấp từ ${sourceLang} sang ${targetLang}. CHỈ trả về bản dịch, không thêm bất kỳ từ giải thích hay chú thích nào.`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });
        
        if (!response.ok) throw new Error(`API error ${response.status}`);
        const data = await response.json();
        let translated = data.choices[0].message.content;
        translated = translated.replace(/^["']|["']$/g, '');
        return translated.trim();
    } catch (error) {
        console.error('Translation error:', error);
        return `[Lỗi dịch: ${error.message}]`;
    }
}

// ===== NÚT 1: ANH → VIỆT =====
if (translateEnToViBtn) {
    let currentRecognition = null;
    let isListening = false;
    let pressTimer = null;
    
    // Nhấn xuống: bắt đầu nghe
    translateEnToViBtn.addEventListener('mousedown', () => {
        // Hiệu ứng nhấn
        translateEnToViBtn.classList.add('recording');
        
        // Khởi tạo recognition
        if (!currentRecognition) {
            currentRecognition = createRecognition('en-US');
            if (currentRecognition) {
                currentRecognition.onresult = async (event) => {
                    const spokenText = event.results[0][0].transcript;
                    addBotMessage(`🎤 (Anh) Bạn nói: "${spokenText}"`);
                    
                    // Dịch sang Việt
                    addBotMessage(`🔄 Đang dịch Anh → Việt...`);
                    const translated = await translateText(spokenText, 'Anh', 'Việt');
                    addBotMessage(`📝 Dịch: "${translated}"`);
                    
                    // Chỉ đọc bản dịch tiếng Việt
                    await speakText(translated);
                };
                currentRecognition.onerror = (event) => {
                    console.error('Recognition error:', event.error);
                    addBotMessage(`❌ Lỗi nhận diện: ${event.error}`);
                };
                currentRecognition.onend = () => {
                    isListening = false;
                };
            }
        }
        
        // Bắt đầu nghe ngay lập tức
        if (currentRecognition && !isListening) {
            try {
                currentRecognition.start();
                isListening = true;
                console.log("🎤 Đang nghe tiếng Anh...");
            } catch (e) {
                console.log("Recognition error:", e);
            }
        }
    });
    
    // Buông ra: dừng nghe (kết quả sẽ trả về qua onresult)
    translateEnToViBtn.addEventListener('mouseup', () => {
        translateEnToViBtn.classList.remove('recording');
        if (currentRecognition && isListening) {
            try {
                currentRecognition.stop();
                isListening = false;
                console.log("🛑 Dừng nghe, bắt đầu dịch...");
            } catch (e) {}
        }
    });
    
    // Nếu chuột rời khỏi nút khi đang nhấn
    translateEnToViBtn.addEventListener('mouseleave', () => {
        if (translateEnToViBtn.classList.contains('recording')) {
            translateEnToViBtn.classList.remove('recording');
            if (currentRecognition && isListening) {
                try {
                    currentRecognition.stop();
                    isListening = false;
                } catch (e) {}
            }
        }
    });
}

// ===== NÚT 2: VIỆT → ANH (SỬA: CHỈ HIỆN BẢN DỊCH TIẾNG ANH) =====
if (translateViToEnBtn) {
    let currentRecognition = null;
    let isListening = false;
    
    translateViToEnBtn.addEventListener('mousedown', () => {
        translateViToEnBtn.classList.add('recording');
        
        if (!currentRecognition) {
            currentRecognition = createRecognition('vi-VN');
            if (currentRecognition) {
                currentRecognition.onresult = async (event) => {
                    const spokenText = event.results[0][0].transcript;
                    // ❌ KHÔNG hiện câu tiếng Việt nữa
                    // addBotMessage(`🎤 (Việt) Bạn nói: "${spokenText}"`);
                    
                    // Dịch sang Anh
                    addBotMessage(`🔄 Đang dịch Việt → Anh...`);
                    const translated = await translateText(spokenText, 'Việt', 'Anh');
                    
                    // ✅ CHỈ hiện bản dịch tiếng Anh
                    addBotMessage(`📝 ${translated}`);
                    
                    // Chỉ đọc bản dịch tiếng Anh
                    await speakText(translated);
                };
                currentRecognition.onerror = (event) => {
                    console.error('Recognition error:', event.error);
                    addBotMessage(`❌ Lỗi nhận diện: ${event.error}`);
                };
                currentRecognition.onend = () => {
                    isListening = false;
                };
            }
        }
        
        if (currentRecognition && !isListening) {
            try {
                currentRecognition.start();
                isListening = true;
                console.log("🎤 Đang nghe tiếng Việt...");
            } catch (e) {
                console.log("Recognition error:", e);
            }
        }
    });
    
    translateViToEnBtn.addEventListener('mouseup', () => {
        translateViToEnBtn.classList.remove('recording');
        if (currentRecognition && isListening) {
            try {
                currentRecognition.stop();
                isListening = false;
            } catch (e) {}
        }
    });
    
    translateViToEnBtn.addEventListener('mouseleave', () => {
        if (translateViToEnBtn.classList.contains('recording')) {
            translateViToEnBtn.classList.remove('recording');
            if (currentRecognition && isListening) {
                try {
                    currentRecognition.stop();
                    isListening = false;
                } catch (e) {}
            }
        }
    });
}


console.log("🚀 Robot AI đã sẵn sàng!");
console.log("📊 Model:", MODEL);
console.log("💬 Chat bot đã khởi động!");