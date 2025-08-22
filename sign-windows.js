// Windows code signing configuration
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default async function signWindows(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'win32') return;
  
  // Check if a real signing certificate is available
  if (process.env.CSC_LINK && process.env.CSC_KEY_PASSWORD) {
    console.log('✅ Using provided code signing certificate');
    return; // electron-builder will sign installer, app, and uninstaller
  }

  const allowSelfSign = process.env.ALLOW_SELF_SIGN === 'true';

  if (allowSelfSign) {
    try {
      await createSelfSignedCertificate();
      console.log('✅ Using self-signed certificate for development builds (ALLOW_SELF_SIGN=true)');
      return;
    } catch (error) {
      console.log('⚠️ Failed to create a self-signed certificate, continuing unsigned. This is OK for local dev only.');
      return;
    }
  }

  // Proceed unsigned for small distribution to trusted users
  console.log('⚠️ Building unsigned Windows binaries (no CSC_LINK provided). NSIS installer and uninstaller will be unsigned.');
  console.log('   This may trigger SmartScreen/AV prompts for some users.');
  return;
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