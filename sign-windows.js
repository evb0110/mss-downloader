// Windows code signing configuration
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default async function signWindows(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'win32') return;
  
  // Check if signing certificate is available
  if (process.env.CSC_LINK && process.env.CSC_KEY_PASSWORD) {
    console.log('✅ Using provided code signing certificate');
    return; // Let electron-builder handle the signing
  }
  
  // Try to create and use a self-signed certificate for development
  try {
    await createSelfSignedCertificate();
    console.log('✅ Using self-signed certificate for development builds');
  } catch (error) {
    console.log('⚠️  Building without code signature. This may trigger Windows SmartScreen warnings.');
    console.log('   Users will need to click "More info" > "Run anyway" to bypass the warning.');
    console.log('   To eliminate warnings, consider purchasing a code signing certificate.');
  }
}

async function createSelfSignedCertificate() {
  const certPath = path.join(process.cwd(), 'dev-cert.p12');
  
  // Skip if certificate already exists
  if (fs.existsSync(certPath)) {
    process.env.CSC_LINK = certPath;
    process.env.CSC_KEY_PASSWORD = 'dev123';
    return;
  }
  
  // Check if we have PowerShell available for certificate creation
  try {
    const powershellScript = `
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Abba Ababus Manuscripts" -KeyAlgorithm RSA -KeyLength 2048 -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" -KeyExportPolicy Exportable -KeyUsage DigitalSignature -CertStoreLocation Cert:\\CurrentUser\\My
$password = ConvertTo-SecureString -String "dev123" -Force -AsPlainText
Export-PfxCertificate -cert "Cert:\\CurrentUser\\My\\$($cert.Thumbprint)" -FilePath "${certPath}" -Password $password
    `;
    
    // Only create certificate on Windows
    if (process.platform === 'win32') {
      execSync(`powershell -Command "${powershellScript}"`, { stdio: 'inherit' });
      
      if (fs.existsSync(certPath)) {
        process.env.CSC_LINK = certPath;
        process.env.CSC_KEY_PASSWORD = 'dev123';
        console.log('✅ Self-signed certificate created for development');
      }
    }
  } catch (error) {
    // Fallback: just inform about the issue
    throw new Error('Cannot create self-signed certificate');
  }
}