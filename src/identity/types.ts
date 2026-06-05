export type Provider = "google" | "github" | "figma" | "vercel";

export interface IdentitiesYaml {
  providers: {
    google?: ProviderAccountsBlock<GoogleAccount>;
    github?: ProviderAccountsBlock<GithubAccount>;
    figma?: ProviderAccountsBlock<FigmaAccount>;
    vercel?: ProviderAccountsBlock<VercelAccount>;
  };
}

export interface ProviderAccountsBlock<T> {
  accounts: Record<string, T>;
}

export interface GoogleAccount {
  email?: string;
  scopes: string[];
}

export interface GithubAccount {
  permissions?: string[];
  adminToken?: { permissions: string[]; requiresApproval?: boolean };
}

export interface FigmaAccount {
  scopes: string[];
}

export interface VercelAccount {
  scope: string;
  dangerous?: string[];
}

export interface BootstrapResult {
  provider: Provider;
  accountId: string;
  email?: string;
  scopes: string[];
  token: string;
  extra?: Record<string, string>;
}

export interface InfisicalContext {
  projectId: string;
  envSlug: string;
  adminApi: string;
}
