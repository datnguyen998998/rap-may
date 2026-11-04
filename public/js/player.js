// ===============================================================
//  TRÌNH PHÁT YOUTUBE ĐỒNG BỘ
//  Server giữ "thời điểm bắt đầu" của video. Mỗi trình duyệt tự tính
//  video đang ở giây thứ mấy rồi tua cho khớp => cả rạp xem cùng lúc.
// ===============================================================

let apiPromise = null;
function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('Không tải được YouTube'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('YouTube tải quá lâu')), 15000);
  });
  apiPromise.catch(() => { apiPromise = null; });
  return apiPromise;
}

const S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

export class CinemaPlayer {
  constructor({ mount, idle, idleText, send, onNeedSound }) {
    this.mountEl = mount;
    this.idleEl = idle;
    this.idleText = idleText;
    this.send = send;
    this.onNeedSound = onNeedSound || (() => {});
    this.offset = 0;          // chênh lệch đồng hồ máy mình so với server (ms)
    this.current = null;
    this.player = null;
    this.ready = false;
    this.loadedId = null;
    this.reported = new Set();
    this.volume = 80;
    this.unlocked = false;    // người dùng đã bấm => được phép phát có tiếng
    this.captions = false;    // phụ đề (chỉ trên máy mình)
    this.captionsApplied = null;
    setInterval(() => this.sync(), 2000);
  }

  serverNow() { return Date.now() + this.offset; }
  expected() { return this.current ? (this.serverNow() - this.current.startedAt) / 1000 : 0; }

  // Gọi sau khi người dùng bấm "Vào rạp" (trình duyệt cho phép phát tiếng sau khi có thao tác)
  async unlock() {
    this.unlocked = true;
    if (this.current) await this.apply();
  }

  async setCurrent(cur) {
    this.current = cur;
    clearTimeout(this.startTimer);
    if (!cur) {
      this.loadedId = null;
      if (this.ready) this.player.stopVideo();
      this.showIdle('Chưa có phim nào đang chiếu', 'Dán link YouTube ở khung "Hàng chờ" để đề xuất phim nhé! 🍿');
      return;
    }
    if (this.unlocked) await this.apply();
    else this.showIdle(cur.title, 'Vào rạp để xem cùng mọi người 🎟️');
  }

  showIdle(title, sub) {
    this.idleEl.classList.remove('hidden');
    this.idleText.querySelector('.idle-title').textContent = title;
    this.idleText.querySelector('.idle-sub').textContent = sub;
  }

  async apply() {
    const cur = this.current;
    if (!cur) return;
    try {
      await this.ensurePlayer();
    } catch (e) {
      this.showIdle('Không tải được YouTube 😢', 'Kiểm tra kết nối mạng hoặc tắt trình chặn quảng cáo rồi tải lại trang.');
      return;
    }
    if (this.current !== cur) return;
    this.idleEl.classList.add('hidden');
    const exp = this.expected();
    this.loadedId = cur.videoId;
    this.player.setVolume(this.volume);
    if (exp < 0) {
      // video chưa đến giờ chiếu: chuẩn bị sẵn, đúng giờ thì phát
      this.player.cueVideoById({ videoId: cur.videoId, startSeconds: 0 });
      this.startTimer = setTimeout(() => this.player.playVideo(), -exp * 1000);
    } else {
      this.player.loadVideoById({ videoId: cur.videoId, startSeconds: exp });
    }
    clearTimeout(this.soundCheck);
    this.soundCheck = setTimeout(() => this.checkAutoplay(), Math.max(0, -exp * 1000) + 4000);
  }

  ensurePlayer() {
    if (this.ready) return Promise.resolve();
    if (this.creating) return this.creating;
    this.creating = loadYouTubeApi().then(() => new Promise((resolve) => {
      const div = document.createElement('div');
      this.mountEl.innerHTML = '';
      this.mountEl.appendChild(div);
      this.player = new window.YT.Player(div, {
        width: '100%', height: '100%',
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, modestbranding: 1,
          cc_load_policy: this.captions ? 1 : 0, cc_lang_pref: 'vi', hl: 'vi',
        },
        events: {
          onReady: () => { this.ready = true; resolve(); },
          onStateChange: (e) => this.onState(e.data),
          onError: (e) => this.onError(e.data),
        },
      });
    }));
    this.creating.catch(() => { this.creating = null; });
    return this.creating;
  }

  onState(state) {
    const cur = this.current;
    if (!cur) return;
    if (state === S.PLAYING && this.captionsApplied !== cur.videoId + this.captions) this.applyCaptions();
    if (state === S.PLAYING && !this.reported.has(cur.videoId)) {
      const d = this.player.getDuration();
      if (d > 0) {
        this.reported.add(cur.videoId);
        this.send('duration', { videoId: cur.videoId, duration: d });
      }
    }
    if (state === S.ENDED) this.send('ended', cur.videoId);
  }

  onError(code) {
    // 2: ID sai, 5: lỗi HTML5, 100: video bị xoá, 101/150: chủ video chặn nhúng
    if (this.current) this.send('video-error', { videoId: this.current.videoId, code });
  }

  // Trình duyệt có thể chặn tự phát có tiếng => phát không tiếng và hiện nút "Bật tiếng"
  checkAutoplay() {
    if (!this.ready || !this.current) return;
    const st = this.player.getPlayerState();
    if (st !== S.PLAYING && st !== S.BUFFERING && this.expected() > 0) {
      this.player.mute();
      this.player.playVideo();
      this.onNeedSound(true);
    } else if (this.player.isMuted && this.player.isMuted()) {
      this.onNeedSound(true);
    }
  }

  // Bật/tắt phụ đề YouTube (nếu video có phụ đề). Ưu tiên tiếng Việt.
  setCaptions(on) {
    this.captions = on;
    this.applyCaptions();
  }

  applyCaptions() {
    if (!this.ready || !this.current) return;
    this.captionsApplied = this.current.videoId + this.captions;
    try {
      if (this.captions) {
        this.player.loadModule('captions');
        // nếu video có phụ đề tiếng Việt thì chọn tiếng Việt, không thì giữ mặc định của video
        setTimeout(() => {
          try {
            const list = this.player.getOption('captions', 'tracklist') || [];
            const vi = list.find((t) => (t.languageCode || '').startsWith('vi'));
            if (vi) this.player.setOption('captions', 'track', { languageCode: vi.languageCode });
          } catch { /* bỏ qua */ }
        }, 1200);
      } else {
        this.player.unloadModule('captions');
      }
    } catch { /* video không có phụ đề */ }
  }

  unmute() {
    if (!this.ready) return;
    this.player.unMute();
    this.player.setVolume(this.volume);
    this.player.playVideo();
    this.onNeedSound(false);
  }

  setVolume(v) {
    this.volume = v;
    if (this.ready) {
      this.player.setVolume(v);
      if (v > 0 && this.player.isMuted()) this.unmute();
    }
  }

  sync() {
    if (!this.ready || !this.current || this.loadedId !== this.current.videoId) return;
    const exp = this.expected();
    if (exp < 0) return;
    if (this.current.duration && exp > this.current.duration) return;
    const st = this.player.getPlayerState();
    if (st === S.PAUSED || st === S.CUED || st === S.UNSTARTED) {
      this.player.seekTo(exp, true);
      this.player.playVideo();
      return;
    }
    if (st === S.PLAYING) {
      const drift = this.player.getCurrentTime() - exp;
      if (Math.abs(drift) > 2) this.player.seekTo(exp, true);
    }
  }
}
