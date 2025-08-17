
// Test to reproduce the exact Morgan Library URL concatenation bug
import { MorganLoader } from '../../../src/main/services/library-loaders/MorganLoader';

async function testMorganUrlConcatenation() {
    console.log('Testing Morgan URL concatenation bug...');
    
    // Mock dependencies
    const mockFetchDirect = async (url: string, options?: any) => {
        console.log(`Fetch called with URL: ${url}`);
        
        // Simulate 301 redirect response
        if (url.includes('/thumbs')) {
            return {
                status: 301,
                headers: {
                    get: (headerName: string) => {
                        if (headerName === 'location') {
                            // This might be where the bug is - what if the location header is malformed?
                            return '/collection/lindau-gospels/thumbs'; // or url itself?
                        }
                        return null;
                    }
                }
            };
        }
        
        return {
            ok: true,
            text: async () => '<html>mock response</html>'
        };
    };
    
    const mockLogger = {
        log: (data: any) => console.log('Logger:', data)
    };
    
    const loader = new MorganLoader({
        fetchDirect: mockFetchDirect,
        logger: mockLogger
    });
    
    try {
        const userUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
        console.log(`Testing with user URL: ${userUrl}`);
        
        const result = await loader.loadManifest(userUrl);
        console.log('Test passed:', result);
    } catch (error) {
        console.error('Test failed with error:', error.message);
        
        // Check if the error contains the duplicated URL
        if (error.message.includes('thumbshttps://')) {
            console.log('🚨 BUG REPRODUCED! URL concatenation bug confirmed.');
            return { bugReproduced: true, error: error.message };
        }
    }
    
    return { bugReproduced: false };
}

testMorganUrlConcatenation();
