import type { WebAuthnLoginOptionsHandlerConfig, WebAuthnLoginVerifyHandlerConfig, WebAuthnRegisterOptionsHandlerConfig, WebAuthnRegisterVerifyHandlerConfig } from "./webauthn.js";
export declare function createWebAuthnRegisterOptionsHandler(_config: WebAuthnRegisterOptionsHandlerConfig): () => Promise<Response>;
export declare function createWebAuthnRegisterVerifyHandler(_config: WebAuthnRegisterVerifyHandlerConfig): () => Promise<Response>;
export declare function createWebAuthnLoginOptionsHandler(_config: WebAuthnLoginOptionsHandlerConfig): () => Promise<Response>;
export declare function createWebAuthnLoginVerifyHandler(_config: WebAuthnLoginVerifyHandlerConfig): () => Promise<Response>;
