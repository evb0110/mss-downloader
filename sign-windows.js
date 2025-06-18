// Windows code signing configuration
// To enable actual code signing, you need to:
// 1. Get a code signing certificate from a trusted CA (DigiCert, Sectigo, etc.)
// 2. Set environment variables: CSC_LINK (path to .p12 file) and CSC_KEY_PASSWORD
// 3. Uncomment and configure the signing logic below

export default async function signWindows(context) {
  // For now, skip signing to avoid build errors
  // When ready to implement signing:
  
  /*
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'win32') return;
  
  // Check if signing certificate is available
  if (!process.env.CSC_LINK || !process.env.CSC_KEY_PASSWORD) {
    console.log('⚠️  Code signing certificate not found. Building without signature.');
    console.log('   To enable signing, set CSC_LINK and CSC_KEY_PASSWORD environment variables.');
    return;
  }
  
  // Your signing logic here
  console.log('✅ Code signing completed');
  */
  
  console.log('⚠️  Building without code signature. This may trigger antivirus false positives.');
  console.log('   To eliminate false positives, consider purchasing a code signing certificate.');
}