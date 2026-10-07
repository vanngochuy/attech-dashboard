import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1].content;

  // Initialize Supabase Client (Service Role for admin tasks like pgvector matching)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Generate embedding for the user's query using Gemini
    // We can use an external fetch to Gemini API for embedding or via a specific Google Generative AI SDK function.
    // For scaffolding, we mock the embedding function here as standard ai-sdk/google doesn't expose embeddings directly in streamText
    // In production, use @google/generative-ai SDK to get embeddings:
    // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    // const model = genAI.getGenerativeModel({ model: "text-embedding-004"});
    // const result = await model.embedContent(latestMessage);
    // const embedding = result.embedding.values;
    
    // Mocking a vector for scaffolding (768 dimensions for Gemini)
    const mockEmbedding = Array(768).fill(0.01); 

    // 2. Search for relevant documents in Supabase
    const { data: matchDocs, error } = await supabase.rpc('match_documents', {
      query_embedding: mockEmbedding, // Replace with actual `embedding`
      match_threshold: 0.7,
      match_count: 5,
    });

    if (error) {
      console.error('Error fetching from Supabase pgvector:', error);
    }

    // 3. Construct the context from matched documents
    let context = '';
    if (matchDocs && matchDocs.length > 0) {
      context = matchDocs.map((doc: any) => `Tài liệu nguồn: ${doc.file_name}\nNội dung:\n${doc.content}`).join('\n\n');
    }

    // 4. Construct System Prompt with RAG context
    const systemPrompt = `Bạn là trợ lý AI nội bộ chuyên trả lời các câu hỏi dựa trên tài liệu của công ty.
Dưới đây là các tài liệu liên quan được trích xuất từ cơ sở dữ liệu:

${context ? context : 'Không tìm thấy tài liệu nào khớp.'}

Hãy trả lời chi tiết và chính xác dựa VÀO CÁC TÀI LIỆU TRÊN. 
Nếu câu trả lời có trong tài liệu, hãy trích dẫn (ví dụ: Theo tài liệu X...).
Nếu không có thông tin, hãy nói rõ là không có thông tin trong hệ thống, đừng tự bịa ra.
`;

    // 5. Generate stream response using Gemini 1.5 Flash via AI SDK
    const result = await streamText({
      model: google('models/gemini-1.5-flash-latest'),
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
