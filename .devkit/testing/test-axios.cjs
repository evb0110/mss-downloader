const axios = require('axios');

async function testManuscriptIds() {
    console.log('Testing Linz manuscript IDs...');
    const testIds = [117, 118, 120, 150, 200, 250, 300];
    
    for (const id of testIds) {
        try {
            const response = await axios.head(`https://digi.landesbibliothek.at/viewer/api/v1/records/${id}/manifest/`);
            console.log(`ID ${id}: ${response.status} - exists`);
        } catch (err) {
            if (err.response) {
                console.log(`ID ${id}: ${err.response.status} - not found`);
            } else {
                console.log(`ID ${id}: Network error`);
            }
        }
    }
}

testManuscriptIds();