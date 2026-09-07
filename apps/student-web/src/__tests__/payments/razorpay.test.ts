import { describe, expect, it } from 'vitest';
import { verifyRazorpaySignature } from '../../lib/razorpay-verify';

describe('Razorpay Verify', () => {
  it('should throw if secret is missing', () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(() => verifyRazorpaySignature('order_123', 'pay_123', 'sig')).toThrow();
  });
  
  it('should verify correct signature', () => {
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    // crypto HMAC of "order_123|pay_123" with "test_secret"
    const crypto = require('crypto');
    const validSig = crypto.createHmac('sha256', 'test_secret').update('order_123|pay_123').digest('hex');
    
    expect(verifyRazorpaySignature('order_123', 'pay_123', validSig)).toBe(true);
  });
});
