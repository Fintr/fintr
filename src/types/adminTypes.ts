export interface WhitelistEntry {
  id: string;
  email: string;
}

export interface CreateWhitelistPayload {
  email: string;
}

export interface UpdateWhitelistPayload {
  id: string;
  email: string;
}

export interface DeleteWhitelistPayload {
  id: string;
} 
