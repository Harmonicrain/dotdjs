/** Thrown when a message is truncated or otherwise malformed. */
export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/** Growable little-endian binary writer. */
export class Writer {
  private bytes = new Uint8Array(256);
  private view = new DataView(this.bytes.buffer);
  private offset = 0;

  private ensure(size: number): void {
    if (this.offset + size <= this.bytes.length) return;
    let capacity = this.bytes.length * 2;
    while (capacity < this.offset + size) capacity *= 2;
    const next = new Uint8Array(capacity);
    next.set(this.bytes);
    this.bytes = next;
    this.view = new DataView(next.buffer);
  }

  u8(v: number): this {
    this.ensure(1);
    this.view.setUint8(this.offset, v);
    this.offset += 1;
    return this;
  }

  i8(v: number): this {
    this.ensure(1);
    this.view.setInt8(this.offset, v);
    this.offset += 1;
    return this;
  }

  u16(v: number): this {
    this.ensure(2);
    this.view.setUint16(this.offset, v, true);
    this.offset += 2;
    return this;
  }

  i16(v: number): this {
    this.ensure(2);
    this.view.setInt16(this.offset, v, true);
    this.offset += 2;
    return this;
  }

  u32(v: number): this {
    this.ensure(4);
    this.view.setUint32(this.offset, v, true);
    this.offset += 4;
    return this;
  }

  i32(v: number): this {
    this.ensure(4);
    this.view.setInt32(this.offset, v, true);
    this.offset += 4;
    return this;
  }

  f32(v: number): this {
    this.ensure(4);
    this.view.setFloat32(this.offset, v, true);
    this.offset += 4;
    return this;
  }

  f64(v: number): this {
    this.ensure(8);
    this.view.setFloat64(this.offset, v, true);
    this.offset += 8;
    return this;
  }

  /** UTF-8 string with a u8 byte-length prefix (max 255 bytes). */
  string(s: string): this {
    const encoded = encodeUtf8(s).subarray(0, 255);
    this.u8(encoded.length);
    this.ensure(encoded.length);
    this.bytes.set(encoded, this.offset);
    this.offset += encoded.length;
    return this;
  }

  finish(): Uint8Array {
    return this.bytes.slice(0, this.offset);
  }
}

/** Bounds-checked little-endian binary reader. */
export class Reader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  private take(size: number): number {
    if (this.offset + size > this.bytes.length) throw new ProtocolError('Message truncated');
    const at = this.offset;
    this.offset += size;
    return at;
  }

  u8(): number {
    return this.view.getUint8(this.take(1));
  }

  i8(): number {
    return this.view.getInt8(this.take(1));
  }

  u16(): number {
    return this.view.getUint16(this.take(2), true);
  }

  i16(): number {
    return this.view.getInt16(this.take(2), true);
  }

  u32(): number {
    return this.view.getUint32(this.take(4), true);
  }

  i32(): number {
    return this.view.getInt32(this.take(4), true);
  }

  f32(): number {
    return this.view.getFloat32(this.take(4), true);
  }

  f64(): number {
    return this.view.getFloat64(this.take(8), true);
  }

  string(): string {
    const length = this.u8();
    const at = this.take(length);
    return decodeUtf8(this.bytes.subarray(at, at + length));
  }
}

// Minimal UTF-8 helpers so the codec runs without DOM or Node typings.

export function encodeUtf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return Uint8Array.from(out);
}

export function decodeUtf8(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    let cp: number;
    let extra: number;
    if (b < 0x80) [cp, extra] = [b, 0];
    else if (b >= 0xf0) [cp, extra] = [b & 7, 3];
    else if (b >= 0xe0) [cp, extra] = [b & 15, 2];
    else if (b >= 0xc0) [cp, extra] = [b & 31, 1];
    else [cp, extra] = [0xfffd, 0]; // stray continuation byte
    i++;
    for (let k = 0; k < extra; k++) {
      const next = bytes[i];
      if (next === undefined || (next & 0xc0) !== 0x80) {
        cp = 0xfffd;
        break;
      }
      cp = (cp << 6) | (next & 63);
      i++;
    }
    s += String.fromCodePoint(cp > 0x10ffff ? 0xfffd : cp);
  }
  return s;
}
