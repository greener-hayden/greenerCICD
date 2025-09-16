/**
 * Tests for Authentication System
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock crypto for consistent testing
const mockCrypto = {
  subtle: {
    async importKey(format, keyData, algorithm, extractable, keyUsages) {
      return { type: 'CryptoKey', data: keyData };
    },
    async deriveBits(algorithm, baseKey, length) {
      // Generate predictable but unique output based on salt
      const saltString = Array.from(new Uint8Array(algorithm.salt))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const mockHash = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        mockHash[i] = (saltString.charCodeAt(i % saltString.length) + i) % 256;
      }
      return mockHash.buffer;
    },
    async digest(algorithm, data) {
      // Simple mock hash
      const view = new Uint8Array(data);
      const hash = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        hash[i] = view[i % view.length] ^ (i * 7);
      }
      return hash.buffer;
    }
  },
  getRandomValues(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Helper function to hash password using PBKDF2
async function hashPassword(password, salt = null) {
  const encoder = new TextEncoder();
  
  if (!salt) {
    salt = mockCrypto.getRandomValues(new Uint8Array(16));
  }
  
  const keyMaterial = await mockCrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await mockCrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return { passwordHash, saltHex, salt };
}

// Helper function to verify password
async function verifyPassword(password, storedHash, storedSaltHex, iterations = 100000) {
  const encoder = new TextEncoder();
  const salt = new Uint8Array(storedSaltHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  
  const keyMaterial = await mockCrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await mockCrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return passwordHash === storedHash;
}

describe('Password Hashing', () => {
  global.crypto = mockCrypto;

  describe('hashPassword', () => {
    it('should hash password with random salt', async () => {
      const password = 'testPassword123';
      const result = await hashPassword(password);
      
      expect(result.passwordHash).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(result.saltHex).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate different hashes for same password with different salts', async () => {
      const password = 'testPassword123';
      const result1 = await hashPassword(password);
      const result2 = await hashPassword(password);
      
      expect(result1.passwordHash).not.toBe(result2.passwordHash);
      expect(result1.saltHex).not.toBe(result2.saltHex);
    });

    it('should generate same hash for same password and salt', async () => {
      const password = 'testPassword123';
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      
      const result1 = await hashPassword(password, salt);
      const result2 = await hashPassword(password, salt);
      
      expect(result1.passwordHash).toBe(result2.passwordHash);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const { passwordHash, saltHex } = await hashPassword(password);
      
      const isValid = await verifyPassword(password, passwordHash, saltHex);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const { passwordHash, saltHex } = await hashPassword(password);
      
      const isValid = await verifyPassword('wrongPassword', passwordHash, saltHex);
      expect(isValid).toBe(false);
    });

    it('should handle different iteration counts', async () => {
      const password = 'testPassword123';
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      
      // Hash with default iterations
      const { passwordHash, saltHex } = await hashPassword(password, salt);
      
      // Verify with same iterations should work
      const isValid = await verifyPassword(password, passwordHash, saltHex, 100000);
      expect(isValid).toBe(true);
      
      // Verify with different iterations should fail
      const isInvalid = await verifyPassword(password, passwordHash, saltHex, 50000);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('Session Management', () => {
  let sessions;

  beforeEach(() => {
    sessions = new Map();
    global.crypto = mockCrypto;
  });

  function createSession(userId, expiresInMs = 24 * 60 * 60 * 1000) {
    const token = mockCrypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInMs);
    
    sessions.set(token, {
      userId,
      token,
      expiresAt,
      createdAt: new Date()
    });
    
    return token;
  }

  function validateSession(token) {
    const session = sessions.get(token);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }
    
    if (session.expiresAt < new Date()) {
      sessions.delete(token);
      return { valid: false, reason: 'Session expired' };
    }
    
    return { valid: true, session };
  }

  function deleteSession(token) {
    return sessions.delete(token);
  }

  describe('createSession', () => {
    it('should create a valid session', () => {
      const userId = 'admin';
      const token = createSession(userId);
      
      expect(token).toBeTruthy();
      expect(sessions.has(token)).toBe(true);
      
      const session = sessions.get(token);
      expect(session.userId).toBe(userId);
      expect(session.expiresAt > new Date()).toBe(true);
    });

    it('should create unique tokens', () => {
      const token1 = createSession('user1');
      const token2 = createSession('user2');
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateSession', () => {
    it('should validate active session', () => {
      const token = createSession('admin');
      const result = validateSession(token);
      
      expect(result.valid).toBe(true);
      expect(result.session.userId).toBe('admin');
    });

    it('should reject non-existent session', () => {
      const result = validateSession('invalid-token');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Session not found');
    });

    it('should reject expired session', () => {
      const token = createSession('admin', -1000); // Already expired
      const result = validateSession(token);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Session expired');
      expect(sessions.has(token)).toBe(false); // Should be deleted
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', () => {
      const token = createSession('admin');
      expect(sessions.has(token)).toBe(true);
      
      const deleted = deleteSession(token);
      expect(deleted).toBe(true);
      expect(sessions.has(token)).toBe(false);
    });

    it('should handle deleting non-existent session', () => {
      const deleted = deleteSession('non-existent');
      expect(deleted).toBe(false);
    });
  });
});

describe('CSRF Protection', () => {
  function generateCSRFToken() {
    return mockCrypto.randomUUID();
  }

  function validateCSRFToken(requestToken, storedToken) {
    if (!requestToken || !storedToken) {
      return false;
    }
    return requestToken === storedToken;
  }

  describe('CSRF Token Generation', () => {
    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
    });
  });

  describe('CSRF Token Validation', () => {
    it('should validate matching tokens', () => {
      const token = generateCSRFToken();
      const isValid = validateCSRFToken(token, token);
      
      expect(isValid).toBe(true);
    });

    it('should reject mismatched tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      const isValid = validateCSRFToken(token1, token2);
      
      expect(isValid).toBe(false);
    });

    it('should reject null or undefined tokens', () => {
      const token = generateCSRFToken();
      
      expect(validateCSRFToken(null, token)).toBe(false);
      expect(validateCSRFToken(token, null)).toBe(false);
      expect(validateCSRFToken(undefined, token)).toBe(false);
      expect(validateCSRFToken(token, undefined)).toBe(false);
    });
  });
});