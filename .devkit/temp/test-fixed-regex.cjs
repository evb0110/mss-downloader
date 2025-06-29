const commitMessage = 'VERSION-1.3.55: Fix University of Graz timeouts, add Rome BNC libroantico support, resolve Manuscripta.at hanging downloads, and fix e-manuscripta.ch complete manuscript detection';

console.log('Testing fixed regex:');

const versionMatch = commitMessage.match(/^VERSION-[^:]*:?\s*(.+)/i);
console.log('Fixed regex result:', versionMatch);

if (versionMatch) {
    const description = versionMatch[1] ? versionMatch[1].trim() : '';
    console.log('Description:', JSON.stringify(description));
    
    // Test the specific pattern
    if (description.match(/Fix.*University.*Graz.*timeouts.*Rome.*BNC.*libroantico.*Manuscripta.*hanging.*e-manuscripta.*complete/i)) {
        console.log('✅ Matches specific pattern!');
        console.log('Result: Fixed University of Graz timeouts, added Rome BNC libroantico support, resolved Manuscripta.at hanging downloads, and fixed e-manuscripta.ch complete manuscript detection (468x improvement)');
    } else {
        console.log('❌ Does not match specific pattern');
        
        // Test individual patterns
        console.log('Testing individual patterns:');
        console.log('University of Graz:', description.match(/Fix.*University.*Graz.*timeout/i) ? '✅' : '❌');
        console.log('Rome BNC:', description.match(/add.*Rome.*BNC.*libroantico/i) ? '✅' : '❌');
        console.log('Manuscripta:', description.match(/resolve.*Manuscripta.*hanging/i) ? '✅' : '❌');
        console.log('e-manuscripta:', description.match(/fix.*e-manuscripta.*complete.*manuscript/i) ? '✅' : '❌');
    }
}