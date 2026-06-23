// Payment Gateway types

export interface PaymentGatewayConfig {
  apiUrl?: string;
  apiKey?: string;
  projectSlug?: string;
  virtualAccount?: string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  logo?: string;
  config?: PaymentGatewayConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayPublic {
  // Public info returned to renters (no secrets)
  id: string;
  name: string;
  logo?: string;
  enabled: boolean;
}

export interface CreatePaymentGatewayDto {
  name: string;
  logo?: string;
  config?: PaymentGatewayConfig;
  enabled?: boolean;
}

export interface UpdatePaymentGatewayDto {
  name?: string;
  logo?: string;
  config?: PaymentGatewayConfig;
  enabled?: boolean;
}
