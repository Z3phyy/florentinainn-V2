export interface ChatMessage {
    user: "client" | "staff",
    message: string,
    timestamp?: string | Date,
    seen?: boolean,
}

export interface chatInterfaceInput {
    clientName: string,
    status?: "active" | "resolved",
    convo: ChatMessage[],
}

export interface chatInterface extends chatInterfaceInput {
    _id: string,
    createdAt?: string,
    updatedAt?: string,
}


  