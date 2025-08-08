const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.ts');

const service = new EnhancedManuscriptDownloaderService();
const libraries = service.getSupportedLibraries();

console.log('Total libraries:', libraries.length);

const geoBlockedLibs = libraries.filter(lib => lib.geoBlocked === true);
console.log('Geo-blocked libraries:', geoBlockedLibs.length);

console.log('\nGeo-blocked libraries list:');
geoBlockedLibs.forEach(lib => {
    console.log(`- ${lib.name}: geoBlocked=${lib.geoBlocked}`);
});

console.log('\nFirst 5 non-geo-blocked libraries:');
libraries.filter(lib => !lib.geoBlocked).slice(0, 5).forEach(lib => {
    console.log(`- ${lib.name}: geoBlocked=${lib.geoBlocked}`);
});