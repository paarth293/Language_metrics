# Language Metrics — System Architecture & Technical Specification

**Version:** 1.0.0  
**Status:** Production Ready  
**Date:** September 7, 2026

---

## 1. System Topology Overview

Language Metrics is built as a high-performance modern monorepo organized into three Next.js applications and shared packages:

```
Language Metrics Monorepo
+-- apps/
¦   +-- student-web       (Port 3002 / Production Vercel)
¦   +-- teacher-web       (Port 3000 / Production Vercel)
¦   +-- admin-panel       (Port 3001 / 3003 / Production Vercel)
+-- packages/
    +-- database          (Prisma ORM & PostgreSQL Schema)
    +-- auth              (Shared Tokens & Session Contracts)
```

---

## 2. Infrastructure & Cloud Services

- **Hosting & Edge Delivery**: Vercel (Edge Network & Serverless Next.js Turbopack).
- **Primary Relational Store**: Supabase PostgreSQL (managed with PgBouncer connection pooling).
- **In-Memory Cache & Session Store**: Upstash Redis (serverless, low-latency key-value store for session rotation, rate-limiting, and webhook idempotency).
- **Video & Realtime Streaming**: LiveKit Cloud (WebRTC SFU for low-latency live classes).
- **Payment Gateway**: Razorpay (orders, cryptographic signature verification, and automated coin credits).
- **Object Storage**: Supabase Storage / AWS S3 (secure signed URLs for avatars, materials, and recordings).

---

## 3. Core Data & Transaction Flows

### 3.1 Student Class Booking Flow
```
Student                student-web API               PostgreSQL (Prisma)
   ¦                          ¦                              ¦
   ¦--- 1. Select Slot ------>¦                              ¦
   ¦                          ¦--- 2. Begin Serializable Tx ->¦
   ¦                          ¦    - Check Coin Balance       ¦
   ¦                          ¦    - Insert Booking Record   ¦
   ¦                          ¦    - Deduct Coins (SPEND)    ¦
   ¦                          ¦<-- 3. Commit Transaction ----¦
   ¦<-- 4. Booking Confirmed -¦
```
- **Concurrency Protection**: The booking mutation runs under `Prisma.TransactionIsolationLevel.Serializable`. If two concurrent requests contest the same slot or double-spend, PostgreSQL triggers a serialization conflict (`P2034`) which gracefully returns HTTP 409 Conflict.

### 3.2 Razorpay Coin Purchase Flow
```
Student            student-web               Razorpay                 Upstash Redis
   ¦                    ¦                       ¦                           ¦
   ¦-- 1. Buy Tier ---->¦-- Create Order ------>¦                           ¦
   ¦<-- Order ID -------¦<-- Order Created -----¦                           ¦
   ¦-- 2. Pay Modal --->¦                       ¦                           ¦
   ¦                    ¦                       ¦-- 3. Webhook (Payment) -->¦
   ¦                    ¦                       ¦                           ¦-- Deduplication Check
   ¦                    ¦<-- Verify Signature --¦                           ¦   (checkAndSetIdempotency)
   ¦                    ¦-- 4. Credit Coins --->¦(PostgreSQL)               ¦
```

### 3.3 Live Class Video Session Flow
```
Student / Teacher               Next.js API                   LiveKit Cloud
       ¦                             ¦                              ¦
       ¦-- 1. Request Video Token -->¦                              ¦
       ¦                              - Verify Booking Ownership     ¦
       ¦                              - Generate Scoped Room Token   ¦
       ¦<-- 2. Return Token + wsUrl -¦                              ¦
       ¦                                                            ¦
       ¦-- 3. Connect to Room (class-${sessionId}) ---------------->¦
       ¦<-- 4. Bidirectional Audio/Video WebRTC Stream -------------¦
```

---

## 4. Security Architecture

1. **Authentication & Session Lifecycle**:
   - Cookie-based authentication using cryptographically signed RS256/JWT access tokens (`lm_access_token`).
   - Refresh tokens (`lm_refresh_token`) stored in Redis with automatic rotation on use and instant revocation capabilities.
2. **Role-Based Access Control (RBAC)**:
   - Enforced across middleware and route handlers (`requireAuth(request, "STUDENT" | "TEACHER" | "ADMIN")`).
   - Strict horizontal privilege separation preventing IDOR on booking, session, and recording access.
3. **Defense-in-Depth HTTP Headers**:
   - `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `poweredByHeader: false`.
