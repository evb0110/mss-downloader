// Test enhanced title extraction for Digital Scriptorium

async function testEnhancedTitle() {
    console.log('🔍 Testing enhanced Digital Scriptorium title extraction...');
    
    try {
        const response = await fetch('https://colenda.library.upenn.edu/items/ark:/81431/p38g8fj78/manifest');
        const manifest = await response.json();
        
        console.log('\n📋 Analyzing metadata entries:');
        if (manifest.metadata) {
            manifest.metadata.forEach((entry: any, index: number) => {
                const label = entry.label?.toLowerCase() || entry.label?.en?.[0]?.toLowerCase() || '';
                let value = '';
                
                if (typeof entry.value === 'string') {
                    value = entry.value;
                } else if (entry.value?.en && entry.value.en[0]) {
                    value = entry.value.en[0];
                } else if (Array.isArray(entry.value) && entry.value[0]) {
                    value = entry.value[0];
                }
                
                if (value) {
                    console.log(`${index}. Label: "${label}" -> Value: "${value}"`);
                    
                    // Test extraction patterns
                    if (label.includes('codex') || label.includes('manuscript')) {
                        const codexMatch = value.match(/Ms\.?\s*Codex\s*\d+|Manuscript\s*\d+|Cod\.?\s*\d+/i);
                        if (codexMatch) {
                            console.log(`   📝 CODEX FOUND: ${codexMatch[0]}`);
                        }
                    }
                    
                    if (label.includes('date') || label.includes('created')) {
                        const dateMatch = value.match(/(\d{4}|\d{1,2}th\s+century|XV|XIV|XIII|XII|XI|\d{1,2}00s)/i);
                        if (dateMatch) {
                            console.log(`   📅 DATE FOUND: ${dateMatch[1]}`);
                        }
                    }
                    
                    if (label.includes('origin') || label.includes('place') || label.includes('provenance')) {
                        const placeMatch = value.match(/(?:Written in |from )?([A-Za-z]+)(?:,|\s+in\s+the|\s+\()/);
                        if (placeMatch && placeMatch[1]) {
                            console.log(`   🌍 ORIGIN FOUND: ${placeMatch[1]}`);
                        }
                    }
                }
            });
        }
        
        console.log('\n✅ SIMULATED ENHANCED EXTRACTION:');
        
        // Simulate our extraction logic
        let title = manifest.label || 'Digital Scriptorium Manuscript';
        let codexNumber = '';
        let date = '';
        let origin = '';
        
        if (manifest.metadata) {
            for (const entry of manifest.metadata) {
                const label = entry.label?.toLowerCase() || entry.label?.en?.[0]?.toLowerCase() || '';
                let value = '';
                
                if (typeof entry.value === 'string') {
                    value = entry.value;
                } else if (entry.value?.en && entry.value.en[0]) {
                    value = entry.value.en[0];
                } else if (Array.isArray(entry.value) && entry.value[0]) {
                    value = entry.value[0];
                }
                
                if (value) {
                    if (label.includes('codex') || label.includes('manuscript')) {
                        const codexMatch = value.match(/Ms\.?\s*Codex\s*\d+|Manuscript\s*\d+|Cod\.?\s*\d+/i);
                        if (codexMatch) {
                            codexNumber = codexMatch[0].replace(/\s+/g, '_').replace(/\./g, '');
                        }
                    }
                    
                    if (label.includes('date') || label.includes('created')) {
                        const dateMatch = value.match(/(\d{4}|\d{1,2}th\s+century|XV|XIV|XIII|XII|XI|\d{1,2}00s)/i);
                        if (dateMatch) {
                            date = dateMatch[1];
                        }
                    }
                    
                    if (label.includes('origin') || label.includes('place') || label.includes('provenance')) {
                        const placeMatch = value.match(/(?:Written in |from )?([A-Za-z]+)(?:,|\s+in\s+the|\s+\()/);
                        if (placeMatch && placeMatch[1]) {
                            origin = placeMatch[1];
                        }
                    }
                }
            }
        }
        
        // Build comprehensive title
        let parts = [];
        if (codexNumber) parts.push(codexNumber);
        if (origin) parts.push(origin);
        if (title && !title.includes('Digital Scriptorium')) {
            parts.push(title.replace(/^\[|\]$/g, '').replace(/[,;].*$/, '').trim());
        }
        if (date) parts.push(date);
        
        let finalTitle = parts.length > 0 ? parts.join('_') : title.replace(/^\[|\]$/g, '').trim();
        
        // Clean up filename
        finalTitle = finalTitle
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/[,;]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        console.log('\nExtracted components:');
        console.log('- Codex Number:', codexNumber || 'none');
        console.log('- Origin:', origin || 'none');
        console.log('- Title:', title || 'none');
        console.log('- Date:', date || 'none');
        console.log('\n🎯 FINAL TITLE:', finalTitle);
        console.log(`🎯 EXPECTED FILES: ${finalTitle}_Part_1_pages_1-33_DS1649.pdf`);
        
    } catch (error) {
        console.error('❌ Error testing enhanced title extraction:', error);
    }
}

testEnhancedTitle();