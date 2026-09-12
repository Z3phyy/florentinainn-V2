export interface chatInterfaceInput {
    clientName: string,
    convo : {
        user: "client" | "staff",
        message: string,
    }[]
}

export interface chatInterface extends chatInterfaceInput {
    _id : string,
}


  