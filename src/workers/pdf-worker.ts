import { jsPDF } from 'jspdf';

let pdf: jsPDF | null = null;
let pageCount = 0;

// Unlimited canvas dimensions for maximum quality
// const MAX_CANVAS_WIDTH = 2048; // Removed - using unlimited resolution
// const MAX_CANVAS_HEIGHT = 2048; // Removed - using unlimited resolution

const MAX_MEMORY_USAGE_MB = 512;
const BATCH_SIZE = 5;
const GC_INTERVAL = 3;

const isWindows = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent);

// Unlimited resolution for all platforms
// const WINDOWS_MAX_CANVAS_WIDTH = 1200; // Removed - using unlimited resolution
// const WINDOWS_MAX_CANVAS_HEIGHT = 1200; // Removed - using unlimited resolution
const WINDOWS_JPEG_QUALITY = 1.0; // Maximum quality
const WINDOWS_MAX_IMAGE_SIZE_MB = 500; // Increased limit for unlimited resolution
const WINDOWS_LARGE_PDF_THRESHOLD = 15;

interface WorkerMessage {
    type: 'init' | 'addPage' | 'finalize' | 'reset' | 'processChunk' | 'assemblePages';
    data?: any;
}

interface WorkerResponse {
    type: 'ready' | 'progress' | 'complete' | 'error' | 'chunkComplete' | 'pageProcessed' | 'imageProcessingFailed' | 'assemblyComplete';
    data?: any;
}

interface ProcessedPageData {
    pageNumber: number;
    base64Data: string;
    width: number;
    height: number;
}

self.onmessage = async function(e: MessageEvent<WorkerMessage>) {
    const { type, data } = e.data;
    
    try {
        switch (type) {
            case 'init':
                initializePDF();
                postMessage({ type: 'ready' } as WorkerResponse);
                break;
                
            case 'addPage':
                await addPageToPDF(data.imageBlob, data.pageNumber, data.totalPages);
                break;
                
            case 'processChunk':
                await processImageChunk(data.imageBlobs, data.startPageNumber, data.chunkId, data.totalPages);
                break;
                
            case 'assemblePages':
                await assemblePagesFromData(data.processedPages, data.totalPages);
                break;
                
            case 'finalize': {
                const pdfBlob = finalizePDF();
                postMessage({ 
                    type: 'complete', 
                    data: { pdfBlob },
                } as WorkerResponse);
                break;
            }
                
            case 'reset':
                resetPDF();
                break;
        }
    } catch (error: any) {
        postMessage({ 
            type: 'error', 
            data: { message: error.message },
        } as WorkerResponse);
    }
};

function initializePDF(): void {
    try {
        console.log('Initializing new PDF document...');
        
        if (typeof navigator !== 'undefined') {
            console.log('User Agent:', navigator.userAgent);
            console.log('Platform:', navigator.platform);
            console.log('Is Windows detected:', isWindows);
            if (isWindows) {
                console.log('Windows optimizations enabled');
            }
        }
        
        pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });
        
        pageCount = 0;
        console.log('PDF initialized successfully');
    } catch (error: any) {
        console.error('Failed to initialize PDF:', error);
        throw new Error(`Failed to initialize PDF: ${error.message}`);
    }
}

async function addPageToPDF(imageBlob: Blob, pageNumber: number, totalPages: number): Promise<void> {
    if (!pdf) {
        throw new Error('PDF not initialized');
    }

    try {
        console.log(`Processing page ${pageNumber}/${totalPages}`);

        if (imageBlob.size > (isWindows ? WINDOWS_MAX_IMAGE_SIZE_MB : 100) * 1024 * 1024) {
            console.warn(`Image ${pageNumber} is very large (${Math.round(imageBlob.size / 1024 / 1024)}MB), skipping to prevent memory issues`);
            postMessage({
                type: 'imageProcessingFailed',
                data: { pageNumber, originalImageBlob: imageBlob }
            } as WorkerResponse);
            
            postMessage({
                type: 'progress',
                data: { pageNumber, totalPages, percentage: Math.round((pageNumber / totalPages) * 100) }
            } as WorkerResponse);
            return;
        }

        const processedImage = await processImageForPDF(imageBlob, pageNumber);
        
        if (pageCount > 0) {
            pdf.addPage();
        }
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const margin = 10;
        const availableWidth = pageWidth - (2 * margin);
        const availableHeight = pageHeight - (2 * margin);
        
        const imageAspectRatio = processedImage.width / processedImage.height;
        const availableAspectRatio = availableWidth / availableHeight;
        
        let finalWidth, finalHeight;
        if (imageAspectRatio > availableAspectRatio) {
            finalWidth = availableWidth;
            finalHeight = availableWidth / imageAspectRatio;
        } else {
            finalHeight = availableHeight;
            finalWidth = availableHeight * imageAspectRatio;
        }
        
        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;
        
        pdf.addImage(
            processedImage.base64Data,
            'JPEG',
            x,
            y,
            finalWidth,
            finalHeight
        );
        
        pageCount++;
        
        if (isWindows && pageCount % GC_INTERVAL === 0) {
            if (typeof global !== 'undefined' && global.gc) {
                global.gc();
            }
        }
        
        postMessage({
            type: 'progress',
            data: { pageNumber, totalPages, percentage: Math.round((pageNumber / totalPages) * 100) }
        } as WorkerResponse);
        
    } catch (error: any) {
        console.error(`Failed to process page ${pageNumber}:`, error);
        postMessage({
            type: 'imageProcessingFailed',
            data: { pageNumber, originalImageBlob: imageBlob }
        } as WorkerResponse);
        
        postMessage({
            type: 'progress',
            data: { pageNumber, totalPages, percentage: Math.round((pageNumber / totalPages) * 100) }
        } as WorkerResponse);
    }
}

async function processImageForPDF(imageBlob: Blob, pageNumber: number): Promise<{ base64Data: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    throw new Error('Could not get canvas context');
                }
                
                // Unlimited resolution - use original image dimensions
                const { width, height } = img;
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                const quality = 1.0; // Maximum quality for all platforms
                const base64Data = canvas.toDataURL('image/jpeg', quality);
                
                resolve({ base64Data, width, height });
            } catch (error: any) {
                reject(new Error(`Failed to process image for page ${pageNumber}: ${error.message}`));
            }
        };
        
        img.onerror = () => {
            reject(new Error(`Failed to load image for page ${pageNumber}`));
        };
        
        img.src = URL.createObjectURL(imageBlob);
    });
}

async function processImageChunk(imageBlobs: Blob[], startPageNumber: number, chunkId: number, totalPages: number): Promise<void> {
    const processedPages: ProcessedPageData[] = [];
    
    for (let i = 0; i < imageBlobs.length; i++) {
        const pageNumber = startPageNumber + i;
        try {
            const processedImage = await processImageForPDF(imageBlobs[i], pageNumber);
            processedPages.push({
                pageNumber,
                base64Data: processedImage.base64Data,
                width: processedImage.width,
                height: processedImage.height
            });
        } catch (error) {
            console.error(`Failed to process page ${pageNumber} in chunk ${chunkId}:`, error);
        }
    }
    
    postMessage({
        type: 'chunkComplete',
        data: { chunkId, processedPages, totalPages }
    } as WorkerResponse);
}

async function assemblePagesFromData(processedPages: ProcessedPageData[], totalPages: number): Promise<void> {
    if (!pdf) {
        throw new Error('PDF not initialized');
    }
    
    processedPages.sort((a, b) => a.pageNumber - b.pageNumber);
    
    for (const pageData of processedPages) {
        if (pageCount > 0) {
            pdf.addPage();
        }
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const margin = 10;
        const availableWidth = pageWidth - (2 * margin);
        const availableHeight = pageHeight - (2 * margin);
        
        const imageAspectRatio = pageData.width / pageData.height;
        const availableAspectRatio = availableWidth / availableHeight;
        
        let finalWidth, finalHeight;
        if (imageAspectRatio > availableAspectRatio) {
            finalWidth = availableWidth;
            finalHeight = availableWidth / imageAspectRatio;
        } else {
            finalHeight = availableHeight;
            finalWidth = availableHeight * imageAspectRatio;
        }
        
        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;
        
        pdf.addImage(
            pageData.base64Data,
            'JPEG',
            x,
            y,
            finalWidth,
            finalHeight
        );
        
        pageCount++;
        
        postMessage({
            type: 'pageProcessed',
            data: { pageNumber: pageData.pageNumber, totalPages }
        } as WorkerResponse);
    }
    
    postMessage({
        type: 'assemblyComplete',
        data: { totalPages }
    } as WorkerResponse);
}

function finalizePDF(): Blob {
    if (!pdf) {
        throw new Error('PDF not initialized');
    }
    
    try {
        console.log('Finalizing PDF...');
        const pdfOutput = pdf.output('blob');
        console.log(`PDF finalized with ${pageCount} pages, size: ${Math.round(pdfOutput.size / 1024 / 1024 * 100) / 100}MB`);
        return pdfOutput;
    } catch (error: any) {
        console.error('Failed to finalize PDF:', error);
        throw new Error(`Failed to finalize PDF: ${error.message}`);
    }
}

function resetPDF(): void {
    pdf = null;
    pageCount = 0;
    console.log('PDF reset');
}