import * as React from 'react';

export interface VerificationEmailProps {
  name: string;
  link: string;
}

export function VerificationEmail({ name, link }: VerificationEmailProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '480px', margin: '0 auto', padding: '32px' }}>
      <h2 style={{ marginBottom: '8px' }}>Hi {name} 👋</h2>
      <p style={{ color: '#4e5674', marginBottom: '24px' }}>
        Thanks for joining Language Metrics! Please verify your email address to activate your account.
      </p>
      <a href={link} style={{ display: 'inline-block', background: '#c7982f', color: '#fff', fontWeight: 600, padding: '12px 28px', borderRadius: '8px', textDecoration: 'none' }}>
        Verify Email Address
      </a>
      <p style={{ color: '#8a93a6', fontSize: '13px', marginTop: '24px' }}>
        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
  );
}

export interface PasswordResetEmailProps {
  name: string;
  link: string;
}

export function PasswordResetEmail({ name, link }: PasswordResetEmailProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '480px', margin: '0 auto', padding: '32px' }}>
      <h2 style={{ marginBottom: '8px' }}>Reset your password</h2>
      <p style={{ color: '#4e5674', marginBottom: '24px' }}>
        Hi {name}, we received a request to reset your password. Click the button below to choose a new one.
      </p>
      <a href={link} style={{ display: 'inline-block', background: '#c7982f', color: '#fff', fontWeight: 600, padding: '12px 28px', borderRadius: '8px', textDecoration: 'none' }}>
        Reset Password
      </a>
      <p style={{ color: '#8a93a6', fontSize: '13px', marginTop: '24px' }}>
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        Your password will not be changed.
      </p>
    </div>
  );
}
