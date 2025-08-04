import { SWP08_CONSTANTS, SWP08Frame, ParsedMultiplier } from '../types/swp08.types';

export class SWP08Parser {
  private buffer: Buffer = Buffer.alloc(0);
  private inFrame: boolean = false;
  private currentMessage: Buffer = Buffer.alloc(0);

  /**
   * Calculate 8-bit 2's complement checksum
   */
  static calculateChecksum(data: Buffer): number {
    let sum = 0;
    for (const byte of data) {
      sum = (sum + byte) & 0xFF;
    }
    return ((~sum + 1) & 0x7F); // 7-bit result with MSB = 0
  }

  /**
   * Escape DLE characters in data
   */
  static escapeDLE(data: Buffer): Buffer {
    const escaped: number[] = [];
    for (const byte of data) {
      if (byte === SWP08_CONSTANTS.DLE) {
        escaped.push(SWP08_CONSTANTS.DLE, SWP08_CONSTANTS.DLE);
      } else {
        escaped.push(byte);
      }
    }
    return Buffer.from(escaped);
  }

  /**
   * Unescape DLE characters in data
   */
  static unescapeDLE(data: Buffer): Buffer {
    const unescaped: number[] = [];
    let i = 0;
    while (i < data.length) {
      if (data[i] === SWP08_CONSTANTS.DLE && i + 1 < data.length && data[i + 1] === SWP08_CONSTANTS.DLE) {
        unescaped.push(SWP08_CONSTANTS.DLE);
        i += 2;
      } else {
        unescaped.push(data[i]);
        i++;
      }
    }
    return Buffer.from(unescaped);
  }

  /**
   * Build a complete SWP08 frame
   */
  static buildFrame(command: number, data: Buffer = Buffer.alloc(0)): Buffer {
    // Build message: command + data
    const message = Buffer.concat([Buffer.from([command]), data]);
    
    // Add byte count
    const byteCount = message.length + 1; // +1 for checksum
    const messageWithCount = Buffer.concat([message, Buffer.from([byteCount])]);
    
    // Calculate and add checksum
    const checksum = this.calculateChecksum(messageWithCount);
    const fullMessage = Buffer.concat([messageWithCount, Buffer.from([checksum])]);
    
    // Escape DLE characters
    const escapedMessage = this.escapeDLE(fullMessage);
    
    // Add frame delimiters
    return Buffer.concat([
      Buffer.from([SWP08_CONSTANTS.DLE, SWP08_CONSTANTS.STX]),
      escapedMessage,
      Buffer.from([SWP08_CONSTANTS.DLE, SWP08_CONSTANTS.ETX])
    ]);
  }

  /**
   * Parse incoming data and extract complete frames
   */
  parseData(data: Buffer): SWP08Frame[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const frames: SWP08Frame[] = [];
    
    let startIndex = -1;
    let i = 0;
    
    while (i < this.buffer.length - 1) {
      // Look for start of message (DLE STX)
      if (this.buffer[i] === SWP08_CONSTANTS.DLE && this.buffer[i + 1] === SWP08_CONSTANTS.STX) {
        startIndex = i + 2;
        i += 2;
        continue;
      }
      
      // Look for end of message (DLE ETX)
      if (startIndex !== -1 && this.buffer[i] === SWP08_CONSTANTS.DLE && this.buffer[i + 1] === SWP08_CONSTANTS.ETX) {
        // Extract message between start and end
        const rawMessage = this.buffer.slice(startIndex, i);
        
        // Unescape DLE characters
        const message = SWP08Parser.unescapeDLE(rawMessage);
        
        // Parse the frame
        const frame = this.parseFrame(message);
        if (frame) {
          frames.push(frame);
        }
        
        // Remove processed data from buffer
        this.buffer = this.buffer.slice(i + 2);
        i = 0;
        startIndex = -1;
        continue;
      }
      
      i++;
    }
    
    // If we have a start but no end, keep the data in buffer
    if (startIndex !== -1) {
      this.buffer = this.buffer.slice(startIndex - 2);
    }
    
    return frames;
  }

  /**
   * Parse a single frame
   */
  private parseFrame(data: Buffer): SWP08Frame | null {
    if (data.length < 3) return null; // Minimum: command + bytecount + checksum
    
    const command = data[0];
    const byteCount = data[data.length - 2];
    const checksum = data[data.length - 1];
    
    // Verify byte count
    if (byteCount !== data.length) {
      console.error('Invalid byte count:', byteCount, 'vs', data.length);
      return null;
    }
    
    // Verify checksum
    const messageForChecksum = data.slice(0, -1); // Everything except checksum
    const calculatedChecksum = SWP08Parser.calculateChecksum(messageForChecksum);
    
    if (calculatedChecksum !== checksum) {
      console.error('Checksum mismatch:', calculatedChecksum, 'vs', checksum);
      return null;
    }
    
    // Extract message data (excluding command, bytecount, and checksum)
    const messageData = data.length > 3 ? data.slice(1, -2) : Buffer.alloc(0);
    
    return {
      command,
      data: messageData,
      checksum
    };
  }

  /**
   * Parse multiplier byte used in many messages
   */
  static parseMultiplier(multiplier: number): ParsedMultiplier {
    return {
      destinationHigh: (multiplier >> 4) & 0x07,
      sourceStatus: ((multiplier >> 3) & 0x01) === 1,
      sourceHigh: multiplier & 0x07
    };
  }

  /**
   * Build multiplier byte
   */
  static buildMultiplier(destHigh: number, sourceStatus: boolean, sourceHigh: number): number {
    return ((destHigh & 0x07) << 4) | (sourceStatus ? 0x08 : 0x00) | (sourceHigh & 0x07);
  }

  /**
   * Convert destination/source to high and low bytes
   */
  static splitAddress(address: number): { high: number; low: number } {
    return {
      high: Math.floor(address / 128),
      low: address % 128
    };
  }

  /**
   * Combine high and low bytes to address
   */
  static combineAddress(high: number, low: number): number {
    return high * 128 + low;
  }

  /**
   * Build ACK frame
   */
  static buildAck(): Buffer {
    return Buffer.from([SWP08_CONSTANTS.DLE, SWP08_CONSTANTS.ACK]);
  }

  /**
   * Build NAK frame
   */
  static buildNak(): Buffer {
    return Buffer.from([SWP08_CONSTANTS.DLE, SWP08_CONSTANTS.NAK]);
  }

  /**
   * Check if buffer contains ACK
   */
  static isAck(data: Buffer): boolean {
    return data.length >= 2 && 
           data[0] === SWP08_CONSTANTS.DLE && 
           data[1] === SWP08_CONSTANTS.ACK;
  }

  /**
   * Check if buffer contains NAK
   */
  static isNak(data: Buffer): boolean {
    return data.length >= 2 && 
           data[0] === SWP08_CONSTANTS.DLE && 
           data[1] === SWP08_CONSTANTS.NAK;
  }
}