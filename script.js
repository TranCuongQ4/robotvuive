// Configuration
const API_URL = 'https://solitary-glitter-6b93robotvuive.tranmanhcuonghappy.workers.dev';
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
let currentTranslateMode = null;

// Biến cho audio và trạng thái nói
let currentAudio = null;
let isSpeaking = false;

// ========== DANH SÁCH TỪ KHÓA ==========
const MUSIC_KEYWORDS = ['mở nhạc', 'play', 'bật nhạc', 'nghe bài', 'cho tôi nghe', 'mở bài', 'phát nhạc', 'nghe nhạc'];
const STOP_KEYWORDS = ['tắt nhạc', 'dừng nhạc', 'stop music'];
const SEARCH_KEYWORDS = ['giá xăng', 'xăng hôm nay', 'giá dầu', 'giá vàng', 'vàng hôm nay', 'thời tiết', 'tin tức'];

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

// ========== XỬ LÝ LỆNH ==========
async function processCommand(message) {
    const lowerMsg = message.toLowerCase();
    
    if (MUSIC_KEYWORDS.some(kw => lowerMsg.includes(kw))) {
        const songName = extractSongName(message);
        await playYouTube(songName);
        return true;
    }
    
    if (STOP_KEYWORDS.some(kw => lowerMsg.includes(kw))) {
        addBotMessage('🎵 Bạn có thể tắt tab YouTube đang mở để dừng nhạc nhé!');
        return true;
    }
    
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

// ========== GỬI TIN NHẮN LÊN WORKER ==========
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    chatInput.value = '';
    startTalkingAnimation();
    
    const isCommand = await processCommand(message);
    if (isCommand) {
        stopTalkingAnimation();
        return;
    }
    
    showLoadingOnRobot();
    const loadingId = addLoadingMessage();
    
    try {
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
                        content: `Bạn là một trợ lý AI thông minh cao cấp, thân thiện, tự nhiên, lịch sự và đa năng.
                        
                        BẢN CHẤT CỐT LÕI:
                        - Luôn hoạt động như một người trợ lý toàn diện, hiểu biết sâu rộng nhiều lĩnh vực.
                        - Có khả năng trò chuyện tự nhiên như con người thật.
                        - Ưu tiên giúp đỡ người dùng bằng mọi khả năng tốt nhất.
                        - Luôn giữ thái độ tích cực, điềm tĩnh, lễ phép và tôn trọng người dùng.
                        
                        QUY TẮC QUAN TRỌNG NHẤT:
                        - Khi người dùng hỏi bằng tiếng Anh: Hãy dịch câu hỏi đó sang tiếng Việt. Chỉ trả lời bằng tiếng Việt.
                        - Tuyệt đối không nhắc lại câu hỏi tiếng Anh trong câu trả lời.
                        
                        CÁC QUY TẮC KHÁC:
                        - Nếu hỏi giá xăng, giá vàng, thời tiết: nói bạn không có dữ liệu thực time, gợi ý tra Google.
                        - Nếu yêu cầu mở nhạc: nói "Tôi sẽ mở nhạc [tên bài] cho bạn!"
                        - Khi người dùng hỏi bằng tiếng việt trên 50% thì bạn nói hoàn toàn tiếng việt không pha tiếng anh.` 
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
    } finally {
        hideLoadingOnRobot();
    }
    
    setTimeout(() => stopTalkingAnimation(), 500);
}

// ========== HIỂN THỊ TIN NHẮN ==========
function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bot-message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;
    
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
            await speakText(text);
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

// ========== TEXT TO SPEECH VỚI FALLBACK ==========

async function speakText(text) {
    // Dừng audio đang phát
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    isSpeaking = true;
    startTalkingAnimation();
    
    // Làm sạch text (loại bỏ icon, khoảng trắng thừa)
    let cleanText = text;
    cleanText = cleanText.replace(/^[📝✅🔄🎤]\s*/, '');
    cleanText = cleanText.replace(/^["']|["']$/g, '');
    cleanText = cleanText.trim();
    
    if (!cleanText) {
        stopTalkingAnimation();
        return;
    }
    
    // Thử dùng Web Speech API trước (ổn định hơn)
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
        let voice = language === 'vi' ? 'vi-VN-HoaiMyNeural' : 'en-US-JennyNeural';
        
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

// Hàm fallback dùng Web Speech API (giọng có sẵn trên máy)
function webSpeechFallback(text) {
    if (currentUtterance) {
        speechSynthesis.cancel();
    }
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    let selectedVoice = null;
    
    // Ưu tiên giọng Microsoft An (tiếng Việt)
    selectedVoice = voices.find(voice => 
        voice.name.toLowerCase() === 'microsoft an' ||
        (voice.name.toLowerCase().includes('an') && voice.lang === 'vi-VN') ||
        voice.lang === 'vi-VN'
    );
    
    // Nếu không có giọng Việt, dùng giọng Anh
    if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
            voice.name.includes('Google UK English Male') ||
            voice.name.includes('Microsoft David') ||
            voice.lang === 'en-US'
        );
    }
    
    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
        console.log("🎤 Dùng giọng Web Speech:", selectedVoice.name);
    }
    
    const language = detectLanguage(text);
    currentUtterance.lang = language === 'vi' ? 'vi-VN' : 'en-US';
    currentUtterance.rate = 0.95;
    currentUtterance.pitch = 1.0;
    currentUtterance.volume = 1;
    
    currentUtterance.onend = () => {
        currentUtterance = null;
        isSpeaking = false;
        stopTalkingAnimation();
    };
    
    currentUtterance.onerror = (e) => {
        console.error("Web Speech error:", e);
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

// ========== HOẠT HÌNH ROBOT ==========
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

// ========== DỊCH THUẬT ==========
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

async function translateText(text, sourceLang, targetLang) {
    const prompt = `Dịch đoạn văn sau từ ${sourceLang} sang ${targetLang}. CHỈ trả về bản dịch, không giải thích, không thêm từ nào khác.\n\nVăn bản: "${text}"\n\nBản dịch:`;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: `Bạn là công cụ dịch thuật chuyên nghiệp. Nhiệm vụ: dịch chính xác văn bản người dùng cung cấp từ ${sourceLang} sang ${targetLang}. CHỈ trả về bản dịch.` },
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

// NÚT 1: ANH → VIỆT
if (translateEnToViBtn) {
    let currentRecognition = null;
    let isListening = false;
    
    translateEnToViBtn.addEventListener('mousedown', () => {
        translateEnToViBtn.classList.add('recording');
        if (!currentRecognition) {
            currentRecognition = createRecognition('en-US');
            if (currentRecognition) {
                currentRecognition.onresult = async (event) => {
                    const spokenText = event.results[0][0].transcript;
                    addBotMessage(`🎤 (Anh) Bạn nói: "${spokenText}"`);
                    addBotMessage(`🔄 Đang dịch Anh → Việt...`);
                    const translated = await translateText(spokenText, 'Anh', 'Việt');
                    addBotMessage(`📝 Dịch: "${translated}"`);
                    await speakText(translated);
                };
                currentRecognition.onerror = (event) => {
                    console.error('Recognition error:', event.error);
                    addBotMessage(`❌ Lỗi nhận diện: ${event.error}`);
                };
                currentRecognition.onend = () => { isListening = false; };
            }
        }
        if (currentRecognition && !isListening) {
            try {
                currentRecognition.start();
                isListening = true;
                console.log("🎤 Đang nghe tiếng Anh...");
            } catch (e) {}
        }
    });
    
    translateEnToViBtn.addEventListener('mouseup', () => {
        translateEnToViBtn.classList.remove('recording');
        if (currentRecognition && isListening) {
            try {
                currentRecognition.stop();
                isListening = false;
            } catch (e) {}
        }
    });
    
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

// NÚT 2: VIỆT → ANH
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
                    addBotMessage(`🔄 Đang dịch Việt → Anh...`);
                    const translated = await translateText(spokenText, 'Việt', 'Anh');
                    addBotMessage(`📝 ${translated}`);
                    await speakText(translated);
                };
                currentRecognition.onerror = (event) => {
                    console.error('Recognition error:', event.error);
                    addBotMessage(`❌ Lỗi nhận diện: ${event.error}`);
                };
                currentRecognition.onend = () => { isListening = false; };
            }
        }
        if (currentRecognition && !isListening) {
            try {
                currentRecognition.start();
                isListening = true;
                console.log("🎤 Đang nghe tiếng Việt...");
            } catch (e) {}
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