export class PdfRendererService {
  async invertImageFiles(imageFiles: string[], outputDir: string): Promise<string[]> {
    
    const invertedFiles: string[] = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const originalFilePath = imageFiles[i];
      
      // Update progress for this image (Stage 2: 40-80%)
      const inversionProgress = 40 + Math.round(((i + 1) / imageFiles.length) * 40);
      await window.electronAPI.updateRenderingProgress(
        'Stage 2: Image Inversion', 
        `Inverting image ${i + 1}/${imageFiles.length} from negative to positive... (${inversionProgress}% complete)`, 
        inversionProgress
      );
      
      
      try {
        // Read image from disk using fetch
        const response = await fetch(`file://${originalFilePath}`);
        if (!response.ok) {
          throw new Error(`Failed to read image file: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        const imageUrl = URL.createObjectURL(blob);
        
        // Load image into an HTML Image element
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });
        
        
        // Create canvas for inversion
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas 2D context');
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image to canvas
        ctx.drawImage(img, 0, 0);
        
        // MEMORY OPTIMIZATION: Process image in horizontal strips to reduce memory usage
        const stripHeight = Math.min(100, canvas.height); // Process 100px strips at a time
        const totalStrips = Math.ceil(canvas.height / stripHeight);
        
        
        for (let stripIndex = 0; stripIndex < totalStrips; stripIndex++) {
          const startY = stripIndex * stripHeight;
          const actualStripHeight = Math.min(stripHeight, canvas.height - startY);
          
          // Get image data for this strip only
          const imageDataStrip = ctx.getImageData(0, startY, canvas.width, actualStripHeight);
          const pixels = imageDataStrip.data;
          
          // Invert each pixel in this strip (RGB channels, keep alpha)
          for (let j = 0; j < pixels.length; j += 4) {
            pixels[j] = 255 - pixels[j];     // Red
            pixels[j + 1] = 255 - pixels[j + 1]; // Green
            pixels[j + 2] = 255 - pixels[j + 2]; // Blue
            // pixels[j + 3] stays the same (Alpha)
          }
          
          // Put the inverted strip back
          ctx.putImageData(imageDataStrip, 0, startY);
          
          // Force garbage collection of the pixel data by clearing reference
          imageDataStrip.data.fill(0);
          
          // Give browser a chance to garbage collect between strips
          if (stripIndex % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
        
        
        // Convert canvas to blob with high-quality JPEG
        const invertedBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error('Failed to create blob from canvas');
          }, 'image/jpeg', 0.95); // 95% quality to prevent artifacts
        });
        
        // Convert blob to array buffer
        const invertedBuffer = await invertedBlob.arrayBuffer();
        
        // Save inverted image as JPEG for smaller file size
        const fileName = `inverted-page-${(i + 1).toString().padStart(3, '0')}.jpg`;
        const invertedPath = `${outputDir}/${fileName}`;
        
        // Use IPC to save inverted file
        await window.electronAPI.saveImageFile(invertedPath, new Uint8Array(invertedBuffer));
        
        // Clean up memory immediately and aggressively
        URL.revokeObjectURL(imageUrl);
        canvas.width = 0;
        canvas.height = 0;
        canvas.remove();
        img.src = '';
        img.remove();
        
        // Force garbage collection hint
        if (typeof window !== 'undefined' && (window as any).gc) {
          (window as any).gc();
        }
        
        invertedFiles.push(invertedPath);
        
      } catch (error) {
        // Create a placeholder name if inversion fails  
        const fileName = `failed-invert-page-${(i + 1).toString().padStart(3, '0')}.jpg`;
        invertedFiles.push(`${outputDir}/${fileName}`);
      }
      
      // Add small delay between images to prevent memory buildup
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return invertedFiles;
  }

  async createPdfFromImages(imageFiles: string[], outputDir: string, customFileName?: string): Promise<string> {
      // Load pdf-lib
      const { PDFDocument } = await import('pdf-lib');
      
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      
      for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = imageFiles[i];
        
        // Update progress for this page (Stage 3: 80-100%)
        const pdfProgress = 80 + Math.round(((i + 1) / imageFiles.length) * 20);
        await window.electronAPI.updateRenderingProgress(
          'Stage 3: Creating PDF', 
          `Adding page ${i + 1}/${imageFiles.length} to PDF... (${pdfProgress}% complete)`, 
          pdfProgress
        );
        
        
        // Read the image file
        const response = await fetch(`file://${imagePath}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const imageBytes = await response.arrayBuffer();
        
        // Embed the image (JPEG format)
        const image = await pdfDoc.embedJpg(new Uint8Array(imageBytes));
        
        // Create a page with the same dimensions as the image
        const page = pdfDoc.addPage([image.width, image.height]);
        
        // Draw the image on the page
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }
      
      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      
      // Use custom filename if provided, otherwise generate default
      const pdfFileName = customFileName || 'converted-document_inverted.pdf';
      const pdfPath = `${outputDir}/${pdfFileName}`;
      
      // Use IPC to save PDF file
      await window.electronAPI.saveImageFile(pdfPath, new Uint8Array(pdfBytes));
      
      return pdfPath;
  }

  async renderPdfFromFile(pdfPath: string, outputDir: string): Promise<string[]> {
      // Read PDF file from disk
      const response = await fetch(`file://${pdfPath}`);
      if (!response.ok) {
        throw new Error(`Failed to read PDF file: ${response.status}`);
      }
      
      const pdfBuffer = await response.arrayBuffer();
      const pdfUint8Array = new Uint8Array(pdfBuffer);
      
      // Use Uint8Array directly to avoid array length limits
      return this.renderPdfFromUint8Array(pdfUint8Array, outputDir);
  }

  async renderPdfFromUint8Array(pdfUint8Array: Uint8Array, outputDir: string): Promise<string[]> {
      // Load PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set up worker path (works for both dev and production)
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      
      
      // Load PDF document directly from Uint8Array
      const loadingTask = pdfjsLib.getDocument({ data: pdfUint8Array });
      const pdfDocument = await loadingTask.promise;
      
      
      // Process all pages (no artificial limit)
      const maxPages = pdfDocument.numPages;
      
      const imageFiles: string[] = [];
      
      // Render each page (memory efficient - no storing in memory)
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        
        // Update progress for this page (Stage 1: 0-40%)
        const pageProgress = Math.round((pageNum / maxPages) * 40);
        await window.electronAPI.updateRenderingProgress(
          'Stage 1: PDF Rendering', 
          `Converting page ${pageNum}/${maxPages} to image... (${pageProgress}% complete)`, 
          pageProgress
        );
        
        
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.2 }); // Reduced from 1.5x to 1.2x for better memory usage
        
        // Create canvas using browser API
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error(`Failed to get 2D context for page ${pageNum}`);
        }
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Convert to blob with high-quality JPEG to avoid artifacts
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error(`Failed to create blob for page ${pageNum}`);
          }, 'image/jpeg', 0.95); // 95% quality to prevent artifacts and flashing
        });
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Save to file using IPC (immediately to disk, not in memory)  
        const fileName = `page-${pageNum.toString().padStart(3, '0')}.jpg`;
        const filePath = `${outputDir}/${fileName}`;
        
        // Use IPC to save file in main process
        await window.electronAPI.saveImageFile(filePath, uint8Array);
        
        imageFiles.push(filePath);
        
        // Clear canvas and context to free memory aggressively
        canvas.width = 0;
        canvas.height = 0;
        canvas.remove();
        
        // Small delay between pages to allow garbage collection
        if (pageNum % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return imageFiles;
  }

  async renderPdfToImages(pdfData: number[], outputDir: string): Promise<string[]> {
      // Load PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set up worker path (works for both dev and production)
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      
      // Convert array back to Uint8Array
      const pdfUint8Array = new Uint8Array(pdfData);
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: pdfUint8Array });
      const pdfDocument = await loadingTask.promise;
      
      
      // Process all pages (no artificial limit)
      const maxPages = pdfDocument.numPages;
      
      const imageFiles: string[] = [];
      
      // Render each page (memory efficient - no storing in memory)
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.2 }); // Reduced from 1.5x to 1.2x for better memory usage
        
        // Create canvas using browser API
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error(`Failed to get 2D context for page ${pageNum}`);
        }
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Convert to blob with high-quality JPEG to avoid artifacts
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error(`Failed to create blob for page ${pageNum}`);
          }, 'image/jpeg', 0.95); // 95% quality to prevent artifacts and flashing
        });
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Save to file using IPC (immediately to disk, not in memory)  
        const fileName = `page-${pageNum.toString().padStart(3, '0')}.jpg`;
        const filePath = `${outputDir}/${fileName}`;
        
        // Use IPC to save file in main process
        await window.electronAPI.saveImageFile(filePath, uint8Array);
        
        imageFiles.push(filePath);
        
        // Clear canvas and context to free memory aggressively
        canvas.width = 0;
        canvas.height = 0;
        canvas.remove();
        
        // Small delay between pages to allow garbage collection
        if (pageNum % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return imageFiles;
  }
}