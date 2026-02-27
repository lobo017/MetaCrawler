from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from transformers import TextIteratorStreamer
from threading import Thread
from fastapi.responses import StreamingResponse
from app.nlp.site_qa import _get_embeddings, _get_llm, CHROMA_DIR
import logging

def embed_text(job_id: str, text: str):
    """Chunks single-page text using LangChain and saves it to ChromaDB permanently."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_text(text)
    
    if not chunks:
        return {"status": "ignored", "reason": "no text"}
        
    db = Chroma(persist_directory=str(CHROMA_DIR), embedding_function=_get_embeddings(), collection_name=f"job_{job_id}")
    db.add_texts(texts=chunks)
    return {"status": "success", "chunks": len(chunks)}

def stream_answer(question: str, urls: list[str], job_ids: list[str], history: list[dict]):
    """Queries multiple Chroma collections simultaneously and streams the LLM response."""
    context_snippets = []
    embedder = _get_embeddings()
    
    # 1. Query full site crawls (Collections named after URLs)
    for url in urls:
        try:
            db = Chroma(persist_directory=str(CHROMA_DIR), embedding_function=embedder, collection_name=url)
            if db._collection.count() > 0:
                docs = db.similarity_search(question, k=2)
                context_snippets.extend([d.page_content for d in docs])
        except Exception as e:
            logging.error(f"Error querying {url}: {e}")

    # 2. Query single page scrapes (Collections named after Job IDs)
    for jid in job_ids:
        try:
            db = Chroma(persist_directory=str(CHROMA_DIR), embedding_function=embedder, collection_name=f"job_{jid}")
            if db._collection.count() > 0:
                docs = db.similarity_search(question, k=2)
                context_snippets.extend([d.page_content for d in docs])
        except Exception as e:
            logging.error(f"Error querying job_{jid}: {e}")

    final_context = "\n\n---\n\n".join(context_snippets[:4])
    
    if not final_context:
        yield "I couldn't find any relevant context in the selected sources."
        return

    # 3. Format Prompt & Stream Generate
    generator = _get_llm()
    messages = [
        {"role": "system", "content": "You are an expert data analyst. Answer the user's question directly using ONLY the provided context. If the context lacks the answer, state: 'I cannot answer this based on the scraped data.' Do not hallucinate. Use clear formatting."}
    ]
    
    for msg in history[-4:]:
        role = "assistant" if msg.get("role") == "bot" else "user"
        messages.append({"role": role, "content": msg.get("text", "")})
        
    messages.append({"role": "user", "content": f"Context:\n{final_context}\n\nQuestion:\n{question}"})
    prompt = generator.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    streamer = TextIteratorStreamer(generator.tokenizer, skip_prompt=True, skip_special_tokens=True)
    inputs = generator.tokenizer(prompt, return_tensors="pt").to(generator.model.device)
    
    # Unpack inputs properly for the transformers generate function
    generation_kwargs = dict(**inputs, streamer=streamer, max_new_tokens=300, do_sample=False)
    
    thread = Thread(target=generator.model.generate, kwargs=generation_kwargs)
    thread.start()
    
    for new_text in streamer:
        if new_text:
            yield new_text

def get_stream_response(question: str, urls: list[str], job_ids: list[str], history: list[dict]):
    return StreamingResponse(stream_answer(question, urls, job_ids, history), media_type="text/event-stream")