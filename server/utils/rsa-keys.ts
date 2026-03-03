import crypto from "crypto";

export class RSAKeyManager {
  private privateKey: string;
  private publicKey: string;

  constructor() {
    this.privateKey = this.getPrivateKey();
    this.publicKey = this.getPublicKey();
  }

  private getPrivateKey(): string {
    const envKey = process.env.RSA_PRIVATE_KEY;
    if (!envKey) {
      throw new Error("RSA_PRIVATE_KEY environment variable is required");
    }
    return envKey.replace(/\\n/g, '\n');
  }

  private getPublicKey(): string {
    const envKey = process.env.RSA_PUBLIC_KEY;
    if (!envKey) {
      throw new Error("RSA_PUBLIC_KEY environment variable is required");
    }
    return envKey.replace(/\\n/g, '\n');
  }

  sign(data: string): string {
    const sign = crypto.createSign("SHA256");
    sign.update(data);
    sign.end();
    return sign.sign(this.privateKey, "base64");
  }

  verify(data: string, signature: string): boolean {
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(this.publicKey, signature, "base64");
  }
}

// Export singleton instance
export const rsaKeyManager = new RSAKeyManager();
