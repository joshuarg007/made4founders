// Credential Management API types
// https://developer.mozilla.org/en-US/docs/Web/API/Credential_Management_API

interface PasswordCredentialData {
  id: string;
  password: string;
  name?: string;
  iconURL?: string;
}

interface PasswordCredentialInit extends PasswordCredentialData {
  origin?: string;
}

declare class PasswordCredential extends Credential {
  constructor(data: PasswordCredentialInit);
  readonly password: string;
  readonly name: string;
  readonly iconURL: string;
}

interface Window {
  PasswordCredential?: typeof PasswordCredential;
}

interface CredentialsContainer {
  store(credential: Credential): Promise<Credential>;
}
