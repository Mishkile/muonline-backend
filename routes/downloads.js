const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'downloads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename but add timestamp to prevent conflicts
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow specific file types
    const allowedTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/octet-stream'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(zip|rar|7z|exe)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP, RAR, 7Z, and EXE files are allowed'), false);
    }
  }
});

// Get all available downloads
router.get('/', async (req, res) => {
  try {
    const downloads = [
      {
        id: 'client',
        name: 'MU Online Client',
        description: 'Complete MU Online game client - Latest version',
        version: '1.0.0',
        size: '2.5 GB',
        type: 'client',
        downloadUrl: '/api/downloads/file/client',
        isAvailable: true,
        releaseDate: '2024-01-15'
      },
      {
        id: 'patcher',
        name: 'Game Patcher',
        description: 'Auto-update patcher for the latest game updates',
        version: '1.2.3',
        size: '15 MB',
        type: 'patcher',
        downloadUrl: '/api/downloads/file/patcher',
        isAvailable: true,
        releaseDate: '2024-01-20'
      },
      {
        id: 'launcher',
        name: 'Game Launcher',
        description: 'Official game launcher with auto-update functionality',
        version: '2.1.0',
        size: '25 MB',
        type: 'launcher',
        downloadUrl: '/api/downloads/file/launcher',
        isAvailable: true,
        releaseDate: '2024-01-18'
      }
    ];

    res.json({
      success: true,
      data: downloads
    });
  } catch (error) {
    console.error('Error fetching downloads:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch downloads' 
    });
  }
});

// Download file by ID
router.get('/file/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Map file IDs to actual files
    const fileMap = {
      'client': 'mu_client_v1.0.0.zip',
      'patcher': 'mu_patcher_v1.2.3.exe',
      'launcher': 'mu_launcher_v2.1.0.exe'
    };

    const fileName = fileMap[fileId];
    
    if (!fileName) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'downloads', fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not available for download'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error downloading file'
        });
      }
    });

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to download file' 
    });
  }
});

// Get download statistics
router.get('/stats', async (req, res) => {
  try {
    // In a real implementation, you would track downloads in a database
    const stats = {
      totalDownloads: 15420,
      clientDownloads: 8750,
      patcherDownloads: 4230,
      launcherDownloads: 2440,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching download stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch download statistics' 
    });
  }
});

// Upload file (admin only - would need authentication middleware)
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { originalname, filename, size, mimetype } = req.file;
    const { description, version, type } = req.body;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        originalName: originalname,
        fileName: filename,
        size: size,
        mimeType: mimetype,
        description: description || '',
        version: version || '1.0.0',
        type: type || 'misc',
        uploadDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload file' 
    });
  }
});

// Get system requirements
router.get('/requirements', (req, res) => {
  try {
    const requirements = {
      minimum: {
        os: 'Windows 7 SP1 / Windows 8.1 / Windows 10',
        processor: 'Intel Core 2 Duo 2.4 GHz / AMD Athlon 64 X2 2.8 GHz',
        memory: '2 GB RAM',
        graphics: 'DirectX 9.0c compatible',
        directx: 'Version 9.0c',
        storage: '3 GB available space',
        network: 'Broadband Internet connection'
      },
      recommended: {
        os: 'Windows 10 64-bit',
        processor: 'Intel Core i3-4160 / AMD FX-6300',
        memory: '4 GB RAM',
        graphics: 'DirectX 11 compatible',
        directx: 'Version 11',
        storage: '5 GB available space',
        network: 'Broadband Internet connection'
      }
    };

    res.json({
      success: true,
      data: requirements
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch system requirements' 
    });
  }
});

module.exports = router;
