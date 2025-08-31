import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory storage for documents
let documents = [];

// Initialize RAG Database
export async function initializeRAGDatabase() {
  try {
    console.log("🔄 Initializing RAG database...");
    
    // Check if test data directory exists
    const testDataDir = path.join(__dirname, '..', '..', 'test', 'data');
    if (!fs.existsSync(testDataDir)) {
      console.log("📁 Creating test data directory...");
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    // Check if the specific PDF file exists
    const pdfPath = path.join(testDataDir, '05-versions-space.pdf');
    if (!fs.existsSync(pdfPath)) {
      console.log("⚠️  Test PDF file not found, skipping file processing");
      console.log("📝 You can add PDF files to the test/data directory later");
      return;
    }
    
    // If file exists, process it
    console.log("📄 Processing test PDF file...");
    // Add your PDF processing logic here
    
    console.log("✅ RAG database initialization completed");
  } catch (error) {
    console.error("❌ RAG initialization error:", error.message);
    // Don't throw the error to prevent server startup failure
    console.log("⚠️  Continuing without RAG initialization");
  }
}

// Helper function to check file existence
export function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

// Function to get all PDF files in a directory
export function getPDFFiles(directory) {
  try {
    if (!fs.existsSync(directory)) {
      return [];
    }
    
    return fs.readdirSync(directory)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => path.join(directory, file));
  } catch (error) {
    console.error("Error reading PDF files:", error);
    return [];
  }
}

// Extract text from uploaded files
export async function extractTextFromFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    let text = '';
    
    if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.docx') {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === '.pdf') {
      // For PDF processing, you might want to use a library like pdf-parse
      // For now, we'll return a placeholder
      text = 'PDF text extraction not implemented yet. Please use .txt or .docx files.';
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    return text;
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}

// Process document for RAG system
export async function processDocumentForRAG(filename, text) {
  try {
    // Simple text chunking (split by paragraphs and limit chunk size)
    const chunks = chunkText(text, 500);
    
    // Create document object
    const document = {
      id: Date.now().toString(),
      filename: filename,
      text: text,
      chunks,
      processedAt: new Date().toISOString(),
      status: 'processed'
    };

    // Store in memory (in production, use a proper database)
    documents.push(document);

    console.log(`Document "${filename}" processed with ${chunks.length} chunks`);
    
    return document.id;
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error(`Failed to process document: ${error.message}`);
  }
}

// Simple text chunking function
function chunkText(text, maxChunkSize = 500) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if ((currentChunk + trimmedSentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text]; // Fallback to original text if no chunks
}

// Query the RAG system
export async function queryRAG(query, maxResults = 5) {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    // Simple keyword-based search (in production, use vector similarity)
    const results = [];
    const queryLower = query.toLowerCase();

    for (const doc of documents) {
      for (let i = 0; i < doc.chunks.length; i++) {
        const chunk = doc.chunks[i];
        const chunkLower = chunk.toLowerCase();
        
        // Simple relevance scoring based on keyword matches
        const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
        let score = 0;
        
        keywords.forEach(keyword => {
          const matches = (chunkLower.match(new RegExp(keyword, 'g')) || []).length;
          score += matches;
        });

        if (score > 0) {
          results.push({
            documentId: doc.id,
            documentName: doc.filename,
            chunkIndex: i,
            content: chunk,
            relevanceScore: score
          });
        }
      }
    }

    // Sort by relevance score and limit results
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topResults = results.slice(0, maxResults);

    // Generate a simple response based on the results
    let response = '';
    if (topResults.length > 0) {
      response = `Based on the documents, here's what I found:\n\n${topResults[0].content}`;
      if (topResults.length > 1) {
        response += `\n\nAdditional relevant information:\n${topResults[1].content}`;
      }
    } else {
      response = 'I could not find relevant information in the uploaded documents to answer your query.';
    }

    return {
      query,
      response,
      sources: topResults,
      totalDocuments: documents.length
    };
  } catch (error) {
    console.error('Error querying RAG:', error);
    throw new Error(`Search failed: ${error.message}`);
  }
}

// Get all documents
export function getAllDocuments() {
  return documents.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    processedAt: doc.processedAt,
    status: doc.status,
    chunksCount: doc.chunks.length,
    textLength: doc.text.length
  }));
}

// Delete document
export function deleteDocument(documentId) {
  try {
    const initialLength = documents.length;
    documents = documents.filter(doc => doc.id !== documentId);
    
    const wasDeleted = documents.length < initialLength;
    
    if (wasDeleted) {
      console.log(`Document with ID ${documentId} deleted successfully`);
    } else {
      console.log(`Document with ID ${documentId} not found`);
    }
    
    return wasDeleted;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

// Get document by ID
export function getDocumentById(documentId) {
  return documents.find(doc => doc.id === documentId) || null;
}

// Get document statistics
export function getDocumentStats() {
  const totalDocuments = documents.length;
  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);
  const totalTextLength = documents.reduce((sum, doc) => sum + doc.text.length, 0);
  
  return {
    totalDocuments,
    totalChunks,
    totalTextLength,
    averageChunksPerDoc: totalDocuments > 0 ? Math.round(totalChunks / totalDocuments) : 0,
    averageTextLengthPerDoc: totalDocuments > 0 ? Math.round(totalTextLength / totalDocuments) : 0
  };
}