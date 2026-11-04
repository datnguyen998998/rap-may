// ===============================================================
//  WEBSOCKET SERVER TỐI GIẢN (không cần cài thư viện ngoài)
//  Hỗ trợ: bắt tay RFC 6455, tin nhắn text/binary, phân mảnh,
//  ping/pong, đóng kết nối, giới hạn kích thước tin nhắn.
// ===============================================================
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OPEN = 1;
const CLOSED = 3;

class Connection extends EventEmitter {
  constructor(socket, maxPayload) {
    super();
    this.socket = socket;
    this.maxPayload = maxPayload;
    this.readyState = OPEN;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.fragmentSize = 0;

    socket.setNoDelay(true);
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.finish());
    socket.on('end', () => this.finish());
    socket.on('error', () => this.finish());
  }

  onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    if (this.buffer.length > this.maxPayload * 2 + 64) return this.fail(1009);
    while (this.readyState === OPEN) {
      const frame = this.parseFrame();
      if (!frame) break;
      this.handleFrame(frame);
    }
  }

  parseFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return null;
    const b0 = buf[0], b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (buf.length < 4) return null;
      len = buf.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (buf.length < 10) return null;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(this.maxPayload)) { this.fail(1009); return null; }
      len = Number(big);
      offset = 10;
    }
    if (!masked) { this.fail(1002); return null; }       // trình duyệt luôn phải che (mask) dữ liệu
    if (len > this.maxPayload) { this.fail(1009); return null; }
    if (buf.length < offset + 4 + len) return null;
    const mask = buf.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) payload[i] = buf[offset + i] ^ mask[i & 3];
    this.buffer = buf.subarray(offset + len);
    return { fin, opcode, payload };
  }

  handleFrame({ fin, opcode, payload }) {
    switch (opcode) {
      case 0x0: // phần tiếp theo của tin nhắn bị chia nhỏ
        if (!this.fragmentOpcode) return this.fail(1002);
        this.fragments.push(payload);
        this.fragmentSize += payload.length;
        if (this.fragmentSize > this.maxPayload) return this.fail(1009);
        if (fin) {
          const data = Buffer.concat(this.fragments);
          const isText = this.fragmentOpcode === 0x1;
          this.fragments = [];
          this.fragmentOpcode = 0;
          this.fragmentSize = 0;
          this.emit('message', isText ? data.toString('utf8') : data, !isText);
        }
        return;
      case 0x1: // text
      case 0x2: // binary
        if (this.fragmentOpcode) return this.fail(1002);
        if (fin) return this.emit('message', opcode === 0x1 ? payload.toString('utf8') : payload, opcode === 0x2);
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
        this.fragmentSize = payload.length;
        return;
      case 0x8: // close
        this.sendFrame(0x8, payload.subarray(0, 2));
        this.readyState = CLOSED;
        this.socket.end();
        return this.finish();
      case 0x9: // ping -> trả pong
        return this.sendFrame(0xA, payload);
      case 0xA: // pong
        return this.emit('pong', payload);
      default:
        return this.fail(1002);
    }
  }

  sendFrame(opcode, payload) {
    if (this.socket.destroyed || !this.socket.writable) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(data) {
    if (this.readyState !== OPEN) return;
    const isText = typeof data === 'string';
    this.sendFrame(isText ? 0x1 : 0x2, isText ? Buffer.from(data, 'utf8') : data);
  }

  ping(data = Buffer.alloc(0)) {
    if (this.readyState === OPEN) this.sendFrame(0x9, data);
  }

  close(code = 1000) {
    if (this.readyState !== OPEN) return;
    const p = Buffer.alloc(2);
    p.writeUInt16BE(code, 0);
    this.sendFrame(0x8, p);
    this.readyState = CLOSED;
    this.socket.end();
    setTimeout(() => this.socket.destroy(), 1000).unref();
    this.finish();
  }

  fail(code) { this.close(code); }

  terminate() {
    this.readyState = CLOSED;
    this.socket.destroy();
    this.finish();
  }

  finish() {
    if (this.closedEmitted) return;
    this.closedEmitted = true;
    this.readyState = CLOSED;
    this.emit('close');
  }
}

class WebSocketServer extends EventEmitter {
  constructor({ server, path = '/', maxPayload = 64 * 1024, verifyClient = null }) {
    super();
    server.on('upgrade', (req, socket) => {
      socket.on('error', () => {}); // kết nối hỏng giữa chừng: bỏ qua, không làm sập server
      let pathname;
      try { pathname = new URL(req.url, 'http://x').pathname; } catch { pathname = ''; }
      const key = req.headers['sec-websocket-key'];
      const isWs = (req.headers.upgrade || '').toLowerCase() === 'websocket';
      if (pathname !== path || !isWs || !key) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }
      // kiểm tra trước khi nhận kết nối (IP bị chặn, mở quá nhiều kết nối, sai nguồn...)
      if (verifyClient) {
        const deny = verifyClient(req);
        if (deny) {
          const code = deny.code || 403;
          socket.end(`HTTP/1.1 ${code} ${code === 429 ? 'Too Many Requests' : 'Forbidden'}\r\nConnection: close\r\n\r\n`);
          return;
        }
      }
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
      const conn = new Connection(socket, maxPayload);
      this.emit('connection', conn, req);
    });
  }
}

module.exports = { WebSocketServer, OPEN, CLOSED };
