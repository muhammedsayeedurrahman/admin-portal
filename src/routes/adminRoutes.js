// src/routes/adminRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { extractTextFromFile, processDocumentForRAG, queryRAG, getAllDocuments, deleteDocument } from "../utils/ragUtils.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_DIR || 'uploads');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only specific file types
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware to check if admin is logged in
const requireAuth = (req, res, next) => {
  if (!req.session.admin) {
    req.flash('error', 'Please log in to access the admin area');
    return res.redirect('/admin/login');
  }
  next();
};

// Login page
router.get('/login', (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { title: 'Admin Login' });
});

// Handle login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple authentication (replace with proper authentication)
  if (username === 'admin' && password === 'password') {
    req.session.admin = { username };
    req.flash('success', 'Successfully logged in!');
    res.redirect('/admin/dashboard');
  } else {
    req.flash('error', 'Invalid credentials');
    res.redirect('/admin/login');
  }
});

// Dashboard
router.get('/dashboard', requireAuth, (req, res) => {
  const documents = getAllDocuments();
  res.render('admin/dashboard', { 
    title: 'Admin Dashboard',
    documents 
  });
});

// Upload document page
router.get('/upload', requireAuth, (req, res) => {
  res.render('admin/upload', { title: 'Upload Document' });
});

// Handle document upload
router.post('/upload', requireAuth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'Please select a file to upload');
      return res.redirect('/admin/upload');
    }

    const filePath = req.file.path;
    const filename = req.file.originalname;

    // Extract text from the uploaded file
    const text = await extractTextFromFile(filePath);
    
    // Process document for RAG
    const documentId = await processDocumentForRAG(filename, text);

    req.flash('success', `Document "${filename}" uploaded and processed successfully!`);
    res.redirect('/admin/dashboard');
    
  } catch (error) {
    console.error('Upload error:', error);
    req.flash('error', `Failed to process document: ${error.message}`);
    res.redirect('/admin/upload');
  }
});

// Query/Search page
router.get('/search', requireAuth, (req, res) => {
  res.render('admin/search', { 
    title: 'Search Documents',
    query: '',
    results: null
  });
});

// Handle search query
router.post('/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim() === '') {
      req.flash('error', 'Please enter a search query');
      return res.redirect('/admin/search');
    }

    const results = await queryRAG(query.trim());
    
    res.render('admin/search', {
      title: 'Search Results',
      query: query.trim(),
      results
    });
    
  } catch (error) {
    console.error('Search error:', error);
    req.flash('error', `Search failed: ${error.message}`);
    res.redirect('/admin/search');
  }
});

// Delete document
router.delete('/document/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteDocument(id);
    
    if (deleted) {
      req.flash('success', 'Document deleted successfully');
    } else {
      req.flash('error', 'Document not found');
    }
    
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Delete error:', error);
    req.flash('error', 'Failed to delete document');
    res.redirect('/admin/dashboard');
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  req.flash('success', 'Successfully logged out');
  res.redirect('/admin/login');
});

export default router;