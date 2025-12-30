class SessionManager {
  constructor() {
    this.sessions = new Set();
  }
  
  createSession() {}
  
  addSession() {}
  
  readSession() {}
  
  closeSession() {}
}

class Session {
  constructor(session) {
    this.session = {
      userAgent: session.userAgent,
    }
  }
}