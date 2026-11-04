import { redirect } from 'next/navigation';

// Trợ lý RAG đã được tích hợp thành widget nổi (góc phải dưới) trên toàn bộ web.
export default function ChatPage() {
  redirect('/documents');
}
