-- Undo 20261020000000_chat_message_sender_receiver_created_idx.
-- Run by hand, outside a transaction. Prisma does not run this file.
-- To let `prisma migrate deploy` apply the migration again afterwards:
--   npx prisma migrate resolve --rolled-back 20261020000000_chat_message_sender_receiver_created_idx
DROP INDEX CONCURRENTLY IF EXISTS "ChatMessage_senderId_receiverId_createdAt_idx";
